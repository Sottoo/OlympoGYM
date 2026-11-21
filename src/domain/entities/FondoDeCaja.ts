import type { FechaISO } from "../shared/fechas";
import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { revisarDinero } from "../shared/reglas";

/** Con cuánto cambio empezó la caja un día. */
export interface FondoDeCaja {
  id: string;
  fecha: FechaISO;
  monto: number;
}

export function validarFondo(monto: number): number {
  const error = revisarDinero(monto, { que: "El fondo" });
  if (error) throw new ErrorDeDominio(error, "monto");
  return Math.round(monto * 100) / 100;
}
