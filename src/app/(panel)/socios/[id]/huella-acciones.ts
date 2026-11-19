"use server";

import { revalidatePath } from "next/cache";
import { type Dedo, esDedo } from "@/domain/entities/Huella";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";

export type Resultado = { ok: true } | { ok: false; error: string };

/** Guarda la huella con los 4 toques ya leídos (plantillas en base64) y el consentimiento del socio. */
export async function accionRegistrarHuella(datos: { socioId: string; dedo: Dedo; toques: string[]; consentimiento: boolean }): Promise<Resultado> {
  try {
    if (!esDedo(datos.dedo)) return { ok: false, error: "Elige qué dedo se va a registrar." };
    await (await casosDeUso()).registrarHuella.ejecutar({
      socioId: datos.socioId,
      dedo: datos.dedo,
      toques: datos.toques.slice(0, 8).map((t) => new Uint8Array(Buffer.from(t, "base64"))),
      consentimiento: datos.consentimiento === true,
    });
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
  revalidatePath(`/socios/${datos.socioId}`);
  return { ok: true };
}

export async function accionBorrarHuella(huellaId: string): Promise<Resultado> {
  let socioId: string;
  try {
    socioId = (await (await casosDeUso()).borrarHuella.ejecutar(huellaId)).socioId;
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
  revalidatePath(`/socios/${socioId}`);
  return { ok: true };
}
