import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { esFechaValida, type FechaISO, sumarDias } from "../shared/fechas";
import { LIMITES, limpiarEspacios, revisarDinero } from "../shared/reglas";
import { METODOS_PAGO, type MetodoPago } from "./Pago";

/**
 * Nómina: lo que se les paga a los empleados del gimnasio, por semana (de
 * lunes a viernes). Los empleados no son cuentas del programa: solo se
 * registra a quién se le paga. Un pago por empleado y semana. El pago en
 * efectivo sale de la caja del día en que se paga.
 */

export interface Empleado {
  id: string;
  nombre: string;
  puesto: string | null;
  /** Lo que se le paga normalmente por semana (se propone al pagarle). */
  sueldoSemanal: number | null;
  activo: boolean;
  creadoEn: string;
}

export interface DatosEmpleado {
  nombre: string;
  puesto: string | null;
  sueldoSemanal: number | null;
}

export interface PagoNomina {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  /** El lunes de la semana que se paga (AAAA-MM-DD). */
  semana: FechaISO;
  monto: number;
  metodo: MetodoPago;
  /** El día en que se pagó (entra en el corte de ese día). */
  fecha: FechaISO;
  nota: string | null;
  creadoEn: string;
}

export interface DatosPagoNomina {
  empleadoId: string;
  semana: FechaISO;
  monto: number;
  metodo: MetodoPago;
  nota: string | null;
}

/** Hasta cuántas semanas atrás se puede pagar una semana que quedó pendiente. */
export const SEMANAS_ATRAS_PARA_PAGAR = 8;

/** Día de la semana (0 = domingo … 6 = sábado) de una fecha AAAA-MM-DD. */
function diaDeLaSemana(fecha: FechaISO): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** El lunes de la semana de esa fecha (el domingo cuenta como fin de la semana que empezó el lunes anterior). */
export function lunesDe(fecha: FechaISO): FechaISO {
  const dia = diaDeLaSemana(fecha);
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/** El viernes de la semana que empieza en ese lunes. */
export const viernesDe = (lunes: FechaISO): FechaISO => sumarDias(lunes, 4);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "del 3 al 7 de noviembre" · "del 28 de octubre al 1 de noviembre" · con año si cruza de año. */
export function describirSemana(lunes: FechaISO): string {
  const viernes = viernesDe(lunes);
  const [a1, m1, d1] = lunes.split("-").map(Number);
  const [a2, m2, d2] = viernes.split("-").map(Number);
  if (a1 !== a2) return `del ${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  if (m1 !== m2) return `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
  return `del ${d1} al ${d2} de ${MESES[m1 - 1]}`;
}

/**
 * La semana que toca pagar hoy: desde el viernes, la de esta semana; de lunes
 * a jueves, todavía la de la semana pasada (por si no se pagó).
 */
export function semanaQueTocaPagar(hoy: FechaISO): FechaISO {
  const dia = diaDeLaSemana(hoy);
  const lunes = lunesDe(hoy);
  return dia === 5 || dia === 6 || dia === 0 ? lunes : sumarDias(lunes, -7);
}

export function validarEmpleado(datos: DatosEmpleado): DatosEmpleado {
  const nombre = limpiarEspacios(datos.nombre);
  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del empleado.", "nombre");
  if (nombre.length > LIMITES.nombrePlan) throw new ErrorDeDominio(`El nombre puede tener hasta ${LIMITES.nombrePlan} caracteres.`, "nombre");
  const puesto = datos.puesto ? limpiarEspacios(datos.puesto) || null : null;
  if (puesto && puesto.length > LIMITES.nombrePlan) throw new ErrorDeDominio(`El puesto puede tener hasta ${LIMITES.nombrePlan} caracteres.`, "puesto");
  let sueldoSemanal: number | null = null;
  if (datos.sueldoSemanal !== null && datos.sueldoSemanal !== undefined && !Number.isNaN(datos.sueldoSemanal)) {
    const error = revisarDinero(datos.sueldoSemanal, { que: "El sueldo" });
    if (error) throw new ErrorDeDominio(error, "sueldoSemanal");
    sueldoSemanal = Math.round(datos.sueldoSemanal * 100) / 100;
  }
  return { nombre, puesto, sueldoSemanal };
}

/** Revisa un pago de nómina. `hoy` sirve para no pagar semanas que no han empezado ni demasiado viejas. */
export function validarPagoNomina(datos: DatosPagoNomina, hoy: FechaISO): DatosPagoNomina {
  if (!datos.empleadoId) throw new ErrorDeDominio("Elige a quién se le paga.", "empleadoId");
  if (!esFechaValida(datos.semana) || lunesDe(datos.semana) !== datos.semana) throw new ErrorDeDominio("Elige la semana que se paga.", "semana");
  if (datos.semana > lunesDe(hoy)) throw new ErrorDeDominio("Esa semana todavía no empieza: no se puede pagar por adelantado.", "semana");
  if (datos.semana < sumarDias(lunesDe(hoy), -7 * SEMANAS_ATRAS_PARA_PAGAR)) {
    throw new ErrorDeDominio(`Solo se pueden pagar semanas de hasta ${SEMANAS_ATRAS_PARA_PAGAR} semanas atrás.`, "semana");
  }
  const errorMonto = revisarDinero(datos.monto, { minExclusivo: true, que: "La cantidad" });
  if (errorMonto) throw new ErrorDeDominio(errorMonto, "monto");
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige cómo se le pagó.", "metodoPago");
  const nota = datos.nota?.trim() || null;
  if (nota && nota.length > LIMITES.nota) throw new ErrorDeDominio(`La nota puede tener hasta ${LIMITES.nota} caracteres.`, "nota");
  return { ...datos, monto: Math.round(datos.monto * 100) / 100, nota };
}
