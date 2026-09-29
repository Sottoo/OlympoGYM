import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { type FechaISO, sumarDias, sumarMeses } from "../shared/fechas";

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

const UNIDADES: UnidadDuracion[] = ["dias", "semanas", "meses"];

export function validarNuevoPlan(datos: DatosNuevoPlan): DatosNuevoPlan {
  const nombre = datos.nombre.trim();
  if (nombre.length < 3) throw new ErrorDeDominio("El nombre del plan debe tener al menos 3 letras.");
  if (!Number.isFinite(datos.precio) || datos.precio < 0) throw new ErrorDeDominio("El precio no es válido.");
  if (!Number.isInteger(datos.duracion) || datos.duracion < 1) {
    throw new ErrorDeDominio("La duración debe ser un número entero mayor a cero.");
  }
  if (!UNIDADES.includes(datos.unidad)) throw new ErrorDeDominio("La unidad de duración no es válida.");
  return { ...datos, nombre, descripcion: datos.descripcion?.trim() || null };
}

/**
 * Último día en que la membresía es válida (inclusive).
 * Un plan mensual que inicia el 1 de sept. vence el 30 de sept.
 */
export function calcularFechaFin(inicio: FechaISO, plan: Pick<Plan, "duracion" | "unidad">): FechaISO {
  const siguientePeriodo =
    plan.unidad === "meses"
      ? sumarMeses(inicio, plan.duracion)
      : sumarDias(inicio, plan.duracion * (plan.unidad === "semanas" ? 7 : 1));
  return sumarDias(siguientePeriodo, -1);
}

export function describirDuracion(plan: Pick<Plan, "duracion" | "unidad">): string {
  const singular = { dias: "día", semanas: "semana", meses: "mes" }[plan.unidad];
  const plural = { dias: "días", semanas: "semanas", meses: "meses" }[plan.unidad];
  return `${plan.duracion} ${plan.duracion === 1 ? singular : plural}`;
}
