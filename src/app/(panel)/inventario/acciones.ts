"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EntradaMovimiento } from "@/application/use-cases/inventario/RegistrarMovimiento";
import type { CategoriaProducto, DatosProducto } from "@/domain/entities/Producto";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

/** Campo numérico: vacío → null (para los opcionales), texto inválido → NaN (lo rechaza la validación). */
const numero = (formData: FormData, campo: string) => {
  const valor = texto(formData, campo).trim();
  return valor === "" ? null : Number(valor);
};

const datosProducto = (formData: FormData): DatosProducto => ({
  nombre: texto(formData, "nombre"),
  categoria: texto(formData, "categoria") as CategoriaProducto,
  codigo: texto(formData, "codigo"),
  precioVenta: numero(formData, "precioVenta") ?? Number.NaN,
  costo: numero(formData, "costo"),
  stockMinimo: numero(formData, "stockMinimo") ?? 0,
});

function actualizarVistas(productoId?: string) {
  revalidatePath("/inventario");
  if (productoId) revalidatePath(`/inventario/${productoId}`);
  revalidatePath("/ventas");
  revalidatePath("/panel");
}

export async function accionCrearProducto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let productoId: string;
  try {
    const producto = await (await casosDeUso()).crearProducto.ejecutar(datosProducto(formData), numero(formData, "stockInicial") ?? 0);
    productoId = producto.id;
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas();
  redirect(`/inventario/${productoId}?aviso=nuevo`);
}

export async function accionEditarProducto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const productoId = texto(formData, "productoId");
  try {
    await (await casosDeUso()).editarProducto.ejecutar(productoId, datosProducto(formData));
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas(productoId);
  redirect(`/inventario/${productoId}?aviso=editado`);
}

export async function accionCambiarEstadoProducto(formData: FormData) {
  const productoId = texto(formData, "productoId");
  await (await casosDeUso()).cambiarEstadoProducto.ejecutar(productoId, texto(formData, "activo") === "true");
  actualizarVistas(productoId);
}

export async function accionRegistrarMovimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const productoId = texto(formData, "productoId");
  const tipo = texto(formData, "tipo") as EntradaMovimiento["tipo"];
  try {
    await (await casosDeUso()).registrarMovimiento.ejecutar({
      productoId,
      tipo,
      cantidad: numero(formData, "cantidad") ?? Number.NaN,
      nota: texto(formData, "nota"),
    });
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas(productoId);
  return { exito: { entrada: "Entrada registrada.", merma: "Merma registrada.", ajuste: "Stock ajustado al conteo." }[tipo] };
}
