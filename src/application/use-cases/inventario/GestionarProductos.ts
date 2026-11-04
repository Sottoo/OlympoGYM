import type { MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import {
  type CategoriaProducto,
  type DatosProducto,
  type EstadoStock,
  estadoDeStock,
  costoPorUnidad,
  esGranel,
  margenDe,
  type Producto,
  validarProducto,
} from "@/domain/entities/Producto";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import type { Reloj } from "@/domain/services/Reloj";
import { revisarEntero } from "@/domain/shared/reglas";
import { claveDeNombre } from "@/domain/shared/texto";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { revisarFoto } from "@/domain/shared/imagen";

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
  /** Piezas de los productos activos por categoría (sin granel), de más a menos. */
  piezasPorCategoria: { categoria: CategoriaProducto; piezas: number }[];
  /** Productos activos a los que les falta el costo (no entran al valor del inventario). */
  sinCosto: number;
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
    let sinCosto = 0;
    const porCategoria = new Map<CategoriaProducto, number>();
    for (const fila of todos) {
      for (const f of FILTROS_PRODUCTOS) if (cumple(fila, f)) conteos[f]++;
      if (fila.producto.activo) {
        if (!esGranel(fila.producto)) {
          unidades += fila.producto.stock;
          porCategoria.set(fila.producto.categoria, (porCategoria.get(fila.producto.categoria) ?? 0) + fila.producto.stock);
        }
        if (fila.producto.costo === null) sinCosto++;
        valorInventario += fila.producto.stock * (costoPorUnidad(fila.producto) ?? 0);
      }
    }

    const piezasPorCategoria = [...porCategoria.entries()].map(([categoria, piezas]) => ({ categoria, piezas })).sort((a, b) => b.piezas - a.piezas);
    return { productos: todos.filter((fila) => cumple(fila, filtro)), conteos, valorInventario, unidades, piezasPorCategoria, sinCosto };
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
  /** Si ya se vendió: entonces solo se puede desactivar, no eliminar. */
  tieneVentas: boolean;
}

export class ObtenerDetalleProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
  ) {}

  async ejecutar(productoId: string): Promise<DetalleProducto> {
    const producto = await this.productos.obtenerPorId(productoId);
    if (!producto) throw new NoEncontrado("El producto");
    const [movimientos, tieneVentas] = await Promise.all([this.inventario.listarPorProducto(productoId, 50), this.productos.tieneVentas(productoId)]);
    return { producto, estado: estadoDeStock(producto), margen: margenDe(producto), movimientos, tieneVentas };
  }
}

/**
 * Si el nombre o el código ya los usa otro producto, explica qué hacer. Sobre
 * todo cuando el otro está desactivado: no se da de alta dos veces, se reactiva
 * (así conserva su historial).
 */
export function revisarRepetidos(
  existentes: Producto[],
  datos: { nombre: string; codigo?: string | null },
  excluirId?: string,
): { mensaje: string; campo: "nombre" | "codigo"; producto: Producto } | null {
  const otros = existentes.filter((p) => p.id !== excluirId);
  const nombre = claveDeNombre(datos.nombre);
  const mismoNombre = nombre ? otros.find((p) => claveDeNombre(p.nombre) === nombre) : undefined;
  if (mismoNombre) {
    return {
      campo: "nombre",
      producto: mismoNombre,
      mensaje: mismoNombre.activo
        ? `Ya tienes un producto llamado «${mismoNombre.nombre}». Si es otro distinto, agrégale el sabor, tamaño o marca para distinguirlo.`
        : `«${mismoNombre.nombre}» ya existe, pero está desactivado. No hace falta darlo de alta otra vez: búscalo en Inventario › Desactivados y pulsa «Reactivar».`,
    };
  }
  const codigo = datos.codigo?.trim().toLowerCase();
  const mismoCodigo = codigo ? otros.find((p) => p.codigo?.toLowerCase() === codigo) : undefined;
  if (mismoCodigo) {
    return {
      campo: "codigo",
      producto: mismoCodigo,
      mensaje: mismoCodigo.activo
        ? `Ese código ya es de «${mismoCodigo.nombre}».`
        : `Ese código es de «${mismoCodigo.nombre}», que está desactivado. Reactívalo en Inventario › Desactivados en lugar de darlo de alta otra vez.`,
    };
  }
  return null;
}

