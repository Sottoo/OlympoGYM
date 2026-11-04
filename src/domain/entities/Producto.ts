import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { pluralizar } from "../shared/texto";
import { LIMITES, limpiarEspacios, PATRON_CODIGO, revisarDinero, revisarEntero } from "../shared/reglas";

export type CategoriaProducto = "suplementos" | "bebidas" | "snacks" | "accesorios" | "ropa" | "otros";

export const CATEGORIAS_PRODUCTO: Record<CategoriaProducto, string> = {
  suplementos: "Suplementos",
  bebidas: "Bebidas",
  snacks: "Snacks",
  accesorios: "Accesorios",
  ropa: "Ropa",
  otros: "Otros",
};

/**
 * Cómo se vende y se cuenta un producto:
 *  · pieza: botellas, barras, shakers… (existencia en piezas).
 *  · gramo: a granel, como la proteína o la creatina que se sirven por scoop.
 *    La existencia se lleva en gramos; se vende por porción (p. ej. un scoop
 *    de 30 g) o por gramos exactos, y la mercancía entra por botes.
 */
export type UnidadProducto = "pieza" | "gramo";

export interface Producto {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  /** Código de barras o clave interna (opcional). */
  codigo: string | null;
  precioVenta: number;
  /** Lo que le cuesta al gimnasio cada pieza; a granel, cada envase (bote). Opcional, para el margen. */
  costo: number | null;
  /** Solo cambia con movimientos de inventario; nunca se edita directamente. Piezas o gramos. */
  stock: number;
  /** Con esta cantidad o menos, el producto se marca como "stock bajo". Piezas o gramos. */
  stockMinimo: number;
  unidad: UnidadProducto;
  /** A granel: cuántos gramos lleva una porción y cómo se le dice ("scoop", "servicio"). El precio es por porción. */
  porcionGramos: number | null;
  porcionNombre: string | null;
  /** A granel: cuántos gramos trae cada envase que llega del proveedor (un bote de 2 lb ≈ 907 g). */
  envaseGramos: number | null;
  /** Ruta de la foto en el almacén de archivos (null = sin foto: se ve su dibujo bordado). */
  foto: string | null;
  activo: boolean;
  creadoEn: string;
}

export type DatosProducto = Pick<
  Producto,
  "nombre" | "categoria" | "codigo" | "precioVenta" | "costo" | "stockMinimo" | "unidad" | "porcionGramos" | "porcionNombre" | "envaseGramos"
>;

export type EstadoStock = "agotado" | "bajo" | "suficiente";

export function validarProducto(datos: DatosProducto): DatosProducto {
  const nombre = limpiarEspacios(datos.nombre);
  const codigo = datos.codigo?.trim().toUpperCase() || null;
  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del producto.", "nombre");
  if (nombre.length > LIMITES.nombreProducto) throw new ErrorDeDominio(`El nombre puede tener hasta ${LIMITES.nombreProducto} caracteres.`, "nombre");
  if (!/[\p{L}]/u.test(nombre)) throw new ErrorDeDominio("El nombre del producto debe llevar letras.", "nombre");
  if (!Object.hasOwn(CATEGORIAS_PRODUCTO, datos.categoria)) throw new ErrorDeDominio("Elige una categoría.", "categoria");
  if (codigo && !PATRON_CODIGO.test(codigo)) throw new ErrorDeDominio("El código solo lleva letras sin acento, números y guion (máximo 30).", "codigo");
  const errorPrecio = revisarDinero(datos.precioVenta, { minExclusivo: true, que: "El precio de venta" });
  if (errorPrecio) throw new ErrorDeDominio(errorPrecio, "precioVenta");
  if (datos.costo !== null) {
    const errorCosto = revisarDinero(datos.costo, { que: "El costo" });
    if (errorCosto) throw new ErrorDeDominio(errorCosto, "costo");
  }
  const errorMinimo = revisarEntero(datos.stockMinimo, { min: 0, max: 1_000_000, que: "El stock mínimo" });
  if (errorMinimo) throw new ErrorDeDominio(errorMinimo, "stockMinimo");
  const centavos = (x: number) => Math.round(x * 100) / 100;
  const base = { ...datos, nombre, codigo, precioVenta: centavos(datos.precioVenta), costo: datos.costo === null ? null : centavos(datos.costo) };

  if (datos.unidad !== "gramo") return { ...base, unidad: "pieza", porcionGramos: null, porcionNombre: null, envaseGramos: null };

  const errorPorcion = revisarEntero(Number(datos.porcionGramos), { min: 1, max: 1000, que: "La porción" });
  if (errorPorcion) throw new ErrorDeDominio(errorPorcion, "porcionGramos");
  const porcionNombre = limpiarEspacios(datos.porcionNombre ?? "").toLowerCase() || "porción";
  if (porcionNombre.length > 20 || !/^[\p{L} ]+$/u.test(porcionNombre)) {
    throw new ErrorDeDominio("El nombre de la porción lleva solo letras (por ejemplo, scoop o servicio).", "porcionNombre");
  }
  if (datos.envaseGramos !== null) {
    const errorEnvase = revisarEntero(datos.envaseGramos, { min: 1, max: 50_000, que: "El contenido del envase" });
    if (errorEnvase) throw new ErrorDeDominio(errorEnvase, "envaseGramos");
  }
  if (base.costo !== null && datos.envaseGramos === null) {
    throw new ErrorDeDominio("Para usar el costo, indica cuántos gramos trae cada envase.", "envaseGramos");
  }
  return { ...base, unidad: "gramo", porcionGramos: Number(datos.porcionGramos), porcionNombre, envaseGramos: datos.envaseGramos };
}

