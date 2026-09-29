import type { MetodoPago } from "@/domain/entities/Pago";
import { type DatosNuevaVenta, validarNuevaVenta, type Venta } from "@/domain/entities/Venta";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";

/** Cobra en mostrador uno o varios productos y descuenta el stock. */
export class RegistrarVenta {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly ventas: VentaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: Omit<DatosNuevaVenta, "fecha">): Promise<Venta> {
    const datos = validarNuevaVenta({ ...entrada, fecha: this.reloj.hoy() });

    // Revisión previa para dar un mensaje claro. El repositorio vuelve a
    // validar el stock de forma atómica por si dos personas venden a la vez.
    for (const { productoId, cantidad } of datos.partidas) {
      const producto = await this.productos.obtenerPorId(productoId);
      if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe. Recarga la página.");
      if (!producto.activo) throw new ErrorDeDominio(`${producto.nombre} está desactivado y no se puede vender.`);
      if (producto.stock < cantidad) {
        throw new ErrorDeDominio(`No hay suficiente ${producto.nombre}: quedan ${producto.stock} y quieres vender ${cantidad}.`);
      }
    }

    return this.ventas.registrar(datos);
  }
}

export interface CorteDelDia {
  fecha: FechaISO;
  ventas: Venta[];
  total: number;
  piezas: number;
  porMetodo: Partial<Record<MetodoPago, number>>;
}

/** Las ventas de un día y sus totales por método de pago (corte de caja). */
export class ObtenerCorteDelDia {
  constructor(
    private readonly ventas: VentaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(fecha?: FechaISO): Promise<CorteDelDia> {
    const dia = fecha ?? this.reloj.hoy();
    const ventas = await this.ventas.listarEntre(dia, dia);
    const porMetodo: Partial<Record<MetodoPago, number>> = {};
    let total = 0;
    let piezas = 0;
    for (const v of ventas) {
      total += v.total;
      porMetodo[v.metodo] = (porMetodo[v.metodo] ?? 0) + v.total;
      piezas += v.partidas.reduce((n, p) => n + p.cantidad, 0);
    }
    return { fecha: dia, ventas, total, piezas, porMetodo };
  }
}
