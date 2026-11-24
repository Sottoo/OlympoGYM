import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { conDiaDelMes, type FechaISO, primerDiaDelMes, sumarDias, sumarMeses } from "../shared/fechas";
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
  // Una membresía puede ser gratis ($0, por ejemplo una cortesía): en pantalla dice «Gratis».
  // La visita no: es lo que se cobra a quien llega sin membresía, y una visita gratis la tomaba
  // el mostrador para todos (pasó con una «visita para conocer» de $0.01).
  const visita = esPlanDeVisita(datos);
  const errorPrecio = revisarDinero(datos.precio, visita ? { minExclusivo: true, que: "El precio de la visita" } : { que: "El precio" });
  if (errorPrecio) throw new ErrorDeDominio(errorPrecio, "precio");
  if (!UNIDADES.includes(datos.unidad)) throw new ErrorDeDominio("La unidad de duración no es válida.", "unidad");
  const errorDuracion = revisarEntero(datos.duracion, { min: 1, max: DURACION_MAXIMA[datos.unidad], que: "La duración" });
  if (errorDuracion) throw new ErrorDeDominio(errorDuracion, "duracion");
  return { ...datos, nombre, precio: Math.round(datos.precio * 100) / 100, descripcion };
}

/** Días que cuenta cada unidad, solo para días y semanas: los meses van por día del mes (ver calcularFechaFin). */
export const DIAS_POR_UNIDAD: Record<Exclude<UnidadDuracion, "meses">, number> = { dias: 1, semanas: 7 };

/**
 * Último día en que la membresía es válida (inclusive).
 * Los meses van por día del mes, como en Netflix o Game Pass: quien paga el 7
 * vuelve a pagar el 7 (la que empieza el 7 de noviembre vale hasta el 6 de
 * diciembre). `diaDePago` es su día de siempre (ver diaDePago en Suscripcion):
 * si un mes no trae ese día, ese mes paga el último día, y al siguiente vuelve
 * a su día. Quien paga el 31 paga el 28 de febrero y el 31 de marzo.
 * Días y semanas siguen contando días exactos.
 */
export function calcularFechaFin(inicio: FechaISO, plan: Pick<Plan, "duracion" | "unidad">, diaDePago = Number(inicio.slice(8, 10))): FechaISO {
  if (plan.unidad === "meses") return sumarDias(conDiaDelMes(sumarMeses(primerDiaDelMes(inicio), plan.duracion), diaDePago), -1);
  return sumarDias(inicio, plan.duracion * DIAS_POR_UNIDAD[plan.unidad] - 1);
}

export function describirDuracion(plan: Pick<Plan, "duracion" | "unidad">): string {
  const singular = { dias: "día", semanas: "semana", meses: "mes" }[plan.unidad];
  const plural = { dias: "días", semanas: "semanas", meses: "meses" }[plan.unidad];
  return `${plan.duracion} ${plan.duracion === 1 ? singular : plural}`;
}
