import "server-only";
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { calcularFechaFin, type UnidadDuracion } from "@/domain/entities/Plan";
import { respaldoAntesDeActualizar } from "../respaldo/paquete";

/**
 * Correcciones de datos que se hacen UNA sola vez al abrir, después de las
 * migraciones. Cada una deja su marca en `ajustes` para no repetirse.
 *
 * Historia: la beta.40 recalculó por su cuenta las mensualidades vigentes con
 * la regla del día fijo y les alargó uno o dos días a las que empezaron en
 * octubre. Eso no se debió hacer sobre membresías ya cobradas: aquí se
 * deshace, membresía por membresía, con las fechas que la bitácora guardó de
 * antes. La regla del día fijo sigue valiendo solo para los cobros nuevos.
 */
export function ajustarDatos(db: DatabaseSync) {
  // Una corrección que falla nunca debe impedir que el programa abra: se deshace
  // (va en una transacción), no deja su marca y se vuelve a intentar al abrir otra vez.
  try {
    if (!yaSeHizo(db, MARCA_DESHACER)) corregirMembresias(db);
  } catch (error) {
    console.error("No se pudieron corregir las membresías:", error);
  }
}

/** Quien hizo el ajuste de la beta.40 (así quedó en la bitácora). */
const AJUSTE_BETA_40 = "Actualización del programa";
/** Quien hace esta corrección: otro nombre, para no confundirla nunca con el ajuste que deshace. */
const QUIEN = "Corrección del programa";
const MARCA_DESHACER = "correccion_membresias_beta_41";

function yaSeHizo(db: DatabaseSync, marca: string): boolean {
  return Boolean(db.prepare("select 1 as si from ajustes where clave = ?").get(marca));
}

interface Cambio {
  id: string;
  inicio: string;
  fin: string;
}

