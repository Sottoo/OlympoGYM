import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { type FechaISO, sumarDias } from "../shared/fechas";

/** Una entrada de un socio al gimnasio, registrada en recepción. */
export interface Asistencia {
  id: string;
  socioId: string;
  /** Día local del gimnasio (para agrupar por día sin problemas de zona horaria). */
  fecha: FechaISO;
  /** Instante exacto, ISO 8601. */
  registradaEn: string;
  /** Si entró sin membresía vigente, el motivo que autorizó recepción. */
  excepcion: string | null;
}

export interface DatosNuevaAsistencia {
  socioId: string;
  fecha: FechaISO;
  excepcion: string | null;
}

/** Dos entradas del mismo socio con menos de este tiempo se consideran un doble registro. */
export const MINUTOS_ENTRE_ENTRADAS = 120;

/** Una entrada registrada por error se puede deshacer durante este tiempo. */
export const MINUTOS_PARA_DESHACER = 10;

/** Motivos para dejar pasar a alguien sin membresía vigente. Quedan en la bitácora. */
export const MOTIVOS_EXCEPCION = [
  "Pagará al salir",
  "Visita de prueba",
  "Cortesía autorizada",
  "Otro",
] as const;

/** El motivo es obligatorio; si es "Otro", también el detalle. */
export function validarExcepcion(motivo: string, detalle: string | null): string {
  const base = motivo.trim();
  const extra = detalle?.trim() ?? "";
  if (!(MOTIVOS_EXCEPCION as readonly string[]).includes(base)) throw new ErrorDeDominio("Elige por qué se le deja pasar.");
  if (base === "Otro" && extra.length < 3) throw new ErrorDeDominio("Describe brevemente por qué se le deja pasar.");
  return extra ? `${base}: ${extra}` : base;
}

export const minutosDesde = (instante: string, ahora: string) =>
  (new Date(ahora).getTime() - new Date(instante).getTime()) / 60_000;

/**
 * Racha: días seguidos que un socio ha venido, contando hacia atrás desde hoy.
 * Si hoy todavía no viene pero ayer sí, la racha sigue viva (puede venir más tarde).
 */
export function contarRacha(dias: Iterable<FechaISO>, hoy: FechaISO): number {
  const vino = new Set(dias);
  let dia = vino.has(hoy) ? hoy : sumarDias(hoy, -1);
  let racha = 0;
  while (vino.has(dia)) {
    racha++;
    dia = sumarDias(dia, -1);
  }
  return racha;
}
