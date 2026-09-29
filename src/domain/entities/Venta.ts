import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import type { FechaISO } from "../shared/fechas";
import { METODOS_PAGO, type MetodoPago } from "./Pago";

export interface PartidaVenta {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
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
  if (!(datos.metodo in METODOS_PAGO)) throw new ErrorDeDominio("Elige un método de pago.");
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
  partidas.reduce((total, p) => total + p.cantidad * p.precioUnitario, 0);