function corregirMembresias(db: DatabaseSync) {
  const deshechas = cambiosParaDeshacerElAjuste(db);
  const altas = cambiosDeAltasConFechaEquivocada(db);
  const cambios = [...deshechas, ...altas];

  if (cambios.length > 0) respaldoAntesDeActualizar(db);
  db.exec("begin immediate");
  try {
    db.prepare("update contexto set usuario = ? where id = 1").run(QUIEN);
    const actualizar = db.prepare("update suscripciones set fecha_inicio = ?, fecha_fin = ? where id = ?");
    for (const c of cambios) actualizar.run(c.inicio, c.fin, c.id);
    db.prepare("update contexto set usuario = null where id = 1").run();
    db.prepare("insert into ajustes (clave, valor) values (?, ?)").run(
      MARCA_DESHACER,
      `${new Date().toISOString()} · ${deshechas.length} regresadas a su fecha · ${altas.length} altas corregidas`,
    );
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

/* ── 1. Deshacer el ajuste de la beta.40 ─────────────────────────────── */

interface FilaBitacora {
  registro_id: string;
  antes: string;
  despues: string;
}

/**
 * Cada membresía que movió el ajuste regresa a las fechas que tenía antes,
 * tal como las guardó la bitácora. Solo si sigue exactamente como la dejó el
 * ajuste (si alguien la tocó después, se respeta), y por socio completo: si
 * una de sus membresías no se puede regresar, no se le toca ninguna, para que
 * nunca queden encimadas ni con huecos. Tampoco se toca a quien ya renovó
 * después del ajuste.
 */
function cambiosParaDeshacerElAjuste(db: DatabaseSync): Cambio[] {
  const filas = db
    .prepare(
      `select registro_id, antes, despues from bitacora
        where tabla = 'suscripciones' and operacion = 'cambio' and usuario_nombre = ?
        order by id`,
    )
    .all(AJUSTE_BETA_40) as unknown as FilaBitacora[];

  const porSocio = new Map<string, { cambios: Cambio[]; sePuede: boolean }>();
  const ajustadas = new Set(filas.map((f) => f.registro_id));
  for (const f of filas) {
    const antes = JSON.parse(f.antes) as { fecha_inicio: string; fecha_fin: string; socio_id: string };
    const despues = JSON.parse(f.despues) as { fecha_inicio: string; fecha_fin: string };
    const actual = db.prepare("select socio_id, fecha_inicio, fecha_fin from suscripciones where id = ?").get(f.registro_id) as
      | { socio_id: string; fecha_inicio: string; fecha_fin: string }
      | undefined;
    const socio = actual?.socio_id ?? antes.socio_id;
    const grupo = porSocio.get(socio) ?? { cambios: [], sePuede: true };
    porSocio.set(socio, grupo);
    if (!actual) continue; // Ya no existe (se canceló): nada que regresar.
    if (actual.fecha_inicio !== despues.fecha_inicio || actual.fecha_fin !== despues.fecha_fin) {
      grupo.sePuede = false; // Alguien la cambió después del ajuste.
      continue;
    }
    grupo.cambios.push({ id: f.registro_id, inicio: antes.fecha_inicio, fin: antes.fecha_fin });
  }

  const cambios: Cambio[] = [];
  for (const [socio, grupo] of porSocio) {
    if (!grupo.sePuede || grupo.cambios.length === 0) continue;
    // ¿Renovó después del ajuste? Una membresía suya (no visita) que el ajuste no tocó y que empieza después.
    const ultimoInicio = grupo.cambios.reduce((m, c) => (c.inicio > m ? c.inicio : m), "");
    const posteriores = db
      .prepare(
        `select s.id from suscripciones s join planes p on p.id = s.plan_id
          where s.socio_id = ? and s.fecha_inicio > ? and not (p.unidad = 'dias' and p.duracion = 1)`,
      )
      .all(socio, ultimoInicio) as { id: string }[];
    if (posteriores.some((p) => !ajustadas.has(p.id))) continue;
    cambios.push(...grupo.cambios);
  }
  return cambios;
}

/* ── 2. Altas registradas con la fecha equivocada ────────────────────── */

/**
 * Socios que se dieron de alta en el programa ya con su mes pagado desde
 * antes: su membresía quedó empezando el día del alta. El gimnasio pidió
 * corregirlas. Se buscan por la huella (SHA-256) de su nombre completo para
 * no dejar nombres de socios en el código. Solo se toca su membresía más
 * reciente si es de 1 mes, empezó en noviembre y no hay otra después. El
 * pago se queda en el corte del día en que se registró.
 */
const ALTAS_A_CORREGIR: { nombre: string; inicio: string }[] = [
  { nombre: "a76d1fd85a4741c523143441b579491de64d3eb945be8a014fca9fe1fce684af", inicio: "2026-10-21" },
  { nombre: "533ebdc3d9da00436cfb9a7a14064e95976028c36d00581f5f1e1b3c87bf679f", inicio: "2026-10-21" },
];

export function huellaDeNombre(nombreCompleto: string): string {
  const limpio = nombreCompleto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(limpio).digest("hex");
}

function cambiosDeAltasConFechaEquivocada(db: DatabaseSync): Cambio[] {
  const socios = db.prepare("select id, nombre, apellidos from socios").all() as { id: string; nombre: string; apellidos: string }[];
  const cambios: Cambio[] = [];
  for (const alta of ALTAS_A_CORREGIR) {
    const encontrados = socios.filter((s) => huellaDeNombre(`${s.nombre} ${s.apellidos}`) === alta.nombre);
    if (encontrados.length !== 1) continue;
    const membresias = db
      .prepare(
        `select s.id, s.fecha_inicio, s.fecha_fin, p.unidad, p.duracion
           from suscripciones s join planes p on p.id = s.plan_id
          where s.socio_id = ? and not (p.unidad = 'dias' and p.duracion = 1)
          order by s.fecha_fin desc, s.creado_en desc`,
      )
      .all(encontrados[0].id) as { id: string; fecha_inicio: string; fecha_fin: string; unidad: UnidadDuracion; duracion: number }[];
    const [ultima, anterior] = membresias;
    if (!ultima || ultima.unidad !== "meses" || ultima.duracion !== 1) continue;
    if (ultima.fecha_inicio < "2026-11-01" || ultima.fecha_inicio <= alta.inicio) continue; // Ya está bien o no es el caso.
    if (anterior && anterior.fecha_fin >= alta.inicio) continue; // Se encimaría con la anterior.
    cambios.push({ id: ultima.id, inicio: alta.inicio, fin: calcularFechaFin(alta.inicio, ultima) });
  }
  return cambios;
}
