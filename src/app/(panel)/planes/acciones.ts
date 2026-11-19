"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UnidadDuracion } from "@/domain/entities/Plan";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, fallo, texto } from "@/presentation/acciones/estadoFormulario";

const datosPlan = (formData: FormData) => ({
  nombre: texto(formData, "nombre"),
  descripcion: texto(formData, "descripcion"),
  precio: Number(texto(formData, "precio")),
  duracion: Number(texto(formData, "duracion")),
  unidad: texto(formData, "unidad") as UnidadDuracion,
});

export async function accionCrearPlan(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await (await casosDeUso()).crearPlan.ejecutar(datosPlan(formData));
  } catch (error) {
    return fallo(error, formData);
  }
  revalidatePath("/planes");
  return { exito: `Plan «${texto(formData, "nombre").trim()}» creado. Ya se puede asignar a los socios.`, valores: {} };
}

export async function accionEditarPlan(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await (await casosDeUso()).editarPlan.ejecutar(texto(formData, "planId"), datosPlan(formData));
  } catch (error) {
    return fallo(error, formData);
  }
  revalidatePath("/planes");
  revalidatePath("/socios");
  redirect(`/planes?editado=${encodeURIComponent(texto(formData, "nombre").trim())}`);
}

export async function accionCambiarEstadoPlan(formData: FormData) {
  const activo = texto(formData, "activo") === "true";
  await (await casosDeUso()).cambiarEstadoPlan.ejecutar(texto(formData, "planId"), activo);
  revalidatePath("/planes");
  redirect(`/planes?${activo ? "activado" : "desactivado"}=${encodeURIComponent(texto(formData, "nombre"))}`);
}

export async function accionEliminarPlan(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let nombre: string;
  try {
    nombre = await (await casosDeUso()).eliminarPlan.ejecutar(texto(formData, "planId"));
  } catch (error) {
    return fallo(error, formData);
  }
  revalidatePath("/planes");
  revalidatePath("/socios");
  redirect(`/planes?eliminado=${encodeURIComponent(nombre)}`);
}
