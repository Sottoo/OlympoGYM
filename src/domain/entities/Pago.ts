import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { LIMITES, revisarDinero } from "../shared/reglas";
import type { FechaISO } from "../shared/fechas";

/** El gimnasio cobra en efectivo o por transferencia (no hay terminal de tarjeta). */
export type MetodoPago = "efectivo" | "transferencia";

export const METODOS_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

/** Nombre para mostrar del método guardado en un cobro, incluso si ya no se ofrece. */
export function nombreDelMetodo(metodo: string): string {
  return METODOS_PAGO[metodo as MetodoPago] ?? metodo.charAt(0).toUpperCase() + metodo.slice(1);
}

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

/** Un cobro de membresía o visita, con a quién y qué se le cobró (para el corte de caja). */
export interface PagoDelDia extends Pago {
  socioNombre: string;
  planNombre: string | null;
}

export function validarNuevoPago(datos: DatosNuevoPago): DatosNuevoPago {
  const errorMonto = revisarDinero(datos.monto, { que: "El monto" });
  if (errorMonto) throw new ErrorDeDominio(errorMonto, "monto");
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige un método de pago.", "metodoPago");
  const nota = datos.nota?.trim() || null;
  if (nota && nota.length > LIMITES.nota) throw new ErrorDeDominio(`La nota puede tener hasta ${LIMITES.nota} caracteres.`, "nota");
  return { ...datos, monto: Math.round(datos.monto * 100) / 100, nota };
}
