"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

const datosSocio = (formData: FormData) => ({
  nombre: texto(formData, "nombre"),
  apellidos: texto(formData, "apellidos"),
  email: texto(formData, "email"),
  telefono: texto(formData, "telefono"),
  notas: texto(formData, "notas"),
});

function actualizarVistas(socioId: string) {
  revalidatePath("/socios");
  revalidatePath(`/socios/${socioId}`);
  revalidatePath("/panel");
}

export async function accionRegistrarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let socioId: string;
  try {
    socioId = (await (await casosDeUso()).registrarSocio.ejecutar(datosSocio(formData))).id;
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  revalidatePath("/socios");
  redirect(`/socios/${socioId}?aviso=nuevo#renovar`);
}

export async function accionEditarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).editarSocio.ejecutar(socioId, datosSocio(formData));
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=editado`);
}

export async function accionDarDeBaja(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).darDeBajaSocio.ejecutar(socioId, texto(formData, "motivo"), texto(formData, "detalle"));
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=baja`);
}

export async function accionReactivarSocio(formData: FormData) {
  const socioId = texto(formData, "socioId");
  await (await casosDeUso()).reactivarSocio.ejecutar(socioId);
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=reactivado#renovar`);
}

export async function accionAsignarPlan(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    const montoTexto = texto(formData, "monto").trim();
    await (await casosDeUso()).asignarPlan.ejecutar({
      socioId,
      planId: texto(formData, "planId"),
      metodoPago: texto(formData, "metodoPago") as MetodoPago,
      monto: montoTexto ? Number(montoTexto) : undefined,
      nota: texto(formData, "nota"),
    });
  } catch (error) {
    return { error: mensajeDeError(error), valores: valoresDe(formData) };
  }
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=pagado`);
}
