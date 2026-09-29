import type { DatosNuevoPago, Pago } from "../entities/Pago";
import type { FechaISO } from "../shared/fechas";

export interface PagoRepository {
  crear(datos: DatosNuevoPago): Promise<Pago>;
  listarPorSocio(socioId: string): Promise<Pago[]>;
  sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number>;
}
