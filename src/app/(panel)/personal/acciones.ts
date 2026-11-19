"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cambiarEstadoDeCuenta,
  cambiarPerfil,
  crearCuenta,
  editarCuenta,
  eliminarCuenta,
  guardarPermisosDeRecepcion,
  restablecerContrasenaDe,
} from "@/infrastructure/auth/autenticacion";
import { type EstadoFormulario, fallo, texto, valoresDe } from "@/presentation/acciones/estadoFormulario";

/** Tras cada cambio se vuelve a Personal con su aviso: así se cierra la ventana y se ve la palomita. */
function volver(aviso: string, nombre: string): never {
  revalidatePath("/personal");
  revalidatePath("/", "layout");
  redirect(`/personal?aviso=${aviso}&n=${encodeURIComponent(nombre)}`);
}

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
  volver("creada", `${texto(formData, "nombre").trim()}|${texto(formData, "usuario").trim().toLowerCase()}`);
}

export async function accionCambiarPerfil(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await cambiarPerfil(texto(formData, "id"), texto(formData, "rol"));
  } catch (error) {
    return fallo(error, formData);
  }
  volver(texto(formData, "rol") === "administrador" ? "perfil-administracion" : "perfil-recepcion", texto(formData, "nombre"));
}

export async function accionCambiarEstadoCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const activar = texto(formData, "activo") === "true";
  try {
    await cambiarEstadoDeCuenta(texto(formData, "id"), activar);
  } catch (error) {
    return fallo(error, formData);
  }
  volver(activar ? "activada" : "desactivada", texto(formData, "nombre"));
}

export async function accionRestablecerContrasena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    if (texto(formData, "contrasena") !== texto(formData, "confirmacion")) return { error: "Las contraseñas no coinciden.", campo: "confirmacion" };
    await restablecerContrasenaDe(texto(formData, "id"), texto(formData, "contrasena"));
  } catch (error) {
    return fallo(error, formData);
  }
  volver("contrasena", texto(formData, "nombre"));
}

export async function accionGuardarPermisos(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let ahora: string[];
  try {
    ahora = await guardarPermisosDeRecepcion(formData.getAll("permiso").map(String));
  } catch (error) {
    return fallo(error, formData);
  }
  volver(ahora.length === 0 ? "permisos-estandar" : "permisos", String(ahora.length));
}

export async function accionEditarCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let nombre: string;
  try {
    nombre = await editarCuenta(texto(formData, "id"), { nombre: texto(formData, "nombre"), usuario: texto(formData, "usuario") });
  } catch (error) {
    return fallo(error, formData);
  }
  volver("editada", `${nombre}|${texto(formData, "usuario").trim().toLowerCase()}`);
}

export async function accionEliminarCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let nombre: string;
  try {
    nombre = await eliminarCuenta(texto(formData, "id"));
  } catch (error) {
    return fallo(error, formData);
  }
  volver("eliminada", nombre);
}
