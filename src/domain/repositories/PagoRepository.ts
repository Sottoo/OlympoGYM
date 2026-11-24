import type { DatosNuevaDevolucion, DatosNuevoPago, Devolucion, DevolucionDelDia, Pago, PagoDelDia } from "../entities/Pago";
import type { FechaISO } from "../shared/fechas";

export interface PagoRepository {
  crear(datos: DatosNuevoPago): Promise<Pago>;
  listarPorSocio(socioId: string): Promise<Pago[]>;
  /** Lo que entró por membresías y visitas en esos días, ya restadas las devoluciones. */
  sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number>;
  /** Los cobros de membresías y visitas de un día, del más reciente al más antiguo. */
  listarDelDia(dia: FechaISO): Promise<PagoDelDia[]>;
  /** Cuánto se pagó por una membresía y cuánto ya se devolvió. */
  montosDeMembresia(suscripcionId: string): Promise<{ pagado: number; devuelto: number }>;
  /**
   * Guarda la devolución y termina la membresía (sus nuevas fechas), todo junto:
   * o quedan las dos cosas o ninguna.
   */
  registrarDevolucion(datos: DatosNuevaDevolucion, membresia: { id: string; fechaInicio: FechaISO; fechaFin: FechaISO }): Promise<Devolucion>;
  devolucionesDelDia(dia: FechaISO): Promise<DevolucionDelDia[]>;
  devolucionesDeSocio(socioId: string): Promise<Devolucion[]>;
}
