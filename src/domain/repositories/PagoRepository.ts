import type { DatosNuevoPago, Pago, PagoDelDia } from "../entities/Pago";
import type { FechaISO } from "../shared/fechas";

export interface PagoRepository {
  crear(datos: DatosNuevoPago): Promise<Pago>;
  listarPorSocio(socioId: string): Promise<Pago[]>;
  sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number>;
  /** Los cobros de membresías y visitas de un día, del más reciente al más antiguo. */
  listarDelDia(dia: FechaISO): Promise<PagoDelDia[]>;
}
