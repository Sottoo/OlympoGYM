"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

const datosSocio = (formData: FormData) => ({
  nombre: texto(formData, "nombre"),
  apellidos: texto(formData, "apellidos"),
  telefono: texto(formData, "telefono"),
  fechaNacimiento: texto(formData, "fechaNacimiento") || null,
  notas: texto(formData, "notas"),
});

/** Sube la foto nueva o quita la actual, según lo que venga en el formulario. */
async function guardarFoto(socioId: string, formData: FormData) {
  const casos = await casosDeUso();
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    await casos.cambiarFotoSocio.ejecutar(socioId, new Uint8Array(await foto.arrayBuffer()), foto.type);
  } else if (texto(formData, "quitarFoto") === "1") {
    await casos.quitarFotoSocio.ejecutar(socioId);
  }
}

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
  // El socio ya quedó registrado: si la foto falla, no se regresa al formulario
  // (se registraría dos veces); se avisa en su ficha para intentarlo desde "Editar".
  const fotoGuardada = await guardarFoto(socioId, formData).then(
    () => true,
    (error) => {
      console.error("No se pudo guardar la foto:", error);
      return false;
    },
  );
  revalidatePath("/socios");
  redirect(`/socios/${socioId}?aviso=${fotoGuardada ? "nuevo" : "nuevo-sin-foto"}#renovar`);
}

export async function accionEditarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).editarSocio.ejecutar(socioId, datosSocio(formData));
    await guardarFoto(socioId, formData);
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
