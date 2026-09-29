import type { DatosNuevoMovimiento, MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export interface EntradaMovimiento {
  productoId: string;
  tipo: DatosNuevoMovimiento["tipo"];
  /**
   * entrada y merma: cuántas piezas entran o salen.
   * ajuste: cuántas piezas se contaron físicamente en el anaquel.
   */
  cantidad: number;
  nota: string | null;
}

/** Entrada de mercancía, merma o ajuste por conteo físico. */
export class RegistrarMovimiento {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaMovimiento): Promise<MovimientoInventario> {
    const producto = await this.productos.obtenerPorId(entrada.productoId);
    if (!producto) throw new NoEncontrado("El producto");

    const { cantidad, tipo } = entrada;
    const nota = entrada.nota?.trim() || null;
    if (!Number.isInteger(cantidad) || cantidad < 0 || (tipo !== "ajuste" && cantidad === 0)) {
      throw new ErrorDeDominio(tipo === "ajuste" ? "Escribe cuántas piezas contaste." : "La cantidad debe ser un número entero mayor a cero.");
    }

    let cambio: number;
    if (tipo === "entrada") {
      cambio = cantidad;
    } else if (tipo === "merma") {
      if (cantidad > producto.stock) {
        throw new ErrorDeDominio(`Solo hay ${producto.stock} en stock; no puedes dar de baja ${cantidad}.`);
      }
      if (!nota) throw new ErrorDeDominio("Indica el motivo de la merma (caducado, dañado, extraviado…).");
      cambio = -cantidad;
    } else {
      cambio = cantidad - producto.stock;
      if (cambio === 0) throw new ErrorDeDominio("El conteo coincide con el stock registrado; no hay nada que ajustar.");
    }

    return this.inventario.registrarMovimiento({
      productoId: producto.id,
      tipo,
      cantidad: cambio,
      nota,
      fecha: this.reloj.hoy(),
    });
  }
}
