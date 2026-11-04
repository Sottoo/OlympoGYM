"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@/infrastructure/auth/autenticacion";

export async function accionCerrarSesion() {
  await cerrarSesion();
  redirect("/login");
}