/** Mientras se llena el formulario: avisa si el nombre o el código ya están en uso. */
export class RevisarProducto {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(campo: "nombre" | "codigo", valor: string, excluirId?: string): Promise<{ mensaje: string; producto: Producto } | null> {
    const repetido = revisarRepetidos(await this.productos.listar(), campo === "nombre" ? { nombre: valor } : { nombre: "", codigo: valor }, excluirId);
    return repetido ? { mensaje: repetido.mensaje, producto: repetido.producto } : null;
  }
}

/** Da de alta un producto; el stock inicial queda registrado como la primera entrada. */
export class CrearProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosProducto, stockInicial: number): Promise<Producto> {
    const validos = validarProducto(datos);
    const repetido = revisarRepetidos(await this.productos.listar(), validos);
    if (repetido) throw new ErrorDeDominio(repetido.mensaje, repetido.campo);
    const errorStock = revisarEntero(stockInicial, { min: 0, max: 1_000_000, que: "La existencia" });
    if (errorStock) throw new ErrorDeDominio(errorStock, "stockInicial");
    return this.productos.crear(validos, { cantidad: stockInicial, fecha: this.reloj.hoy() });
  }
}

export class EditarProducto {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(productoId: string, datos: DatosProducto): Promise<Producto> {
    const validos = validarProducto(datos);
    const actual = await this.productos.obtenerPorId(productoId);
    if (!actual) throw new NoEncontrado("El producto");
    const repetido = revisarRepetidos(await this.productos.listar(), validos, productoId);
    if (repetido) throw new ErrorDeDominio(repetido.mensaje, repetido.campo);
    // La existencia está en piezas o en gramos: cambiar la forma de venta con mercancía la volvería incorrecta.
    if (actual.unidad !== validos.unidad && actual.stock !== 0) {
      throw new ErrorDeDominio("Para cambiar cómo se vende, primero deja su existencia en 0 con un ajuste por conteo.", "unidad");
    }
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

/**
 * Borra un producto dado de alta por error. Si ya tiene ventas no se puede
 * (se perdería el historial de caja): entonces se desactiva.
 */
export class EliminarProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(productoId: string): Promise<string> {
    const producto = await this.productos.obtenerPorId(productoId);
    if (!producto) throw new NoEncontrado("El producto");
    if (await this.productos.tieneVentas(productoId)) {
      throw new ErrorDeDominio("Este producto ya tiene ventas, y eliminarlo borraría ese historial. Mejor desactívalo: deja de aparecer en la Tienda y se conserva todo.");
    }
    await this.productos.eliminar(productoId);
    if (producto.foto) await this.fotos.borrar(producto.foto).catch(() => undefined);
    return producto.nombre;
  }
}

/** Pone o reemplaza la foto del producto. La anterior se borra para no ocupar espacio. */
export class CambiarFotoProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(productoId: string, imagen: Uint8Array, tipo: string): Promise<void> {
    revisarFoto(imagen, tipo);
    const producto = await this.productos.obtenerPorId(productoId);
    if (!producto) throw new NoEncontrado("El producto");
    const anterior = producto.foto;
    const ruta = await this.fotos.guardar(productoId, imagen, tipo);
    await this.productos.cambiarFoto(productoId, ruta);
    if (anterior) await this.fotos.borrar(anterior).catch(() => undefined);
  }
}

/** Quita la foto: el producto vuelve a verse con su dibujo bordado. */
export class QuitarFotoProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(productoId: string): Promise<void> {
    const anterior = (await this.productos.obtenerPorId(productoId))?.foto;
    if (!anterior) return;
    await this.productos.cambiarFoto(productoId, null);
    await this.fotos.borrar(anterior).catch(() => undefined);
  }
}
