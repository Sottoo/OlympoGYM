import type { DatosNuevoMovimiento, MovimientoInventario } from "../entities/MovimientoInventario";

export interface InventarioRepository {
  /**
   * Registra el movimiento y actualiza el stock en una sola operación.
   * Debe rechazarlo (ErrorDeDominio) si el stock quedaría negativo.
   */
  registrarMovimiento(datos: DatosNuevoMovimiento): Promise<MovimientoInventario>;
  listarPorProducto(productoId: string, limite?: number): Promise<MovimientoInventario[]>;
}
