import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { type FechaISO, sumarDias } from "../shared/fechas";
import { LIMITES, limpiarEspacios, revisarDinero, revisarEntero } from "../shared/reglas";

export type UnidadDuracion = "dias" | "semanas" | "meses";

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracion: number;
  unidad: UnidadDuracion;
  activo: boolean;
}

export type DatosNuevoPlan = Omit<Plan, "id" | "activo">;

/**
 * Un plan de 1 día es la "visita": lo que paga quien llega sin membresía.
 * No se trata como membresía (no vence).
 */
export function esPlanDeVisita(plan: Pick<Plan, "duracion" | "unidad">): boolean {
  return plan.unidad === "dias" && plan.duracion === 1;
}

const UNIDADES: UnidadDuracion[] = ["dias", "semanas", "meses"];

/** Duración máxima por unidad: un año en días o semanas, tres años en meses. */
export const DURACION_MAXIMA: Record<UnidadDuracion, number> = { dias: 365, semanas: 52, meses: 36 };

export function validarNuevoPlan(datos: DatosNuevoPlan): DatosNuevoPlan {
  const nombre = limpiarEspacios(datos.nombre);
  if (nombre.length < 3) throw new ErrorDeDominio("El nombre del plan debe tener al menos 3 caracteres.", "nombre");
  if (nombre.length > LIMITES.nombrePlan) throw new ErrorDeDominio(`El nombre puede tener hasta ${LIMITES.nombrePlan} caracteres.`, "nombre");
  if (!/[\p{L}]/u.test(nombre)) throw new ErrorDeDominio("El nombre del plan debe llevar letras (ej. Mensual).", "nombre");
  const descripcion = datos.descripcion ? limpiarEspacios(datos.descripcion) || null : null;
  if (descripcion && descripcion.length > LIMITES.descripcionPlan) {
    throw new ErrorDeDominio(`La descripción puede tener hasta ${LIMITES.descripcionPlan} caracteres.`, "descripcion");
  }
  const errorPrecio = revisarDinero(datos.precio, { minExclusivo: true, que: "El precio" });
  if (errorPrecio) throw new ErrorDeDominio(errorPrecio, "precio");
  if (!UNIDADES.includes(datos.unidad)) throw new ErrorDeDominio("La unidad de duración no es válida.", "unidad");
  const errorDuracion = revisarEntero(datos.duracion, { min: 1, max: DURACION_MAXIMA[datos.unidad], que: "La duración" });
  if (errorDuracion) throw new ErrorDeDominio(errorDuracion, "duracion");
  return { ...datos, nombre, precio: Math.round(datos.precio * 100) / 100, descripcion };
}

/** Días que cuenta cada unidad. Un mes del gimnasio son 30 días exactos, no un mes de calendario. */
export const DIAS_POR_UNIDAD: Record<UnidadDuracion, number> = { dias: 1, semanas: 7, meses: 30 };

/** Cuántos días dura un plan en total (un plan de 2 meses = 60 días). */
export function diasDelPlan(plan: Pick<Plan, "duracion" | "unidad">): number {
  return plan.duracion * DIAS_POR_UNIDAD[plan.unidad];
}

/**
 * Último día en que la membresía es válida (inclusive).
 * La mensualidad dura 30 días exactos: la que empieza el 1 de octubre vale
 * hasta el 30 de octubre, y la que empieza el 31 de enero, hasta el 1 de
 * marzo. Así todos pagan lo mismo por los mismos días, sin importar si el mes
 * trae 28 o 31.
 */
export function calcularFechaFin(inicio: FechaISO, plan: Pick<Plan, "duracion" | "unidad">): FechaISO {
  return sumarDias(inicio, diasDelPlan(plan) - 1);
}

export function describirDuracion(plan: Pick<Plan, "duracion" | "unidad">): string {
  const singular = { dias: "día", semanas: "semana", meses: "mes" }[plan.unidad];
  const plural = { dias: "días", semanas: "semanas", meses: "meses" }[plan.unidad];
  const texto = `${plan.duracion} ${plan.duracion === 1 ? singular : plural}`;
  // Los meses se aclaran en días: "1 mes (30 días)".
  return plan.unidad === "meses" ? `${texto} (${diasDelPlan(plan)} días)` : texto;
}
