import { type FechaISO, diasEntre } from "../shared/fechas";

export interface Suscripcion {
  id: string;
  socioId: string;
  planId: string;
  planNombre: string;
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  creadoEn: string;
  /** Pago de un solo día (plan de visita), no una membresía. */
  esVisita: boolean;
}

export type DatosNuevaSuscripcion = Omit<Suscripcion, "id" | "creadoEn" | "planNombre" | "esVisita">;

/**
 * La que define la situación del socio: su última membresía, o la visita
 * si la pagó hoy. Una visita pasada no cuenta (si no, "su plan" sería
 * «Visita, vencida» en lugar de la membresía que dejó de pagar).
 * Recibe las suscripciones ordenadas de la fecha de fin más reciente a la más antigua.
 */
export function suscripcionVigenteOUltima(suscripciones: Suscripcion[], hoy: FechaISO): Suscripcion | null {
  return suscripciones.find((s) => !s.esVisita || s.fechaFin >= hoy) ?? null;
}

export type EstadoMembresia = "vigente" | "por_vencer" | "vencida" | "sin_plan";

/** Con cuántos días de anticipación una membresía se considera "por vencer". */
export const DIAS_PARA_POR_VENCER = 7;

/**
 * Los planes cortos no pueden estar "por vencer" desde el día en que se
 * compran: un plan de 1 semana avisa en sus últimos 2 días, uno de 15 días en
 * los últimos 5, y de un mes en adelante con los 7 días de siempre.
 */
export function diasParaPorVencer(s: Pick<Suscripcion, "fechaInicio" | "fechaFin">): number {
  const duracion = diasEntre(s.fechaInicio, s.fechaFin) + 1;
  return Math.max(1, Math.min(DIAS_PARA_POR_VENCER, Math.floor(duracion / 3)));
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
    diasRestantes < 0 ? "vencida" : diasRestantes <= diasParaPorVencer(suscripcion) ? "por_vencer" : "vigente";

  return { estado, diasRestantes, fechaFin: suscripcion.fechaFin };
}
