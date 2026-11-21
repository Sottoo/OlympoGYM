import { type FechaISO, diasEntre, sumarDias } from "../shared/fechas";

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
  /** Su plan se cuenta en meses (paga el mismo día de cada mes). */
  porMeses: boolean;
}

export type DatosNuevaSuscripcion = Omit<Suscripcion, "id" | "creadoEn" | "planNombre" | "esVisita" | "porMeses">;

/**
 * El día del mes en que le toca pagar a quien renueva por meses.
 *
 * Casi siempre es el día en que empieza (paga el 7 → su mes empieza el 7).
 * La única excepción es un mes que no trae su día: quien paga el 31 empieza
 * el 28 de febrero, pero su día sigue siendo el 31, así que en marzo vuelve a
 * pagar el 31 y no se queda en el 28. Eso solo se reconoce cuando el nuevo
 * periodo empieza el ÚLTIMO día del mes, justo después de un mes que empezó en
 * un día mayor (el 31 de enero → el 28 de febrero).
 *
 * Por eso se mira solo el mes inmediato anterior y nunca más atrás: las
 * membresías cobradas con la regla vieja (30 días exactos) van recorriendo su
 * día, y buscar el «día original» en ellas daba meses de 1 día o de 59. Si
 * pagó tarde o no hay mes anterior pegado, su día es el día en que pagó.
 */
export function diaDePago(historial: Suscripcion[], inicio: FechaISO): number {
  const dia = Number(inicio.slice(8, 10));
  if (sumarDias(inicio, 1).slice(8, 10) !== "01") return dia; // No es el último día del mes: su día es este.
  const anterior = historial.find((s) => !s.esVisita && s.porMeses && s.fechaFin === sumarDias(inicio, -1));
  if (!anterior) return dia;
  // El anterior también pudo empezar en el último día de un mes corto (planes de 2 o 3 meses:
  // 31 jul → 30 sep → 30 nov): se le pregunta su día a él. Solo se sigue por inicios en último
  // día de mes, cada vez más atrás, así que termina y nunca llega a las fechas recorridas de 30 días.
  const diaAnterior = diaDePago(historial, anterior.fechaInicio);
  return diaAnterior > dia ? diaAnterior : dia;
}

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
 * Aviso de "por vencer": un día antes. En la mensualidad que empezó el 7 el
 * aviso sale el día 5 del mes siguiente (le queda 1 día) y sigue el 6, cuando vence.
 * Así recepción le recuerda al socio justo a tiempo para renovar.
 */
export const DIAS_PARA_POR_VENCER = 1;


export interface SituacionMembresia {
  estado: EstadoMembresia;
  /** Días que le quedan para entrar (0 = hoy es su último día, negativo = días vencida). Decide si pasa. */
  diasRestantes: number | null;
  /** Último día que puede entrar (inclusive). */
  fechaFin: FechaISO | null;
  /**
   * El día que le toca volver a pagar: el que se le muestra a recepción y al
   * socio como «Vence». Quien pagó el 21 ve «vence el 21» del mes siguiente,
   * aunque su último día para entrar sea el 20. En una visita es el mismo día.
   */
  fechaDePago: FechaISO | null;
  /** Días para `fechaDePago` (0 = hoy le toca pagar, negativo = días de atraso). Es lo que se muestra. */
  diasParaPagar: number | null;
}

/** El día que le toca volver a pagar: el siguiente a su último día (la visita, ese mismo día). */
export function fechaDePago(s: Pick<Suscripcion, "fechaFin" | "esVisita">): FechaISO {
  return s.esVisita ? s.fechaFin : sumarDias(s.fechaFin, 1);
}

export function situacionDeMembresia(suscripcion: Suscripcion | null, hoy: FechaISO): SituacionMembresia {
  if (!suscripcion) return { estado: "sin_plan", diasRestantes: null, fechaFin: null, fechaDePago: null, diasParaPagar: null };

  const diasRestantes = diasEntre(hoy, suscripcion.fechaFin);
  const estado: EstadoMembresia =
    diasRestantes < 0 ? "vencida" : diasRestantes <= DIAS_PARA_POR_VENCER ? "por_vencer" : "vigente";
  const pago = fechaDePago(suscripcion);

  return { estado, diasRestantes, fechaFin: suscripcion.fechaFin, fechaDePago: pago, diasParaPagar: diasEntre(hoy, pago) };
}
