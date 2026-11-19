"use server";

import { redirect } from "next/navigation";
import { cambiarContrasena, generarCodigoDeRecuperacion, requerirSesion } from "@/infrastructure/auth/autenticacion";
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

/** Un código de recuperación nuevo para la propia cuenta (solo administración). Se muestra una vez en /bienvenida. */
export async function accionNuevoCodigo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await generarCodigoDeRecuperacion(texto(formData, "actual"));
  } catch (error) {
    return { ...fallo(error, formData), valores: undefined };
  }
  redirect("/bienvenida?nuevo=1");
}
