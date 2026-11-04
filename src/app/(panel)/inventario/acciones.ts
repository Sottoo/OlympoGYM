"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EntradaMovimiento } from "@/application/use-cases/inventario/RegistrarMovimiento";
import type { CategoriaProducto, DatosProducto, UnidadProducto } from "@/domain/entities/Producto";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, fallo, mensajeDeError, texto } from "@/presentation/acciones/estadoFormulario";

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
  unidad: (texto(formData, "unidad") || "pieza") as UnidadProducto,
  porcionGramos: numero(formData, "porcionGramos"),
  porcionNombre: texto(formData, "porcionNombre") || null,
  envaseGramos: numero(formData, "envaseGramos"),
});

/** Sube la foto nueva o quita la actual, según lo que venga en el formulario. */
async function guardarFoto(productoId: string, formData: FormData) {
  const casos = await casosDeUso();
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    await casos.cambiarFotoProducto.ejecutar(productoId, new Uint8Array(await foto.arrayBuffer()), foto.type);
  } else if (texto(formData, "quitarFoto") === "1") {
    await casos.quitarFotoProducto.ejecutar(productoId);
  }
}

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
    return fallo(error, formData);
  }
  // El producto ya quedó dado de alta: si la foto falla, no se regresa al
  // formulario (se daría de alta dos veces); se avisa en su ficha.
  const fotoGuardada = await guardarFoto(productoId, formData).then(
    () => true,
    (error) => {
      console.error("No se pudo guardar la foto del producto:", error);
      return false;
    },
  );
  actualizarVistas();
  redirect(`/inventario/${productoId}?aviso=${fotoGuardada ? "nuevo" : "nuevo-sin-foto"}`);
}

export async function accionEditarProducto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const productoId = texto(formData, "productoId");
  try {
    await (await casosDeUso()).editarProducto.ejecutar(productoId, datosProducto(formData));
    await guardarFoto(productoId, formData);
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas(productoId);
  redirect(`/inventario/${productoId}?aviso=editado`);
}

/** Desactivar o reactivar desde la ficha del producto (o desde la lista de desactivados). */
export async function accionCambiarEstadoProducto(formData: FormData) {
  const productoId = texto(formData, "productoId");
  const activo = texto(formData, "activo") === "true";
  await (await casosDeUso()).cambiarEstadoProducto.ejecutar(productoId, activo);
  actualizarVistas(productoId);
  if (texto(formData, "volver") === "lista") redirect(`/inventario?filtro=inactivos&reactivado=${encodeURIComponent(texto(formData, "nombre"))}`);
  redirect(`/inventario/${productoId}?aviso=${activo ? "reactivado" : "desactivado"}`);
}

/** Reactivar sin salir de la pantalla (catálogo, llegada de mercancía). */
export async function accionReactivarProducto(productoId: string): Promise<{ ok: boolean; mensaje: string }> {
  try {
    await (await casosDeUso()).cambiarEstadoProducto.ejecutar(productoId, true);
    actualizarVistas(productoId);
    return { ok: true, mensaje: "Reactivado: ya aparece otra vez en la Tienda y en el inventario." };
  } catch (error) {
    return { ok: false, mensaje: mensajeDeError(error) };
  }
}

/** Solo para altas por error: si ya tiene ventas, el caso de uso lo impide. */
export async function accionEliminarProducto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let nombre: string;
  try {
    nombre = await (await casosDeUso()).eliminarProducto.ejecutar(texto(formData, "productoId"));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  actualizarVistas();
  redirect(`/inventario?eliminado=${encodeURIComponent(nombre)}`);
}

/** Mientras se llena el formulario: avisa si el nombre o el código ya están en uso. */
export async function accionRevisarProducto(
  campo: "nombre" | "codigo",
  valor: string,
  excluirId?: string,
): Promise<{ mensaje: string; desactivado: { id: string; nombre: string } | null } | null> {
  try {
    const r = await (await casosDeUso()).revisarProducto.ejecutar(campo, valor, excluirId);
    return r && { mensaje: r.mensaje, desactivado: r.producto.activo ? null : { id: r.producto.id, nombre: r.producto.nombre } };
  } catch {
    return null;
  }
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
    return fallo(error, formData);
  }
  actualizarVistas(productoId);
  return { exito: { entrada: "Entrada registrada.", merma: "Merma registrada.", ajuste: "Stock ajustado al conteo." }[tipo] };
}
