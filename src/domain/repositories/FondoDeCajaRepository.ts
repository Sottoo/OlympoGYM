import type { FondoDeCaja } from "../entities/FondoDeCaja";
import type { FechaISO } from "../shared/fechas";

export interface FondoDeCajaRepository {
  delDia(fecha: FechaISO): Promise<FondoDeCaja | null>;
  /** El último fondo anotado antes de ese día (para sugerirlo). */
  ultimoAntesDe(fecha: FechaISO): Promise<FondoDeCaja | null>;
  /** Anota el fondo del día; si ya había uno, lo corrige. */
  guardar(fecha: FechaISO, monto: number): Promise<FondoDeCaja>;
}
