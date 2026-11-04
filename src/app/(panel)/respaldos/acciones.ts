"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reabrirSesionTrasRestaurar, verificarPermiso } from "@/infrastructure/auth/autenticacion";
import { cambiarCarpetaExtra, guardarRespaldo, restaurarRespaldo } from "@/infrastructure/respaldo/respaldo";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Crea un respaldo al momento. Devuelve dónde quedó, para mostrarlo o enviarlo. */
export async function accionCrearRespaldo(): Promise<Resultado<{ nombre: string; ruta: string; copiaExtra: string | null }>> {
  try {
    await verificarPermiso("respaldos.gestionar");
    const r = guardarRespaldo("manual");
    revalidatePath("/respaldos");
    const copiaExtra = r.copiaExtra === null ? null : r.copiaExtra.ok ? "ok" : `No se pudo copiar a la carpeta extra: ${r.copiaExtra.error}`;
    return { ok: true, valor: { nombre: r.archivo.nombre, ruta: r.ruta, copiaExtra } };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

export async function accionCambiarCarpetaExtra(ruta: string | null): Promise<Resultado<null>> {
  try {
    await verificarPermiso("respaldos.gestionar");
    cambiarCarpetaExtra(ruta);
    revalidatePath("/respaldos");
    return { ok: true, valor: null };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

export async function accionRestaurar(_: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  let quien: { id: string };
  try {
    quien = await verificarPermiso("respaldos.gestionar");
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  const archivo = formData.get("respaldo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo del respaldo (.zip)." };
  if (formData.get("confirmo") !== "si") return { error: "Confirma que entiendes que se reemplazará la información actual." };
  let copiaPrevia: string;
  try {
    ({ copiaPrevia } = restaurarRespaldo(new Uint8Array(await archivo.arrayBuffer())));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  revalidatePath("/", "layout");
  if (!(await reabrirSesionTrasRestaurar(quien.id))) redirect("/login");
  redirect(`/respaldos?restaurado=${encodeURIComponent(copiaPrevia)}`);
}
