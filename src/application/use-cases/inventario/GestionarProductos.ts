import type { MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import {
  type DatosProducto,
  type EstadoStock,
  estadoDeStock,
  margenDe,
  type Producto,
  validarProducto,
} from "@/domain/entities/Producto";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export interface ProductoConEstado {
  producto: Producto;
  estado: EstadoStock;
}

export const FILTROS_PRODUCTOS = ["activos", "bajo", "agotado", "inactivos"] as const;
export type FiltroProductos = (typeof FILTROS_PRODUCTOS)[number];

export interface ListadoProductos {
  productos: ProductoConEstado[];
  conteos: Record<FiltroProductos, number>;
  /** Suma de stock × costo de los productos activos que tienen costo capturado. */
  valorInventario: number;
  unidades: number;
}

export class ListarProductos {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(opciones: { busqueda?: string; filtro?: FiltroProductos } = {}): Promise<ListadoProductos> {
    const filtro = opciones.filtro ?? "activos";
    const todos = (await this.productos.listar({ busqueda: opciones.busqueda })).map((producto) => ({
      producto,
      estado: estadoDeStock(producto),
    }));

    const conteos = Object.fromEntries(FILTROS_PRODUCTOS.map((f) => [f, 0])) as Record<FiltroProductos, number>;
    let valorInventario = 0;
    let unidades = 0;
    for (const fila of todos) {
      for (const f of FILTROS_PRODUCTOS) if (cumple(fila, f)) conteos[f]++;
      if (fila.producto.activo) {
        unidades += fila.producto.stock;
        valorInventario += fila.producto.stock * (fila.producto.costo ?? 0);
      }
    }

    return { productos: todos.filter((fila) => cumple(fila, filtro)), conteos, valorInventario, unidades };
  }
}

function cumple({ producto, estado }: ProductoConEstado, filtro: FiltroProductos): boolean {
  if (filtro === "inactivos") return !producto.activo;
  if (!producto.activo) return false;
  return filtro === "activos" || estado === filtro;
}

export interface DetalleProducto {
  producto: Producto;
  estado: EstadoStock;
  margen: number | null;
  movimientos: MovimientoInventario[];
}

export class ObtenerDetalleProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
  ) {}

  async ejecutar(productoId: string): Promise<DetalleProducto> {
    const producto = await this.productos.obtenerPorId(productoId);
    if (!producto) throw new NoEncontrado("El producto");
    const movimientos = await this.inventario.listarPorProducto(productoId, 50);
    return { producto, estado: estadoDeStock(producto), margen: margenDe(producto), movimientos };
  }
}

/** Da de alta un producto; el stock inicial queda registrado como la primera entrada. */
export class CrearProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosProducto, stockInicial: number): Promise<Producto> {
    const validos = validarProducto(datos);
    if (!Number.isInteger(stockInicial) || stockInicial < 0) {
      throw new ErrorDeDominio("El stock inicial debe ser un número entero, cero o mayor.");
    }
    const producto = await this.productos.crear(validos);
    if (stockInicial > 0) {
      await this.inventario.registrarMovimiento({
        productoId: producto.id,
        tipo: "entrada",
        cantidad: stockInicial,
        nota: "Inventario inicial",
        fecha: this.reloj.hoy(),
      });
    }
    return producto;
  }
}

export class EditarProducto {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(productoId: string, datos: DatosProducto): Promise<Producto> {
    const validos = validarProducto(datos);
    if (!(await this.productos.obtenerPorId(productoId))) throw new NoEncontrado("El producto");
    return this.productos.actualizar(productoId, validos);
  }
}

export class CambiarEstadoProducto {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(productoId: string, activo: boolean): Promise<void> {
    if (!(await this.productos.obtenerPorId(productoId))) throw new NoEncontrado("El producto");
    await this.productos.cambiarEstado(productoId, activo);
  }
}
