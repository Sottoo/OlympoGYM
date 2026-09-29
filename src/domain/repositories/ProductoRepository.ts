import type { DatosProducto, Producto } from "../entities/Producto";

export interface ProductoRepository {
  listar(filtro?: { busqueda?: string; soloActivos?: boolean }): Promise<Producto[]>;
  obtenerPorId(id: string): Promise<Producto | null>;
  /** Se crea con stock 0; el inventario inicial entra como movimiento. */
  crear(datos: DatosProducto): Promise<Producto>;
  actualizar(id: string, datos: DatosProducto): Promise<Producto>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
}
