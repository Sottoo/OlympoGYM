import type { DatosNuevoMovimiento, MovimientoInventario } from "../entities/MovimientoInventario";
import type { DatosProducto } from "../entities/Producto";
import type { FechaISO } from "../shared/fechas";

export interface InventarioRepository {
  /**
   * Registra el movimiento y actualiza el stock en una sola operación.
   * Debe rechazarlo (ErrorDeDominio) si el stock quedaría negativo.
   */
  registrarMovimiento(datos: DatosNuevoMovimiento): Promise<MovimientoInventario>;
  listarPorProducto(productoId: string, limite?: number): Promise<MovimientoInventario[]>;
  /** Varios movimientos juntos: o se guardan todos o ninguno. */
  registrarLote(lote: DatosNuevoMovimiento[]): Promise<void>;
  /** Altas de productos nuevos (con su existencia) y entradas de los que ya existen, en una sola operación. */
  recibir(nuevos: { datos: DatosProducto; inicial: number; nota?: string }[], entradas: DatosNuevoMovimiento[], fecha: FechaISO): Promise<void>;
  ventasPorProducto(desde: FechaISO, hasta: FechaISO): Promise<{ productoId: string; cantidad: number; dias: number; primera: string }[]>;
  ventasConHora(desde: FechaISO): Promise<{ productoId: string; instante: string; cantidad: number }[]>;
}
