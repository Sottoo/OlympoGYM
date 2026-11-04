import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hayCuentas, obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { FormularioLogin } from "./FormularioLogin";
import { FormularioConfigurar } from "./FormulariosCuenta";
import { MarcoDeEntrada } from "./MarcoDeEntrada";

export const metadata: Metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function PaginaLogin() {
  if ((await obtenerAcceso()).tipo === "autorizado") redirect("/panel");

  // Primer arranque: todavía no hay cuentas, se crea la del administrador.
  if (!hayCuentas()) {
    return (
      <MarcoDeEntrada titulo="Bienvenido" descripcion="Crea la cuenta con la que se entrará al programa. Solo se hace una vez.">
        <FormularioConfigurar />
      </MarcoDeEntrada>
    );
  }

  return (
    <MarcoDeEntrada titulo="Iniciar sesión" descripcion="Acceso exclusivo para el personal del gimnasio.">
      <FormularioLogin />
    </MarcoDeEntrada>
  );
}
