import type { Metadata } from "next";
import { FormularioRecuperar } from "../FormulariosCuenta";
import { MarcoDeEntrada } from "../MarcoDeEntrada";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperar() {
  return (
    <MarcoDeEntrada titulo="Recuperar contraseña" descripcion="Usa el código de recuperación que te dio el programa al crear la cuenta.">
      <FormularioRecuperar />
    </MarcoDeEntrada>
  );
}