export const esGranel = (p: Pick<Producto, "unidad">) => p.unidad === "gramo";

/** Precio de una unidad de existencia: la pieza, o el gramo a granel. */
export function precioPorUnidad(p: Pick<Producto, "unidad" | "precioVenta" | "porcionGramos">): number {
  return esGranel(p) && p.porcionGramos ? p.precioVenta / p.porcionGramos : p.precioVenta;
}

/** Costo de una unidad de existencia (pieza o gramo). Null si no hay costo capturado. */
export function costoPorUnidad(p: Pick<Producto, "unidad" | "costo" | "envaseGramos">): number | null {
  if (p.costo === null) return null;
  if (!esGranel(p)) return p.costo;
  return p.envaseGramos ? p.costo / p.envaseGramos : null;
}

/** Importe de vender `cantidad` (piezas o gramos), redondeado a centavos. */
export function importeDe(p: Pick<Producto, "unidad" | "precioVenta" | "porcionGramos">, cantidad: number): number {
  return Math.round(cantidad * precioPorUnidad(p) * 100) / 100;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-MX");
const enPlural = (palabra: string, n: number) => pluralizar(palabra, n);

/** "12 piezas" o, a granel, "1,840 g". */
export function describirCantidad(p: Pick<Producto, "unidad">, cantidad: number): string {
  return esGranel(p) ? `${miles(cantidad)} g` : `${miles(cantidad)} ${cantidad === 1 ? "pieza" : "piezas"}`;
}

/**
 * A granel, la existencia como se cuenta en el anaquel: "2 botes" (o "60 scoops"
 * si no tiene bote) y, aparte, el detalle en gramos.
 */
export function existenciaGranel(p: Pick<Producto, "porcionGramos" | "porcionNombre" | "envaseGramos">, gramos: number): { principal: string; detalle: string } {
  const porciones = Math.floor(gramos / (p.porcionGramos || 1));
  const enPorciones = `${miles(porciones)} ${enPlural(p.porcionNombre ?? "porción", porciones)}`;
  if (p.envaseGramos && gramos >= p.envaseGramos) {
    const botes = gramos / p.envaseGramos;
    const r = botes >= 10 ? Math.round(botes) : Math.round(botes * 10) / 10;
    return { principal: `${r.toLocaleString("es-MX")} ${r === 1 ? "bote" : "botes"}`, detalle: `${miles(gramos)} g · ≈ ${enPorciones}` };
  }
  // Menos de un bote: se cuenta mejor en porciones ("10 scoops" en vez de "0.1 botes").
  if (p.envaseGramos && gramos > 0) {
    const botes = Math.round((gramos / p.envaseGramos) * 10) / 10;
    return { principal: enPorciones, detalle: `${miles(gramos)} g${botes > 0 ? ` · ${botes.toLocaleString("es-MX")} botes` : ""}` };
  }
  if (p.envaseGramos) return { principal: "0 botes", detalle: "0 g" };
  return { principal: enPorciones, detalle: `${miles(gramos)} g` };
}

/** Un movimiento a granel en la medida más natural: "2 botes", "1 scoop" o "45 g". */
export function cantidadCorta(p: Pick<Producto, "unidad" | "porcionGramos" | "porcionNombre" | "envaseGramos">, cantidad: number): string {
  const n = Math.abs(cantidad);
  if (!esGranel(p)) return miles(n);
  if (p.envaseGramos && n % p.envaseGramos === 0) return `${miles(n / p.envaseGramos)} ${n === p.envaseGramos ? "bote" : "botes"}`;
  if (p.envaseGramos && n >= p.envaseGramos / 2 && (n * 2) % p.envaseGramos === 0) return `${(n / p.envaseGramos).toLocaleString("es-MX")} botes`;
  if (p.porcionGramos && n % p.porcionGramos === 0) return `${miles(n / p.porcionGramos)} ${enPlural(p.porcionNombre ?? "porción", n / p.porcionGramos)}`;
  return `${miles(n)} g`;
}

/** A granel, cuántas porciones y envases equivalen: "≈ 61 scoops · 2 botes". */
export function equivalencias(p: Pick<Producto, "unidad" | "porcionGramos" | "porcionNombre" | "envaseGramos">, gramos: number): string | null {
  if (!esGranel(p) || !p.porcionGramos) return null;
  const porciones = Math.floor(gramos / p.porcionGramos);
  const partes = [`≈ ${miles(porciones)} ${enPlural(p.porcionNombre ?? "porción", porciones)}`];
  if (p.envaseGramos) {
    const envases = gramos / p.envaseGramos;
    partes.push(`${envases >= 10 ? Math.round(envases) : Math.round(envases * 10) / 10} ${envases === 1 ? "bote" : "botes"}`);
  }
  return partes.join(" · ");
}

export function estadoDeStock(producto: Pick<Producto, "stock" | "stockMinimo">): EstadoStock {
  if (producto.stock <= 0) return "agotado";
  if (producto.stock <= producto.stockMinimo) return "bajo";
  return "suficiente";
}

/** Margen de ganancia como fracción del precio (0.3 = 30 %). Null si no hay costo. */
export function margenDe(producto: Pick<Producto, "precioVenta" | "costo" | "unidad" | "porcionGramos" | "envaseGramos">): number | null {
  const costo = costoPorUnidad(producto);
  const precio = precioPorUnidad(producto);
  if (costo === null || precio <= 0) return null;
  return (precio - costo) / precio;
}
