import type { FechaISO } from "../shared/fechas";

/**
 * Fuente de "hoy" y "ahora". Se inyecta para que las reglas de negocio no
 * dependan del reloj de la computadora y se puedan probar con cualquier fecha.
 */
export interface Reloj {
  hoy(): FechaISO;
  /** Instante actual en ISO 8601 (UTC). */
  ahora(): string;
  /** Fecha y hora (0–23) locales del gimnasio para un instante. */
  local(instante: string): { fecha: FechaISO; hora: number };
}
