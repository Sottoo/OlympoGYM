import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { calcularFechaFin, type UnidadDuracion } from "@/domain/entities/Plan";
import { diaDePago, type Suscripcion } from "@/domain/entities/Suscripcion";
import { diasEntre, hoyEn, sumarDias } from "@/domain/shared/fechas";
import { entorno } from "../config/entorno";
import { respaldoAntesDeActualizar } from "../respaldo/paquete";

/**
 * Ajustes de datos que se hacen UNA sola vez, después de las migraciones,
 * porque necesitan reglas del negocio (fechas) que no se pueden escribir en
 * SQL. Cada uno deja su marca en `ajustes` para no repetirse; una base
 * restaurada de un respaldo anterior no trae la marca y se ajusta otra vez.
 */
export function ajustarDatos(db: DatabaseSync) {
  // Un ajuste que falla nunca debe impedir que el programa abra: se deshace
  // (va en una transacción), no deja su marca y se vuelve a intentar al abrir otra vez.
  try {
    if (!yaSeHizo(db, MARCA_DIA_FIJO)) membresiasConDiaFijo(db);
  } catch (error) {
    console.error("No se pudo ajustar las membresías al día fijo:", error);
  }
}

const MARCA_DIA_FIJO = "ajuste_membresias_dia_fijo";
const QUIEN = "Actualización del programa";

function yaSeHizo(db: DatabaseSync, marca: string): boolean {
  return Boolean(db.prepare("select 1 as si from ajustes where clave = ?").get(marca));
}

interface Fila {
  id: string;
  socio_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  unidad: UnidadDuracion;
  duracion: number;
}

/**
 * Las mensualidades pasaron de 30 días exactos a «el mismo día de cada mes».
 * Las que siguen vigentes (o ya pagadas para después) se recalculan con la
 * regla nueva desde su mismo día de inicio. Nunca se le quitan días a nadie:
 * si con la regla nueva vencería antes, se queda con la fecha que ya tenía.
 * Si una membresía se alarga, la que tenga pagada justo después se recorre
 * los mismos días para que no se encimen. Todo queda en la bitácora.
 */
function membresiasConDiaFijo(db: DatabaseSync) {
  const hoy = hoyEn(entorno.zonaHoraria);
  const filas = db
    .prepare(
      `select s.id, s.socio_id, s.fecha_inicio, s.fecha_fin, p.unidad, p.duracion
         from suscripciones s join planes p on p.id = s.plan_id
        where not (p.unidad = 'dias' and p.duracion = 1)
        order by s.socio_id, s.fecha_inicio, s.creado_en`,
    )
    .all() as unknown as Fila[];

  // Lo que cambia, socio por socio y en orden de fechas.
  const cambios: { id: string; inicio: string; fin: string }[] = [];
  let socio = "";
  let historial: Suscripcion[] = [];
  let finOriginalAnterior = "";
  let corrimiento = 0;
  for (const f of filas) {
    if (f.socio_id !== socio) {
      socio = f.socio_id;
      historial = [];
      finOriginalAnterior = "";
      corrimiento = 0;
    }
    // Si la anterior se alargó y esta empezaba justo al día siguiente, se recorre igual.
    const pegada = corrimiento > 0 && f.fecha_inicio === sumarDias(finOriginalAnterior, 1);
    const inicio = pegada ? sumarDias(f.fecha_inicio, corrimiento) : f.fecha_inicio;
    let fin = pegada ? sumarDias(f.fecha_fin, corrimiento) : f.fecha_fin;
    if (f.unidad === "meses" && f.fecha_fin >= hoy) {
      const nuevo = calcularFechaFin(inicio, f, diaDePago(historial, inicio));
      if (nuevo > fin) fin = nuevo; // Nunca se le quitan días.
    }
    if (inicio !== f.fecha_inicio || fin !== f.fecha_fin) cambios.push({ id: f.id, inicio, fin });
    corrimiento = diasEntre(f.fecha_fin, fin);
    finOriginalAnterior = f.fecha_fin;
    historial.unshift({ id: f.id, socioId: f.socio_id, planId: "", planNombre: "", fechaInicio: inicio, fechaFin: fin, creadoEn: "", esVisita: false, porMeses: f.unidad === "meses" });
  }

  if (cambios.length > 0) respaldoAntesDeActualizar(db);
  db.exec("begin immediate");
  try {
    db.prepare("update contexto set usuario = ? where id = 1").run(QUIEN);
    const actualizar = db.prepare("update suscripciones set fecha_inicio = ?, fecha_fin = ? where id = ?");
    for (const c of cambios) actualizar.run(c.inicio, c.fin, c.id);
    db.prepare("update contexto set usuario = null where id = 1").run();
    db.prepare("insert into ajustes (clave, valor) values (?, ?)").run(MARCA_DIA_FIJO, `${new Date().toISOString()} · ${cambios.length} membresías`);
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}
