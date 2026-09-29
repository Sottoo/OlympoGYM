"use server";

import { redirect } from "next/navigation";
import { iniciarSesion } from "@/infrastructure/auth/autenticacion";
import { type EstadoFormulario, texto } from "@/presentation/acciones/estadoFormulario";

export async function accionIniciarSesion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const email = texto(formData, "email").trim();
  const contrasena = texto(formData, "contrasena");
  if (!email || !contrasena) return { error: "Escribe tu correo y tu contraseña.", valores: { email } };

  const error = await iniciarSesion(email, contrasena);
  if (error) return { error, valores: { email } };
  redirect("/panel");
}
