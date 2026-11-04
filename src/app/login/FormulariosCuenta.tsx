"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { LIMITES } from "@/domain/shared/reglas";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionCrearAdministrador, accionRecuperar, type EstadoCuenta } from "./acciones";

const inicial: EstadoCuenta = {};

export function FormularioConfigurar() {
  const [estado, accion] = useActionState(accionCrearAdministrador, inicial);
  return (
    <Formulario action={accion} estado={estado} tituloError={null} className="grid gap-5">
      <div>
        <Etiqueta para="nombre">Nombre</Etiqueta>
        <input
          id="nombre"
          name="nombre"
          required
          autoFocus
          maxLength={LIMITES.nombrePersona}
          className="campo"
          defaultValue={estado.valores?.nombre}
          placeholder="Ej. Laura Pérez"
          data-regla="nombre"
          data-filtro="nombre"
          data-formato="nombre"
          data-falta="Escribe tu nombre."
        />
        <Ayuda para="nombre">Así aparecerás en la bitácora.</Ayuda>
      </div>
      <div>
        <Etiqueta para="usuario">Usuario</Etiqueta>
        <input
          id="usuario"
          name="usuario"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={LIMITES.usuario}
          className="campo"
          defaultValue={estado.valores?.usuario}
          placeholder="Ej. laura"
          data-regla="usuario"
          data-filtro="usuario"
          data-falta="Escribe el usuario con el que vas a entrar."
        />
        <Ayuda para="usuario">Con él entras al programa. Empieza con letra; minúsculas, sin espacios ni acentos.</Ayuda>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Etiqueta para="contrasena">Contraseña</Etiqueta>
          <CampoContrasena id="contrasena" nombre="contrasena" nueva atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="contrasena" />
        </div>
        <div>
          <Etiqueta para="confirmacion">Repítela</Etiqueta>
          <CampoContrasena id="confirmacion" nombre="confirmacion" nueva atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }} />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <p className="mensaje-campo -mt-3">Mínimo 8 caracteres, con letras y números.</p>
      <BotonEnviar textoEnviando="Creando cuenta…" className="w-full py-3">
        Crear cuenta y entrar
      </BotonEnviar>
    </Formulario>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(accionRecuperar, inicial);
  return (
    <Formulario action={accion} estado={estado} tituloError={null} reglas={REGLAS_RECUPERAR} className="grid gap-5">
      <div>
        <Etiqueta para="codigo">Código de recuperación</Etiqueta>
        <input
          id="codigo"
          name="codigo"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={19}
          className="campo uppercase tracking-[0.06em]"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          data-filtro="codigo"
          data-falta="Escribe el código que te dio el programa."
        />
        <Ayuda para="codigo">Es el código que te dio el programa al crear la cuenta.</Ayuda>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Etiqueta para="contrasena">Contraseña nueva</Etiqueta>
          <CampoContrasena id="contrasena" nombre="contrasena" nueva atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="contrasena" />
        </div>
        <div>
          <Etiqueta para="confirmacion">Repítela</Etiqueta>
          <CampoContrasena id="confirmacion" nombre="confirmacion" nueva atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }} />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <BotonEnviar textoEnviando="Cambiando…" className="w-full py-3">
        Cambiar contraseña y entrar
      </BotonEnviar>
      <Link href="/login" className="enlace w-fit text-[0.88rem] text-gris">
        Volver a iniciar sesión
      </Link>
    </Formulario>
  );
}

/** El código son 16 letras o números (con o sin guiones). */
const REGLAS_RECUPERAR = {
  codigo: (valor: string) => (valor.replace(/-/g, "").length === 16 ? null : "El código tiene 16 letras o números, en 4 grupos de 4."),
};
