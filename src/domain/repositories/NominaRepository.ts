import type { DatosEmpleado, DatosPagoNomina, Empleado, PagoNomina } from "../entities/Nomina";
import type { FechaISO } from "../shared/fechas";

export interface NominaRepository {
  listarEmpleados(): Promise<Empleado[]>;
  obtenerEmpleado(id: string): Promise<Empleado | null>;
  crearEmpleado(datos: DatosEmpleado): Promise<Empleado>;
  actualizarEmpleado(id: string, datos: DatosEmpleado): Promise<Empleado>;
  cambiarEstadoEmpleado(id: string, activo: boolean): Promise<void>;
  /**
   * Guarda el pago. Si a ese empleado ya se le pagó esa semana, lanza un
   * ErrorDeDominio (lo revisa en la misma transacción que guarda: dos pagos
   * que llegan a la vez no pasan los dos).
   */
  registrarPago(datos: DatosPagoNomina & { fecha: FechaISO }): Promise<PagoNomina>;
  obtenerPago(id: string): Promise<PagoNomina | null>;
  eliminarPago(id: string): Promise<void>;
  /** Pagos de esas semanas (por el lunes de la semana), del más reciente al más antiguo. */
  pagosDeSemanas(desde: FechaISO, hasta: FechaISO): Promise<PagoNomina[]>;
  /** Pagos hechos en esos días (para el corte de caja y el total del mes). */
  pagosHechosEntre(desde: FechaISO, hasta: FechaISO): Promise<PagoNomina[]>;
}
