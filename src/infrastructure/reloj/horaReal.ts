import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";

/**
 * El programa no se fía de la fecha de la computadora: con la fecha mal se
 * cobra en el día equivocado, se cuelan socios vencidos o se rechazan los
 * vigentes. Por eso:
 *
 *   · Con internet: compara la hora de la computadora con la hora real (la
 *     que dan servidores de internet en cada respuesta). Si están desfasadas
 *     más de 5 minutos, no se guarda nada del gimnasio (cobros, entradas,
 *     ventas, cambios) hasta que la corrijan.
 *   · Si alguien mueve el reloj después de revisarlo, se nota (se compara con
 *     un cronómetro interno que no depende del reloj de Windows).
 *   · Sin internet: si la fecha de la computadora es ANTERIOR a lo último que
 *     ya se guardó, alguien regresó el reloj, y tampoco se guarda nada.
 *
 * Solo se consulta la hora: no se manda ningún dato del gimnasio.
 */

/** Más de esto de diferencia con la hora real se considera reloj equivocado. */
const TOLERANCIA_MS = 5 * 60_000;
/** Cada cuánto se vuelve a consultar la hora real. */
const REVISAR_CADA_MS = 15 * 60_000;
/** Si falla (sin internet), se reintenta antes. */
const REINTENTAR_SIN_INTERNET_MS = 2 * 60_000;
/** Servidores grandes y siempre en línea; de cualquiera basta la hora de su respuesta. */
const FUENTES = ["https://www.google.com/generate_204", "https://www.cloudflare.com/cdn-cgi/trace", "https://www.microsoft.com/"];

interface Medicion {
  /** Hora real menos hora de la computadora, en el momento de medir. */
  desfaseMs: number;
  /** Hora de la computadora y cronómetro interno al medir (para notar si después mueven el reloj). */
  relojAlMedir: number;
  cronometroAlMedir: number;
}

const global = globalThis as unknown as { __horaReal?: { medicion: Medicion | null; ultimaConsulta: number; enCurso: Promise<void> | null } };
const estado = (global.__horaReal ??= { medicion: null, ultimaConsulta: 0, enCurso: null });

async function horaDeInternet(): Promise<{ hora: number; enviadaEn: number; recibidaEn: number; cronometro: number } | null> {
  for (const url of FUENTES) {
    try {
      const cronometro0 = performance.now();
      const enviadaEn = Date.now();
      const r = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(5000) });
      const recibidaEn = Date.now();
      const cronometro = (cronometro0 + performance.now()) / 2;
      const fecha = r.headers.get("date");
      const hora = fecha ? Date.parse(fecha) : NaN;
      // Una hora absurda (antes de 2024) se descarta: sería un error de la fuente, no la hora real.
      if (Number.isFinite(hora) && hora > Date.UTC(2024, 0, 1)) return { hora, enviadaEn, recibidaEn, cronometro };
    } catch {
      // Sin internet o la fuente no contestó: se prueba la siguiente.
    }
  }
  return null;
}

/** Consulta la hora real en segundo plano (una consulta a la vez). */
function revisarEnSegundoPlano() {
  const espera = estado.medicion ? REVISAR_CADA_MS : REINTENTAR_SIN_INTERNET_MS;
  if (estado.enCurso || Date.now() - estado.ultimaConsulta < espera) return;
  estado.ultimaConsulta = Date.now();
  estado.enCurso = (async () => {
    const r = await horaDeInternet();
    if (r) {
      // La hora del servidor llega en segundos enteros: se toma la mitad del viaje de ida y vuelta.
      const relojAlMedir = (r.enviadaEn + r.recibidaEn) / 2;
      estado.medicion = { desfaseMs: r.hora + 500 - relojAlMedir, relojAlMedir, cronometroAlMedir: r.cronometro };
    }
  })().finally(() => {
    estado.enCurso = null;
  });
}

export type EstadoDelReloj =
  | { ok: true; comprobado: boolean }
  | { ok: false; motivo: "desfasado"; minutos: number }
  | { ok: false; motivo: "regresado"; ultimoRegistro: string };

/**
 * Si la fecha y hora de la computadora se pueden usar. `db` sirve para la
 * revisión sin internet (lo último guardado en la bitácora).
 */
export function estadoDelReloj(db: DatabaseSync): EstadoDelReloj {
  revisarEnSegundoPlano();
  const m = estado.medicion;
  if (m) {
    // Si movieron el reloj después de medir, el cronómetro interno lo delata.
    const movidoDespues = Date.now() - (m.relojAlMedir + (performance.now() - m.cronometroAlMedir));
    const desfase = m.desfaseMs - movidoDespues;
    if (Math.abs(desfase) > TOLERANCIA_MS) return { ok: false, motivo: "desfasado", minutos: Math.round(-desfase / 60_000) };
    // Comprobada contra internet: esa manda. (Si antes tuvieron el reloj adelantado y se guardaron
    // cosas "en el futuro", la revisión de abajo bloquearía sin razón ya con el reloj corregido.)
    return { ok: true, comprobado: true };
  }
  // Sin internet: nada se puede guardar "antes" de lo último que ya se guardó.
  const ultimo = (db.prepare("select max(ocurrido_en) as ultimo from bitacora").get() as { ultimo: string | null } | undefined)?.ultimo;
  if (ultimo && Date.parse(ultimo) - Date.now() > TOLERANCIA_MS) return { ok: false, motivo: "regresado", ultimoRegistro: ultimo };
  return { ok: true, comprobado: false };
}

const COMO_CORREGIR = "Corrígela en Windows: Configuración → Hora e idioma → Fecha y hora → activa «Establecer la hora automáticamente».";

/** Texto para recepción (aviso en pantalla y mensaje al intentar guardar). */
export function explicarReloj(e: EstadoDelReloj): string {
  if (e.ok) return "";
  if (e.motivo === "desfasado") {
    const cuanto = Math.abs(e.minutos) >= 120 ? `${Math.round(Math.abs(e.minutos) / 60)} horas` : `${Math.abs(e.minutos)} minutos`;
    return `La fecha u hora de esta computadora está mal (va ${cuanto} ${e.minutos > 0 ? "adelantada" : "atrasada"}). Para no registrar cobros ni entradas con la fecha equivocada, no se guarda nada hasta corregirla. ${COMO_CORREGIR}`;
  }
  return `La fecha de esta computadora es anterior a lo último que ya se registró: alguien regresó el reloj. Para no registrar cobros ni entradas con la fecha equivocada, no se guarda nada hasta corregirla. ${COMO_CORREGIR}`;
}

/** Para los guardados del gimnasio: si el reloj está mal, no se guarda. */
export function exigirRelojCorrecto(db: DatabaseSync) {
  const e = estadoDelReloj(db);
  if (!e.ok) throw new ErrorDeDominio(explicarReloj(e));
}
