"use server";

import { revalidatePath } from "next/cache";
import { casosDeUso } from "@/infrastructure/contenedor";

/** Se llama al abrir WhatsApp: el aviso sale de la lista y del contador del menú. */
export async function accionMarcarAviso(suscripcionId: string, etapa: number) {
  await (await casosDeUso()).marcarAvisoEnviado.ejecutar(suscripcionId, etapa);
  revalidatePath("/", "layout");
}
