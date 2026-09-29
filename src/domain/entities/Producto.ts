import { ErrorDeDominio } from "../shared/ErrorDeDominio";

export type CategoriaProducto = "suplementos" | "bebidas" | "snacks" | "accesorios" | "ropa" | "otros";

export const CATEGORIAS_PRODUCTO: Record<CategoriaProducto, string> = {
  suplementos: "Suplementos",
  bebidas: "Bebidas",
  snacks: "Snacks",
  accesorios: "Accesorios",
  ropa: "Ropa",
  otros: "Otros",
};

export interface Producto {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  /** Código de barras o clave interna (opcional). */
  codigo: string | null;
  precioVenta: number;
  /** Lo que le cuesta al gimnasio cada pieza (opcional, para calcular margen). */
  costo: number | null;
  /** Solo cambia con movimientos de inventario; nunca se edita directamente. */
  stock: number;
  /** Con esta cantidad o menos, el producto se marca como "stock bajo". */
  stockMinimo: number;
  activo: boolean;
  creadoEn: string;
}

export type DatosProducto = Pick<Producto, "nombre" | "categoria" | "codigo" | "precioVenta" | "costo" | "stockMinimo">;

export type EstadoStock = "agotado" | "bajo" | "suficiente";

export function validarProducto(datos: DatosProducto): DatosProducto {
  const nombre = datos.nombre.trim();
  const codigo = datos.codigo?.trim() || null;
  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del producto.");
  if (!(datos.categoria in CATEGORIAS_PRODUCTO)) throw new ErrorDeDominio("Elige una categoría.");
  if (!Number.isFinite(datos.precioVenta) || datos.precioVenta < 0) throw new ErrorDeDominio("El precio de venta no es válido.");
  if (datos.costo !== null && (!Number.isFinite(datos.costo) || datos.costo < 0)) {
    throw new ErrorDeDominio("El costo no es válido.");
  }
  if (!Number.isInteger(datos.stockMinimo) || datos.stockMinimo < 0) {
    throw new ErrorDeDominio("El stock mínimo debe ser un número entero, cero o mayor.");
  }
  return { ...datos, nombre, codigo };
}

export function estadoDeStock(producto: Pick<Producto, "stock" | "stockMinimo">): EstadoStock {
  if (producto.stock <= 0) return "agotado";
  if (producto.stock <= producto.stockMinimo) return "bajo";
  return "suficiente";
}

/** Margen de ganancia como fracción del precio (0.3 = 30 %). Null si no hay costo. */
export function margenDe(producto: Pick<Producto, "precioVenta" | "costo">): number | null {
  if (producto.costo === null || producto.precioVenta <= 0) return null;
  return (producto.precioVenta - producto.costo) / producto.precioVenta;
}
