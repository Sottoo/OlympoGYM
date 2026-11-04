"use server";

import { revalidatePath } from "next/cache";
import { cambiarEstadoDeCuenta, cambiarPerfil, crearCuenta, restablecerContrasenaDe } from "@/infrastructure/auth/autenticacion";
import { type EstadoFormulario, fallo, mensajeDeError, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

export async function accionCrearCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    if (texto(formData, "contrasena") !== texto(formData, "confirmacion")) return { error: "Las contraseñas no coinciden.", campo: "confirmacion", valores: valoresDe(formData) };
    await crearCuenta({
      nombre: texto(formData, "nombre"),
      usuario: texto(formData, "usuario"),
      rol: texto(formData, "rol"),
      contrasena: texto(formData, "contrasena"),
    });
  } catch (error) {
    return fallo(error, formData);
  }
  revalidatePath("/personal");
  return { exito: `Cuenta creada. ${texto(formData, "nombre").trim()} ya puede entrar con el usuario «${texto(formData, "usuario").trim().toLowerCase()}».`, valores: {} };
}

export async function accionCambiarPerfil(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await cambiarPerfil(texto(formData, "id"), texto(formData, "rol"));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  revalidatePath("/personal");
  return { exito: "Perfil actualizado." };
}

export async function accionCambiarEstadoCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const activar = texto(formData, "activo") === "true";
  try {
    await cambiarEstadoDeCuenta(texto(formData, "id"), activar);
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  revalidatePath("/personal");
  return { exito: activar ? "Cuenta activada." : "Cuenta desactivada. Ya no puede entrar al programa." };
}

export async function accionRestablecerContrasena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    if (texto(formData, "contrasena") !== texto(formData, "confirmacion")) return { error: "Las contraseñas no coinciden.", campo: "confirmacion" };
    await restablecerContrasenaDe(texto(formData, "id"), texto(formData, "contrasena"));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  return { exito: "Contraseña cambiada. Compártela en persona, no por mensaje." };
}
