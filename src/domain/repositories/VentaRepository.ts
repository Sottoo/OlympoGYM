import type { DatosNuevaVenta, Venta } from "../entities/Venta";
import type { FechaISO } from "../shared/fechas";

export interface VentaRepository {
  /**
   * Guarda la venta, descuenta el stock de cada producto y calcula el total
   * con el precio vigente, todo en una sola operación. Si algún producto no
   * alcanza, no se guarda nada (ErrorDeDominio).
   */
  registrar(datos: DatosNuevaVenta): Promise<Venta>;
  listarEntre(desde: FechaISO, hasta: FechaISO): Promise<Venta[]>;
  sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number>;
}
