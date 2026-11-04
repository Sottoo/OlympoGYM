"use client";

import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { accionCambiarMiContrasena } from "./acciones";

export function FormularioContrasena() {
  const [estado, accion] = useActionState(accionCambiarMiContrasena, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} tituloError={null} className="grid gap-4" key={estado.exito ?? "f"}>
      <MensajeExito mensaje={estado.exito} />
      <div>
        <Etiqueta para="actual">Contraseña actual</Etiqueta>
        <CampoContrasena id="actual" nombre="actual" atributos={{ "data-falta": "Escribe tu contraseña actual." }} />
        <Ayuda para="actual" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Etiqueta para="nueva">Nueva</Etiqueta>
          <CampoContrasena id="nueva" nombre="nueva" nueva atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="nueva" />
        </div>
        <div>
          <Etiqueta para="confirmacion">Repítela</Etiqueta>
          <CampoContrasena id="confirmacion" nombre="confirmacion" nueva atributos={{ "data-regla": "coincide:nueva", "data-falta": "Repite la contraseña nueva." }} />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <p className="mensaje-campo -mt-2">Mínimo 8 caracteres, con letras y números. No la compartas: la bitácora registra lo que se hace con tu cuenta.</p>
      <BotonEnviar textoEnviando="Guardando…" className="justify-self-start">
        Cambiar contraseña
      </BotonEnviar>
    </Formulario>
  );
}
