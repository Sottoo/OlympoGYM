"use client";

import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionNuevoCodigo } from "./acciones";

/** Pide la contraseña y entrega un código de recuperación nuevo para esta cuenta. */
export function FormularioCodigo({ tieneCodigo }: { tieneCodigo: boolean }) {
  const [estado, accion] = useActionState(accionNuevoCodigo, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} tituloError={null} className="grid gap-4">
      <p className="text-[0.9rem] text-tinta-suave">
        {tieneCodigo
          ? "Tu cuenta tiene un código de recuperación. Si lo perdiste, crea uno nuevo: el anterior dejará de servir."
          : "Tu cuenta no tiene código de recuperación. Sin él no podrás entrar si olvidas tu contraseña."}
      </p>
      <div>
        <Etiqueta para="actual-codigo">Tu contraseña</Etiqueta>
        <CampoContrasena id="actual-codigo" nombre="actual" atributos={{ "data-falta": "Escribe tu contraseña para confirmar." }} />
        <Ayuda para="actual" />
      </div>
      <p className="mensaje-campo -mt-2">Solo hay un código vigente en el programa: el de otra cuenta, si lo había, también deja de servir.</p>
      <BotonEnviar textoEnviando="Creando…" className="justify-self-start">
        Crear código nuevo
      </BotonEnviar>
    </Formulario>
  );
}
