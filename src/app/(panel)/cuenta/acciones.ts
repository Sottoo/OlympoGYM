"use server";

import { cambiarContrasena, requerirSesion } from "@/infrastructure/auth/autenticacion";
import { type EstadoFormulario, fallo, texto } from "@/presentation/acciones/estadoFormulario";

export async function accionCambiarMiContrasena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const yo = await requerirSesion();
    if (texto(formData, "nueva") !== texto(formData, "confirmacion")) return { error: "La contraseña nueva y su repetición no coinciden.", campo: "confirmacion" };
    await cambiarContrasena(yo.id, texto(formData, "actual"), texto(formData, "nueva"));
  } catch (error) {
    return { ...fallo(error, formData), valores: undefined };
  }
  return { exito: "Listo. La próxima vez entra con tu contraseña nueva." };
}
