"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@/infrastructure/auth/autenticacion";
import { respaldoDiarioSiFalta } from "@/infrastructure/respaldo/respaldo";

export async function accionCerrarSesion() {
  await cerrarSesion();
  redirect("/login");
}

/** Guarda el respaldo del día en la computadora (solo en la app de escritorio). */
export async function accionRespaldoDiario() {
  try {
    await respaldoDiarioSiFalta();
  } catch (error) {
    // Un respaldo fallido no debe interrumpir el trabajo; se reintenta la próxima vez.
    console.error("No se pudo guardar el respaldo diario:", error);
  }
}
