import type { FechaISO } from "../shared/fechas";

/**
 * Fuente de "hoy". Se inyecta para que las reglas de negocio no dependan
 * del reloj de la computadora y se puedan probar con cualquier fecha.
 */
export interface Reloj {
  hoy(): FechaISO;
}
