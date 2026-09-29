import type { FechaISO } from "../shared/fechas";

/**
 * Cada cambio de stock queda registrado como un movimiento.
 * - entrada: llega mercancía del proveedor (+)
 * - venta:   se vendió en mostrador (−)
 * - merma:   caducado, dañado o perdido (−)
 * - ajuste:  corrección tras un conteo físico (+ o −)
 */
export type TipoMovimiento = "entrada" | "venta" | "merma" | "ajuste";

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: "Entrada",
  venta: "Venta",
  merma: "Merma",
  ajuste: "Ajuste por conteo",
};

export interface MovimientoInventario {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  /** Cambio en el stock: positivo suma, negativo resta. */
  cantidad: number;
  ventaId: string | null;
  precioUnitario: number | null;
  nota: string | null;
  fecha: FechaISO;
  creadoEn: string;
}

/** Movimientos manuales (las ventas se registran con su propio caso de uso). */
export interface DatosNuevoMovimiento {
  productoId: string;
  tipo: Exclude<TipoMovimiento, "venta">;
  cantidad: number;
  nota: string | null;
  fecha: FechaISO;
}
