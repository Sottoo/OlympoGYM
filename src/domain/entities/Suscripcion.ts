import { type FechaISO, diasEntre } from "../shared/fechas";

export interface Suscripcion {
  id: string;
  socioId: string;
  planId: string;
  planNombre: string;
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  creadoEn: string;
}

export type DatosNuevaSuscripcion = Omit<Suscripcion, "id" | "creadoEn" | "planNombre">;

export type EstadoMembresia = "vigente" | "por_vencer" | "vencida" | "sin_plan";

/** Con cuántos días de anticipación una membresía se considera "por vencer". */
export const DIAS_PARA_POR_VENCER = 7;

/** Días antes del vencimiento en que conviene mandarle recordatorio al socio. */
export const DIAS_DE_AVISO = [7, 3, 1] as const;

export type EtapaDeAviso = (typeof DIAS_DE_AVISO)[number];

/**
 * Qué recordatorio le toca según los días que le quedan: el de 7 días cubre
 * de 7 a 4, el de 3 cubre 3 y 2, y el de 1 cubre mañana y hoy. Así, si un día
 * no se abrió el sistema, el aviso sigue pendiente hasta la siguiente etapa.
 */
export function etapaDeAviso(diasRestantes: number): EtapaDeAviso | null {
  if (diasRestantes < 0) return null;
  return [...DIAS_DE_AVISO].reverse().find((dias) => diasRestantes <= dias) ?? null;
}

export interface SituacionMembresia {
  estado: EstadoMembresia;
  /** Días que le quedan (0 = vence hoy, negativo = días vencida). */
  diasRestantes: number | null;
  fechaFin: FechaISO | null;
}

export function situacionDeMembresia(suscripcion: Suscripcion | null, hoy: FechaISO): SituacionMembresia {
  if (!suscripcion) return { estado: "sin_plan", diasRestantes: null, fechaFin: null };

  const diasRestantes = diasEntre(hoy, suscripcion.fechaFin);
  const estado: EstadoMembresia =
    diasRestantes < 0 ? "vencida" : diasRestantes <= DIAS_PARA_POR_VENCER ? "por_vencer" : "vigente";

  return { estado, diasRestantes, fechaFin: suscripcion.fechaFin };
}
