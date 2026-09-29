"use client";

import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionIniciarSesion } from "./acciones";

export function FormularioLogin() {
  const [estado, accion] = useActionState(accionIniciarSesion, estadoInicial);
  return (
    <form action={accion} className="space-y-5">
      <MensajeError mensaje={estado.error} />
      <div>
        <label htmlFor="email" className="etiqueta">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" defaultValue={estado.valores?.email} />
      </div>
      <div>
        <label htmlFor="contrasena" className="etiqueta">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required className="campo" />
      </div>
      <BotonEnviar textoEnviando="Entrando…" className="w-full">Entrar al panel</BotonEnviar>
    </form>
  );
}
