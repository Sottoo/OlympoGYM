"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, fallo, mensajeDeError, texto } from "@/presentation/acciones/estadoFormulario";

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

const montoDe = (formData: FormData) => {
  const monto = texto(formData, "monto").trim();
  return monto ? Number(monto) : undefined;
};

export async function accionRegistrarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let socioId: string;
  let esVisita: boolean;
  try {
    const resultado = await (await casosDeUso()).registrarSocio.ejecutar(datosSocio(formData), {
      planId: texto(formData, "planId"),
      metodoPago: texto(formData, "metodoPago") as MetodoPago,
      monto: montoDe(formData),
      nota: texto(formData, "nota"),
      fecha: texto(formData, "fecha") || null,
    }, { esOtraPersona: texto(formData, "otraPersona") === "1" });
    socioId = resultado.socio.id;
    esVisita = resultado.esVisita;
  } catch (error) {
    return fallo(error, formData);
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
  actualizarVistas(socioId);
  const aviso = esVisita ? "nuevo-visita" : "nuevo";
  redirect(`/socios/${socioId}?aviso=${fotoGuardada ? aviso : `${aviso}-sin-foto`}`);
}

/** Mientras se llena el formulario: avisa si el celular ya es de otro socio. */
export async function accionRevisarCelular(telefono: string, excluirId?: string): Promise<string | null> {
  try {
    return await (await casosDeUso()).revisarCelular.ejecutar(telefono, excluirId);
  } catch {
    return null;
  }
}

export async function accionEditarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).editarSocio.ejecutar(socioId, datosSocio(formData));
    await guardarFoto(socioId, formData);
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=editado`);
}

export async function accionDarDeBaja(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).darDeBajaSocio.ejecutar(socioId, texto(formData, "motivo"), texto(formData, "detalle"));
  } catch (error) {
    return fallo(error, formData);
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
    await (await casosDeUso()).asignarPlan.ejecutar({
      socioId,
      planId: texto(formData, "planId"),
      metodoPago: texto(formData, "metodoPago") as MetodoPago,
      monto: montoDe(formData),
      nota: texto(formData, "nota"),
      fecha: texto(formData, "fecha") || null,
    });
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas(socioId);
  redirect(`/socios/${socioId}?aviso=pagado`);
}

/** Corrige el plan (y el monto) de la membresía más reciente, cuando se registró la equivocada. */
export async function accionCorregirMembresia(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  try {
    await (await casosDeUso()).corregirMembresia.ejecutar({
      suscripcionId: texto(formData, "suscripcionId"),
      planId: texto(formData, "planId"),
      monto: montoDe(formData),
      metodoPago: texto(formData, "metodoPago") as MetodoPago,
    });
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas(socioId);
  revalidatePath("/ventas");
  redirect(`/socios/${socioId}?aviso=corregido`);
}

/** Cancela una membresía cobrada por error (la próxima o la de hoy) junto con su pago. */
export async function accionCancelarMembresia(socioId: string, suscripcionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await (await casosDeUso()).cancelarMembresia.ejecutar(suscripcionId);
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
  actualizarVistas(socioId);
  revalidatePath("/ventas");
  return { ok: true };
}

/** Borra al socio para siempre (sus pagos se quedan en los cortes como «Socio eliminado»). */
export async function accionEliminarSocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  let nombre: string;
  try {
    ({ nombre } = await (await casosDeUso()).eliminarSocioDefinitivo.ejecutar(socioId, texto(formData, "confirmacion")));
  } catch (error) {
    return fallo(error, formData);
  }
  revalidatePath("/socios");
  revalidatePath("/panel");
  revalidatePath("/ventas");
  redirect(`/socios?filtro=bajas&eliminado=${encodeURIComponent(nombre)}`);
}

/** Mientras se inscribe: ¿ya hay alguien con ese celular o ese nombre? (para no registrarlo dos veces). */
export async function accionBuscarParecidos(datos: { nombre: string; apellidos: string; telefono: string }, excluirId?: string) {
  try {
    return await (await casosDeUso()).buscarSociosParecidos.ejecutar(datos, excluirId);
  } catch {
    return [];
  }
}

/** Une un socio registrado dos veces: todo pasa a este y el otro registro se borra. */
export async function accionUnirSocios(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const socioId = texto(formData, "socioId");
  let unido: string;
  try {
    ({ unido } = await (await casosDeUso()).unirSocios.ejecutar(socioId, texto(formData, "duplicado")));
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas(socioId);
  revalidatePath("/ventas");
  redirect(`/socios/${socioId}?aviso=unido&de=${encodeURIComponent(unido)}`);
}
