"use client";

import Link from "next/link";
import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionIniciarSesion } from "./acciones";

export function FormularioLogin() {
  const [estado, accion] = useActionState(accionIniciarSesion, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} tituloError={null} className="grid gap-5">
      <div>
        <Etiqueta para="usuario">Usuario</Etiqueta>
        <input
          id="usuario"
          name="usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          className="campo"
          defaultValue={estado.valores?.usuario}
          data-falta="Escribe tu usuario."
        />
        <Ayuda para="usuario" />
      </div>
      <div>
        <Etiqueta para="contrasena">Contraseña</Etiqueta>
        <CampoContrasena id="contrasena" nombre="contrasena" atributos={{ "data-falta": "Escribe tu contraseña." }} />
        <Ayuda para="contrasena" />
      </div>
      <BotonEnviar textoEnviando="Entrando…" className="w-full py-3">Entrar</BotonEnviar>
      <Link href="/login/recuperar" className="enlace w-fit text-[0.88rem] text-gris">¿Olvidaste tu contraseña?</Link>
    </Formulario>
  );
}
