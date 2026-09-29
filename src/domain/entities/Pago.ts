import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import type { FechaISO } from "../shared/fechas";

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export const METODOS_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export interface Pago {
  id: string;
  socioId: string;
  suscripcionId: string | null;
  monto: number;
  metodo: MetodoPago;
  fecha: FechaISO;
  nota: string | null;
  creadoEn: string;
}

export type DatosNuevoPago = Omit<Pago, "id" | "creadoEn">;

export function validarNuevoPago(datos: DatosNuevoPago): DatosNuevoPago {
  if (!Number.isFinite(datos.monto) || datos.monto < 0) throw new ErrorDeDominio("El monto no es válido.");
  if (!(datos.metodo in METODOS_PAGO)) throw new ErrorDeDominio("Elige un método de pago.");
  return { ...datos, nota: datos.nota?.trim() || null };
}
