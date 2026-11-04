"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ROLES, type Rol } from "@/domain/shared/permisos";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { LIMITES } from "@/domain/shared/reglas";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { BotonDeRopa } from "@/presentation/components/formulario/marcas";
import { Selector } from "@/presentation/components/formulario/Selector";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { accionCambiarEstadoCuenta, accionCambiarPerfil, accionCrearCuenta, accionRestablecerContrasena } from "./acciones";

/** Alta de una cuenta nueva (recepción por omisión). */
export function FormularioNuevaCuenta() {
  const [estado, accion] = useActionState(accionCrearCuenta, estadoInicial);
  const v = estado.valores ?? {};
  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <MensajeExito mensaje={estado.exito} />
      <div>
        <Etiqueta para="nombre">Nombre</Etiqueta>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={LIMITES.nombrePersona}
          className="campo"
          defaultValue={v.nombre}
          placeholder="Ej. Laura Pérez"
          key={`n${estado.exito}`}
          data-regla="nombre"
          data-filtro="nombre"
          data-formato="nombre"
          data-falta="Escribe el nombre de la persona."
        />
        <Ayuda para="nombre">Aparece en la bitácora junto a lo que haga.</Ayuda>
      </div>
      <div>
        <Etiqueta para="usuario">Usuario para entrar</Etiqueta>
        <input
          id="usuario"
          name="usuario"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={LIMITES.usuario}
          className="campo"
          defaultValue={v.usuario}
          placeholder="Ej. laura"
          key={`u${estado.exito}`}
          data-regla="usuario"
          data-filtro="usuario"
          data-falta="Escribe el usuario con el que va a entrar."
        />
        <Ayuda para="usuario">Empieza con letra. Minúsculas, sin espacios ni acentos.</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Perfil</legend>
        <div className="grid gap-2">
          {(Object.keys(ROLES) as Rol[]).map((rol) => (
            <label key={rol} className="tarjeta-opcion items-start">
              <input type="radio" name="rol" value={rol} defaultChecked={(v.rol ?? "recepcion") === rol} className="sr-only" />
              <BotonDeRopa />
              <span>
                <b className="block text-[0.9rem]">{ROLES[rol].nombre}</b>
                <span className="text-[0.8rem] text-gris">{ROLES[rol].descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Etiqueta para="contrasena">Contraseña</Etiqueta>
          <CampoContrasena id="contrasena" nombre="contrasena" nueva key={`c${estado.exito}`} atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="contrasena" />
        </div>
        <div>
          <Etiqueta para="confirmacion">Repítela</Etiqueta>
          <CampoContrasena
            id="confirmacion"
            nombre="confirmacion"
            nueva
            key={`r${estado.exito}`}
            atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }}
          />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <p className="mensaje-campo -mt-2">Mínimo 8 caracteres, con letras y números. La persona podrá cambiarla en «Mi cuenta».</p>
      <BotonEnviar textoEnviando="Creando…" className="justify-self-start">
        Crear cuenta
      </BotonEnviar>
    </Formulario>
  );
}

/** El perfil de la cuenta: se cambia aquí mismo (salvo el propio y el de cuentas desactivadas). */
export function PerfilDeCuenta({ id, rol, activo, esYo }: { id: string; rol: Rol; activo: boolean; esYo: boolean }) {
  const [perfil, cambiarPerfil] = useActionState(accionCambiarPerfil, estadoInicial);
  if (!activo) return <Insignia tono="rojo">Desactivada</Insignia>;
  if (esYo) return <Insignia tono={rol === "administrador" ? "oscuro" : "neutro"}>{ROLES[rol].nombre}</Insignia>;
  return (
    <form action={cambiarPerfil} className="grid gap-1">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`rol-${id}`}>Perfil</label>
      <Selector
        key={`${rol}-${perfil.error ?? ""}`}
        id={`rol-${id}`}
        nombre="rol"
        compacto
        enviarAlElegir
        valorInicial={rol}
        opciones={(Object.keys(ROLES) as Rol[]).map((r) => ({ valor: r, texto: ROLES[r].nombre, detalle: ROLES[r].descripcion }))}
      />
      {perfil.error && <p className="text-[0.78rem] font-semibold text-rojo">{perfil.error}</p>}
      {!perfil.error && perfil.exito && <p className="text-[0.78rem] font-semibold text-verde">{perfil.exito}</p>}
    </form>
  );
}

/** Acciones sobre una cuenta: poner contraseña nueva, desactivar o activar. */
export function AccionesDeCuenta({ id, activo, esYo }: { id: string; activo: boolean; esYo: boolean }) {
  const [estadoCuenta, cambiarEstado] = useActionState(accionCambiarEstadoCuenta, estadoInicial);
  const [clave, restablecer] = useActionState(accionRestablecerContrasena, estadoInicial);
  const [abierto, setAbierto] = useState<"clave" | null>(null);
  // Al guardar la contraseña nueva se cierra el formulario; el botón lo vuelve a abrir.
  useEffect(() => {
    if (clave.exito) setAbierto(null);
  }, [clave]);
  // Los errores de la contraseña nueva ya se ven bajo su campo.
  const error = estadoCuenta.error ?? (clave.campo ? undefined : clave.error);
  const exito = clave.exito ?? estadoCuenta.exito;

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-nowrap items-center justify-end gap-2">
        {esYo && (
          <Link href="/cuenta" className="enlace whitespace-nowrap text-[0.84rem] text-gris">
            Contraseña en Mi cuenta
          </Link>
        )}
        {activo && !esYo && (
          <button type="button" onClick={() => setAbierto(abierto ? null : "clave")} className="boton-secundario boton-chico whitespace-nowrap">
            Nueva contraseña
          </button>
        )}
        {!esYo && (
          <form action={cambiarEstado}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="activo" value={String(!activo)} />
            <BotonEnviar textoEnviando="Guardando…" variante={activo ? "boton-peligro" : "boton-secundario"} className="boton-chico">
              {activo ? "Desactivar" : "Activar"}
            </BotonEnviar>
          </form>
        )}
      </div>
      {abierto === "clave" && (
        <Formulario action={restablecer} estado={clave} avisosManuales className="aparece grid justify-items-end gap-1">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-wrap items-start justify-end gap-2">
            <label htmlFor={`clave-${id}`} className="sr-only">Contraseña nueva</label>
            <CampoContrasena
              id={`clave-${id}`}
              nombre="contrasena"
              nueva
              placeholder="Contraseña nueva"
              className="w-44 text-[0.84rem] [&>input]:py-1.5"
              atributos={{ "data-regla": "contrasena" }}
            />
            <label htmlFor={`confirma-${id}`} className="sr-only">Repite la contraseña nueva</label>
            <CampoContrasena
              id={`confirma-${id}`}
              nombre="confirmacion"
              nueva
              placeholder="Repítela"
              className="w-40 text-[0.84rem] [&>input]:py-1.5"
              atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }}
            />
            <BotonEnviar textoEnviando="Guardando…" className="boton-chico">Guardar</BotonEnviar>
          </div>
          <Ayuda para="contrasena" className="justify-end text-right" />
          <Ayuda para="confirmacion" className="justify-end text-right" />
        </Formulario>
      )}
      {error && <p className="text-right text-[0.8rem] font-semibold text-rojo">{error}</p>}
      {!error && exito && <p className="text-right text-[0.8rem] font-semibold text-verde">{exito}</p>}
    </div>
  );
}
