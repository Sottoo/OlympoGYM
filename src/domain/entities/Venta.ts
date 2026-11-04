import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import type { FechaISO } from "../shared/fechas";
import { METODOS_PAGO, type MetodoPago } from "./Pago";
import { pluralizar } from "../shared/texto";
import type { UnidadProducto } from "./Producto";

export interface PartidaVenta {
  productoId: string;
  productoNombre: string;
  /** Piezas, o gramos si el producto es a granel. */
  cantidad: number;
  /** Precio de cada pieza (o de cada gramo, a granel). */
  precioUnitario: number;
  unidad: UnidadProducto;
  porcionGramos: number | null;
  porcionNombre: string | null;
}

/** Venta de mostrador (suplementos, bebidas, etc.). Puede llevar varios productos. */
export interface Venta {
  id: string;
  fecha: FechaISO;
  metodo: MetodoPago;
  total: number;
  nota: string | null;
  partidas: PartidaVenta[];
  creadoEn: string;
}

export interface DatosNuevaVenta {
  fecha: FechaISO;
  metodo: MetodoPago;
  nota: string | null;
  partidas: { productoId: string; cantidad: number }[];
}

/** Valida la venta y junta en una sola partida los productos repetidos. */
export function validarNuevaVenta(datos: DatosNuevaVenta): DatosNuevaVenta {
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige un método de pago.");
  if (datos.partidas.length === 0) throw new ErrorDeDominio("Agrega al menos un producto a la venta.");

  const cantidades = new Map<string, number>();
  for (const { productoId, cantidad } of datos.partidas) {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new ErrorDeDominio("Las cantidades deben ser números enteros mayores a cero.");
    }
    cantidades.set(productoId, (cantidades.get(productoId) ?? 0) + cantidad);
  }

  return {
    ...datos,
    nota: datos.nota?.trim() || null,
    partidas: [...cantidades].map(([productoId, cantidad]) => ({ productoId, cantidad })),
  };
}

export const totalDePartidas = (partidas: Pick<PartidaVenta, "cantidad" | "precioUnitario">[]) =>
  partidas.reduce((total, p) => total + Math.round(p.cantidad * p.precioUnitario * 100) / 100, 0);

/** "3 × Agua 1 L" o, a granel, "2 scoops (60 g) de Proteína whey". */
export function describirPartida(p: Pick<PartidaVenta, "cantidad" | "productoNombre" | "unidad" | "porcionGramos" | "porcionNombre">): string {
  if (p.unidad !== "gramo" || !p.porcionGramos) return `${p.cantidad} × ${p.productoNombre}`;
  const porciones = p.cantidad / p.porcionGramos;
  const nombre = p.porcionNombre ?? "porción";
  if (Number.isInteger(porciones)) {
    const plural = pluralizar(nombre, porciones);
    return `${porciones} ${plural} (${p.cantidad} g) de ${p.productoNombre}`;
  }
  return `${p.cantidad} g de ${p.productoNombre}`;
}
