import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { type FechaISO, sumarDias, sumarMeses } from "../shared/fechas";
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

/**
 * Último día en que la membresía es válida (inclusive).
 * Un plan mensual que inicia el 1 de sept. vence el 30 de sept.; el que
 * inicia el 31 de enero vence el 28 (o 29) de febrero, el último día de ese
 * mes, sin perder un día ni recorrer la fecha de corte en cada renovación.
 */
export function calcularFechaFin(inicio: FechaISO, plan: Pick<Plan, "duracion" | "unidad">): FechaISO {
  if (plan.unidad === "meses") {
    const mismoDia = sumarMeses(inicio, plan.duracion);
    // Si el mes destino no tiene ese día (31 → abril), sumarMeses ya dio su último día: ese es el fin.
    const recortado = Number(mismoDia.slice(8)) < Number(inicio.slice(8));
    return recortado ? mismoDia : sumarDias(mismoDia, -1);
  }
  return sumarDias(inicio, plan.duracion * (plan.unidad === "semanas" ? 7 : 1) - 1);
}

export function describirDuracion(plan: Pick<Plan, "duracion" | "unidad">): string {
  const singular = { dias: "día", semanas: "semana", meses: "mes" }[plan.unidad];
  const plural = { dias: "días", semanas: "semanas", meses: "meses" }[plan.unidad];
  return `${plan.duracion} ${plan.duracion === 1 ? singular : plural}`;
}
