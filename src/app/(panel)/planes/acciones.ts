"use server";

import { revalidatePath } from "next/cache";
import type { UnidadDuracion } from "@/domain/entities/Plan";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

export async function accionCrearPlan(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await (await casosDeUso()).crearPlan.ejecutar({
      nombre: texto(formData, "nombre"),
      descripcion: texto(formData, "descripcion"),
      precio: Number(texto(formData, "precio")),
      duracion: Number(texto(formData, "duracion")),
      unidad: texto(formData, "unidad") as UnidadDuracion,
    });
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  revalidatePath("/planes");
  return { valores: {} };
}

export async function accionCambiarEstadoPlan(formData: FormData) {
  await (await casosDeUso()).cambiarEstadoPlan.ejecutar(texto(formData, "planId"), texto(formData, "activo") === "true");
  revalidatePath("/planes");
}
