import type { MetodoPago, PagoDelDia } from "@/domain/entities/Pago";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import { type DatosNuevaVenta, validarNuevaVenta, type Venta } from "@/domain/entities/Venta";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { describirCantidad } from "@/domain/entities/Producto";
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
      if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe. Vuelve a abrir la Tienda.");
      if (!producto.activo) throw new ErrorDeDominio(`${producto.nombre} está desactivado y no se puede vender.`);
      if (producto.stock < cantidad) {
        throw new ErrorDeDominio(
          `No hay suficiente ${producto.nombre}: quedan ${describirCantidad(producto, producto.stock)} y quieres vender ${describirCantidad(producto, cantidad)}.`,
        );
      }
    }

    return this.ventas.registrar(datos);
  }
}

export interface CorteDelDia {
  fecha: FechaISO;
  /** Tienda */
  ventas: Venta[];
  totalTienda: number;
  piezas: number;
  /** Membresías y visitas */
  cobros: PagoDelDia[];
  totalMembresias: number;
  /** Todo lo que entró a caja ese día, y cuánto por método (tienda + membresías). */
  total: number;
  porMetodo: Record<MetodoPago, { tienda: number; membresias: number }>;
}

const centavos = (x: number) => Math.round(x * 100) / 100;

/**
 * Corte de caja de un día: lo vendido en la tienda y lo cobrado de
 * membresías y visitas, separado por método de pago. Así cuadra con lo que
 * hay en el cajón y lo que llegó por transferencia.
 */
export class ObtenerCorteDelDia {
  constructor(
    private readonly ventas: VentaRepository,
    private readonly pagos: PagoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(fecha?: FechaISO): Promise<CorteDelDia> {
    const dia = fecha ?? this.reloj.hoy();
    const [ventas, cobros] = await Promise.all([this.ventas.listarEntre(dia, dia), this.pagos.listarDelDia(dia)]);
    const porMetodo: CorteDelDia["porMetodo"] = {
      efectivo: { tienda: 0, membresias: 0 },
      transferencia: { tienda: 0, membresias: 0 },
    };
    let totalTienda = 0;
    let totalMembresias = 0;
    let piezas = 0;
    for (const v of ventas) {
      totalTienda += v.total;
      if (porMetodo[v.metodo]) porMetodo[v.metodo].tienda += v.total;
      // A granel cada partida cuenta como un artículo (no se suman gramos con piezas).
      piezas += v.partidas.reduce((n, p) => n + (p.unidad === "gramo" ? 1 : p.cantidad), 0);
    }
    for (const c of cobros) {
      totalMembresias += c.monto;
      if (porMetodo[c.metodo]) porMetodo[c.metodo].membresias += c.monto;
    }
    for (const m of Object.values(porMetodo)) {
      m.tienda = centavos(m.tienda);
      m.membresias = centavos(m.membresias);
    }
    return {
      fecha: dia,
      ventas,
      totalTienda: centavos(totalTienda),
      piezas,
      cobros,
      totalMembresias: centavos(totalMembresias),
      total: centavos(totalTienda + totalMembresias),
      porMetodo,
    };
  }
}
