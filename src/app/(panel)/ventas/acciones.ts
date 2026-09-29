"use server";

import { revalidatePath } from "next/cache";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto } from "@/presentation/acciones/estadoFormulario";
import { formatearDinero } from "@/shared/formato";

export async function accionRegistrarVenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const partidas = JSON.parse(texto(formData, "partidas") || "[]") as { productoId: string; cantidad: number }[];
    const venta = await (await casosDeUso()).registrarVenta.ejecutar({
      metodo: texto(formData, "metodo") as MetodoPago,
      nota: texto(formData, "nota"),
      partidas: Array.isArray(partidas) ? partidas.map((p) => ({ productoId: String(p.productoId), cantidad: Number(p.cantidad) })) : [],
    });
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/panel");
    return { exito: `Venta registrada por ${formatearDinero(venta.total)}.` };
  } catch (error) {
    // No se regresan los valores: el carrito vive en el navegador y no se pierde.
    return { error: mensajeDeError(error) };
  }
}
