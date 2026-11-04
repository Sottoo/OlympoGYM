import type { FechaISO } from "../shared/fechas";
import type { DatosProducto, Producto } from "../entities/Producto";

export interface ProductoRepository {
  listar(filtro?: { busqueda?: string; soloActivos?: boolean }): Promise<Producto[]>;
  obtenerPorId(id: string): Promise<Producto | null>;
  /** El inventario inicial (si hay) entra como su primer movimiento, en la misma operación. */
  crear(datos: DatosProducto, inicial?: { cantidad: number; fecha: FechaISO }): Promise<Producto>;
  /** Alta de varios productos (con su existencia inicial) en una sola operación. */
  crearVarios(lote: { datos: DatosProducto; inicial: number; nota?: string }[], fecha: FechaISO): Promise<Producto[]>;
  obtenerPorCodigo(codigo: string): Promise<Producto | null>;
  actualizar(id: string, datos: DatosProducto): Promise<Producto>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
  /** Anota la ruta de su foto (null = sin foto). */
  cambiarFoto(id: string, ruta: string | null): Promise<void>;
  /** Si ya se vendió alguna vez (entonces no se puede eliminar sin perder historial). */
  tieneVentas(id: string): Promise<boolean>;
  /** Borra el producto y sus movimientos. Solo para altas por error, sin ventas. */
  eliminar(id: string): Promise<void>;
}
