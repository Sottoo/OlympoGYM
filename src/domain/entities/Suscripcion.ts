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

/**
 * Aviso de "por vencer": un día antes. En la mensualidad de 30 días el
 * aviso sale el día 29 (le queda 1 día) y sigue el día 30, cuando vence.
 * Así recepción le recuerda al socio justo a tiempo para renovar.
 */
export const DIAS_PARA_POR_VENCER = 1;


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
