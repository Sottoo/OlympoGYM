"use server";

import { redirect } from "next/navigation";
import { crearAdministrador, iniciarSesion, recuperarContrasena } from "@/infrastructure/auth/autenticacion";
import { type EstadoFormulario, fallo, texto } from "@/presentation/acciones/estadoFormulario";

export type EstadoCuenta = EstadoFormulario & { codigo?: string };

export async function accionIniciarSesion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = texto(formData, "usuario").trim();
  const contrasena = texto(formData, "contrasena");
  if (!usuario || !contrasena) return { error: "Escribe tu usuario y tu contraseña.", valores: { usuario } };

  const error = await iniciarSesion(usuario, contrasena);
  if (error) return { error, valores: { usuario } };
  redirect("/panel");
}

/** Primer arranque: crea la cuenta del administrador y entrega su código de recuperación. */
export async function accionCrearAdministrador(_: EstadoCuenta, formData: FormData): Promise<EstadoCuenta> {
  const valores = { nombre: texto(formData, "nombre"), usuario: texto(formData, "usuario") };
  const contrasena = texto(formData, "contrasena");
  if (contrasena !== texto(formData, "confirmacion")) return { error: "Las dos contraseñas no coinciden.", campo: "confirmacion", valores };
  try {
    await crearAdministrador({ ...valores, contrasena });
  } catch (error) {
    return { ...fallo(error, formData), valores };
  }
  redirect("/bienvenida");
}

export async function accionRecuperar(_: EstadoCuenta, formData: FormData): Promise<EstadoCuenta> {
  const contrasena = texto(formData, "contrasena");
  if (contrasena !== texto(formData, "confirmacion")) return { error: "Las dos contraseñas no coinciden.", campo: "confirmacion" };
  try {
    await recuperarContrasena(texto(formData, "codigo"), contrasena);
  } catch (error) {
    return { ...fallo(error, formData), valores: undefined };
  }
  redirect("/bienvenida?recuperada=1");
}
