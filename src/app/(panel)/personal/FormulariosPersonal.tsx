"use client";

import { useActionState, useRef, useState } from "react";
import { BASICOS_RECEPCION, type Permiso, PERMISOS_AJUSTABLES, ROLES, type Rol } from "@/domain/shared/permisos";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoContrasena } from "@/presentation/components/formulario/campos";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { BotonDeRopa } from "@/presentation/components/formulario/marcas";
import { Icono } from "@/presentation/components/Icono";
import { MenuMas } from "@/presentation/components/MenuMas";
import {
  accionCambiarEstadoCuenta,
  accionCambiarPerfil,
  accionCrearCuenta,
  accionEditarCuenta,
  accionEliminarCuenta,
  accionGuardarPermisos,
  accionRestablecerContrasena,
} from "./acciones";

/** Recepción primero: es lo que se da de alta casi siempre. */
const ORDEN_ROLES: Rol[] = ["recepcion", "administrador"];

/** «Laura Pérez» → «laura»: el usuario se sugiere solo mientras no se escriba a mano. */
function sugerirUsuario(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? "";
  return primero
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, LIMITES.usuario);
}

/* ── Nueva cuenta ─────────────────────────────────────────────────── */

export function FormularioNuevaCuenta() {
  const [estado, accion] = useActionState(accionCrearCuenta, estadoInicial);
  const v = estado.valores ?? {};
  const [usuario, setUsuario] = useState(v.usuario ?? "");
  const [usuarioAMano, setUsuarioAMano] = useState(Boolean(v.usuario));
  const [rol, setRol] = useState<Rol>((v.rol as Rol) ?? "recepcion");

  return (
    <Formulario action={accion} estado={estado} className="grid gap-5">
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
          onChange={(e) => !usuarioAMano && setUsuario(sugerirUsuario(e.target.value))}
          data-regla="nombre"
          data-filtro="nombre"
          data-formato="nombre"
          data-falta="Escribe el nombre de la persona."
        />
        <Ayuda para="nombre" />
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
          value={usuario}
          onChange={(e) => {
            setUsuario(e.target.value);
            setUsuarioAMano(true);
          }}
          placeholder="Ej. laura"
          data-regla="usuario"
          data-filtro="usuario"
          data-falta="Escribe el usuario con el que va a entrar."
        />
        <Ayuda para="usuario">Minúsculas, sin espacios ni acentos.</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Perfil</legend>
        <div className="grid gap-2">
          {ORDEN_ROLES.map((r) => (
            <label key={r} className="tarjeta-opcion items-start">
              <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} className="sr-only" />
              <BotonDeRopa />
              <span>
                <b className="block text-[0.9rem]">{ROLES[r].nombre}</b>
                <span className="text-[0.8rem] text-gris">{ROLES[r].descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Etiqueta para="contrasena">Contraseña</Etiqueta>
          <CampoContrasena id="contrasena" nombre="contrasena" nueva atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="contrasena">8 o más, con letras y números.</Ayuda>
        </div>
        <div>
          <Etiqueta para="confirmacion">Repítela</Etiqueta>
          <CampoContrasena id="confirmacion" nombre="confirmacion" nueva atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }} />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <div className="border-t border-dashed border-linea pt-4">
        <BotonEnviar textoEnviando="Creando…">Crear cuenta de {ROLES[rol].nombre}</BotonEnviar>
      </div>
    </Formulario>
  );
}

/* ── Acciones de cada cuenta ──────────────────────────────────────── */

type Vista = "editar" | "perfil" | "clave" | "estado" | "eliminar";

/**
 * «Más» de cada cuenta: editar sus datos, cambiar su perfil, ponerle
 * contraseña nueva, desactivarla o eliminarla. Cada cosa se confirma en su
 * ventana, diciendo qué cambia. En la propia: solo editar datos.
 */
export function AccionesDeCuenta({
  id,
  nombre,
  usuario,
  rol,
  activo,
  esYo,
}: {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  activo: boolean;
  esYo: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const [vez, setVez] = useState(0);
  const abrir = (v: Vista) => {
    setVista(v);
    setVez((n) => n + 1);
    dialogo.current?.showModal();
  };
  const cerrar = () => dialogo.current?.close();

  const primerNombre = nombre.split(" ")[0];
  const titulos: Record<Vista, string> = {
    editar: esYo ? "Editar tus datos" : `Editar datos de ${primerNombre}`,
    eliminar: `¿Eliminar la cuenta de ${primerNombre}?`,
    perfil: `Cambiar el perfil de ${primerNombre}`,
    clave: `Contraseña nueva para ${primerNombre}`,
    estado: activo ? `¿Desactivar la cuenta de ${primerNombre}?` : `¿Activar la cuenta de ${primerNombre}?`,
  };

  return (
    <>
      <MenuMas
        chico
        opciones={
          esYo
            ? [
                { texto: "Editar mis datos", icono: "editar", alElegir: () => abrir("editar") },
                { texto: "Cambiar mi contraseña", icono: "llave", href: "/cuenta" },
              ]
            : [
                { texto: "Editar datos", icono: "editar", alElegir: () => abrir("editar") },
                ...(activo
                  ? [
                      { texto: "Cambiar perfil", icono: "usuario" as const, alElegir: () => abrir("perfil") },
                      { texto: "Contraseña nueva", icono: "llave" as const, alElegir: () => abrir("clave") },
                      { texto: "Desactivar cuenta", icono: "pausa" as const, alElegir: () => abrir("estado") },
                    ]
                  : [{ texto: "Activar cuenta", icono: "check" as const, alElegir: () => abrir("estado") }]),
                { texto: "Eliminar para siempre", icono: "basura", peligro: true, alElegir: () => abrir("eliminar") },
              ]
        }
      />
      <dialog
        ref={dialogo}
        aria-labelledby={`titulo-cuenta-${id}`}
        className="dialogo-whatsapp max-w-[36rem] text-left"
        onClose={() => setVista(null)}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        {vista && (
          <div className="grid gap-4 p-6 whitespace-normal">
            <header className="flex items-start justify-between gap-4">
              <h2 id={`titulo-cuenta-${id}`} className={`font-titulos text-[1.25rem] leading-tight ${vista === "eliminar" ? "text-rojo" : ""}`}>
                {titulos[vista]}
              </h2>
              <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
                <Icono nombre="cerrar" className="size-5" />
              </button>
            </header>
            {vista === "editar" && <EditarCuenta key={vez} id={id} nombre={nombre} usuario={usuario} alCancelar={cerrar} />}
            {vista === "eliminar" && <EliminarCuenta key={vez} id={id} alCancelar={cerrar} />}
            {vista === "perfil" && <CambiarPerfil key={vez} id={id} nombre={nombre} rolActual={rol} alCancelar={cerrar} />}
            {vista === "clave" && <ContrasenaNueva key={vez} id={id} nombre={nombre} alCancelar={cerrar} />}
            {vista === "estado" && <CambiarEstado key={vez} id={id} nombre={nombre} activo={activo} alCancelar={cerrar} />}
          </div>
        )}
      </dialog>
    </>
  );
}

function EditarCuenta({ id, nombre, usuario, alCancelar }: { id: string; nombre: string; usuario: string; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionEditarCuenta, estadoInicial);
  const v = estado.valores ?? { nombre, usuario };
  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <Etiqueta para={`nombre-${id}`}>Nombre</Etiqueta>
        <input
          id={`nombre-${id}`}
          name="nombre"
          required
          maxLength={LIMITES.nombrePersona}
          className="campo"
          defaultValue={v.nombre}
          data-regla="nombre"
          data-filtro="nombre"
          data-formato="nombre"
          data-falta="Escribe el nombre de la persona."
        />
        <Ayuda para="nombre" />
      </div>
      <div>
        <Etiqueta para={`usuario-${id}`}>Usuario para entrar</Etiqueta>
        <input
          id={`usuario-${id}`}
          name="usuario"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={LIMITES.usuario}
          className="campo"
          defaultValue={v.usuario}
          data-regla="usuario"
          data-filtro="usuario"
          data-falta="Escribe el usuario con el que va a entrar."
        />
        <Ayuda para="usuario">Si lo cambias, a partir de ahora entra con el nuevo. La contraseña no cambia.</Ayuda>
      </div>
      <AvisosDelFormulario />
      <Pie alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
          Guardar cambios
        </BotonEnviar>
      </Pie>
    </Formulario>
  );
}

function EliminarCuenta({ id, alCancelar }: { id: string; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionEliminarCuenta, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-[0.9rem] text-tinta-suave">
        Se borra la cuenta y ya no podrá entrar. Lo que hizo se queda en la bitácora con su nombre.{" "}
        <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
      </p>
      <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.86rem]">Si solo dejó de trabajar aquí, mejor desactívala: se puede volver a activar.</p>
      <AvisosDelFormulario />
      <Pie alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
          Eliminar para siempre
        </BotonEnviar>
      </Pie>
    </Formulario>
  );
}

function Pie({ alCancelar, children }: { alCancelar: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
      <button type="button" className="boton-secundario" onClick={alCancelar}>
        Cancelar
      </button>
      {children}
    </div>
  );
}

/** Elegir el perfil nuevo viendo, antes de confirmar, qué gana o qué pierde. */
function CambiarPerfil({ id, nombre, rolActual, alCancelar }: { id: string; nombre: string; rolActual: Rol; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionCambiarPerfil, estadoInicial);
  const [rol, setRol] = useState<Rol>(rolActual === "administrador" ? "recepcion" : "administrador");
  const cambia = rol !== rolActual;
  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nombre" value={nombre} />
      <p className="text-[0.9rem] text-tinta-suave">
        Ahora es <b className="font-semibold text-tinta">{ROLES[rolActual].nombre}</b>.
      </p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Perfil nuevo</legend>
        {ORDEN_ROLES.map((r) => (
          <label key={r} className="tarjeta-opcion items-start">
            <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} className="sr-only" />
            <BotonDeRopa />
            <span>
              <b className="block text-[0.9rem]">
                {ROLES[r].nombre}
                {r === rolActual && <span className="ml-1.5 text-[0.76rem] font-normal text-gris">(actual)</span>}
              </b>
              <span className="text-[0.8rem] text-gris">{ROLES[r].descripcion}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {cambia && (
        <p className="aparece rounded-[10px] bg-hundido px-4 py-3 text-[0.86rem]">
          {rol === "administrador"
            ? "Podrá hacer todo: cuentas, permisos, planes, precios, dinero, métricas y respaldos."
            : "Solo podrá hacer lo de Recepción (lo que dice «Lo que puede hacer Recepción», abajo de la lista)."}{" "}
          El cambio aplica desde su siguiente pantalla.
        </p>
      )}
      <AvisosDelFormulario />
      <Pie alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro" disabled={!cambia}>
          {cambia ? `Cambiar a ${ROLES[rol].nombre}` : "Elige otro perfil"}
        </BotonEnviar>
      </Pie>
    </Formulario>
  );
}

function ContrasenaNueva({ id, nombre, alCancelar }: { id: string; nombre: string; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionRestablecerContrasena, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nombre" value={nombre} />
      <p className="text-[0.9rem] text-tinta-suave">Para cuando la olvidó. Dísela en persona; después la puede cambiar en «Mi cuenta».</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Etiqueta para={`clave-${id}`}>Contraseña nueva</Etiqueta>
          <CampoContrasena id={`clave-${id}`} nombre="contrasena" nueva atributos={{ "data-regla": "contrasena" }} />
          <Ayuda para="contrasena">8 o más, con letras y números.</Ayuda>
        </div>
        <div>
          <Etiqueta para={`confirma-${id}`}>Repítela</Etiqueta>
          <CampoContrasena id={`confirma-${id}`} nombre="confirmacion" nueva atributos={{ "data-regla": "coincide:contrasena", "data-falta": "Repite la contraseña." }} />
          <Ayuda para="confirmacion" />
        </div>
      </div>
      <AvisosDelFormulario />
      <Pie alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
          Guardar contraseña
        </BotonEnviar>
      </Pie>
    </Formulario>
  );
}

function CambiarEstado({ id, nombre, activo, alCancelar }: { id: string; nombre: string; activo: boolean; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionCambiarEstadoCuenta, estadoInicial);
  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="activo" value={String(!activo)} />
      <p className="text-[0.9rem] text-tinta-suave">
        {activo
          ? "Ya no podrá entrar al programa. Lo que hizo se conserva en la bitácora, y la cuenta se puede volver a activar."
          : "Podrá volver a entrar con su usuario y contraseña de antes."}
      </p>
      <AvisosDelFormulario />
      <Pie alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Guardando…" variante={activo ? "boton-peligro" : "boton-oscuro"}>
          {activo ? "Desactivar cuenta" : "Activar cuenta"}
        </BotonEnviar>
      </Pie>
    </Formulario>
  );
}

/* ── Permisos de Recepción ────────────────────────────────────────── */

/**
 * Lo que puede hacer Recepción: lo de siempre (fijo) y los permisos extra que
 * la administración quiera darle. El estándar es ninguno, y siempre se puede
 * volver a él con un clic.
 */
export function PermisosDeRecepcion({ activos }: { activos: Permiso[] }) {
  const [estado, accion] = useActionState(accionGuardarPermisos, estadoInicial);
  const [elegidos, setElegidos] = useState<Set<Permiso>>(new Set(activos));
  const formulario = useRef<HTMLFormElement>(null);
  const guardado = new Set(activos);
  const cambio = elegidos.size !== guardado.size || [...elegidos].some((p) => !guardado.has(p));
  const alternar = (p: Permiso, si: boolean) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (si) n.add(p);
      else n.delete(p);
      return n;
    });

  return (
    <Formulario ref={formulario} action={accion} estado={estado} className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {activos.length === 0 ? (
          <span className="rounded-full bg-hundido px-3 py-1 text-[0.78rem] font-bold text-tinta-suave">Estándar</span>
        ) : (
          <span className="rounded-full bg-ambar-tenue px-3 py-1 text-[0.78rem] font-bold text-ambar">
            Personalizado · {activos.length} {activos.length === 1 ? "permiso extra" : "permisos extra"}
          </span>
        )}
        <span className="text-[0.82rem] text-gris">Administración siempre puede todo.</span>
      </div>

      <div>
        <p className="rotulo mb-2.5">Siempre puede</p>
        <ul className="grid gap-x-6 gap-y-1.5 text-[0.88rem] sm:grid-cols-2">
          {BASICOS_RECEPCION.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Icono nombre="check" className="mt-0.5 size-4 shrink-0 text-verde" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-dashed border-linea pt-4">
        <p className="rotulo mb-1">Permisos extra</p>
        <p className="mb-3 text-[0.82rem] text-gris">Apagados, es el estándar. Enciende solo lo que quieras confiarle.</p>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {PERMISOS_AJUSTABLES.map((g) => (
            <fieldset key={g.grupo} className="grid content-start gap-1.5">
              <legend className="mb-1 text-[0.8rem] font-bold text-tinta-suave">{g.grupo}</legend>
              {g.permisos.map((p) => (
                <label key={p.permiso} className="interruptor">
                  <input
                    type="checkbox"
                    name="permiso"
                    value={p.permiso}
                    checked={elegidos.has(p.permiso)}
                    onChange={(e) => alternar(p.permiso, e.target.checked)}
                    className="sr-only"
                  />
                  <span aria-hidden className="interruptor-riel">
                    <span className="interruptor-bolita" />
                  </span>
                  <span className="min-w-0 text-[0.86rem] leading-snug">
                    {p.texto}
                    {p.delicado && <span className="ml-1.5 text-[0.72rem] font-bold text-ambar">· delicado</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <p className="mt-3 text-[0.78rem] text-gris">Administrar cuentas, permisos y respaldos es solo de Administración.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-linea pt-4">
        <BotonEnviar textoEnviando="Guardando…" disabled={!cambio}>
          Guardar permisos
        </BotonEnviar>
        {elegidos.size > 0 && (
          <button
            type="button"
            className="boton-secundario"
            onClick={() => {
              setElegidos(new Set());
              // Se guarda en cuanto se pinta todo apagado.
              setTimeout(() => formulario.current?.requestSubmit(), 0);
            }}
          >
            Volver al estándar
          </button>
        )}
        {cambio && <span className="text-[0.82rem] text-ambar">Hay cambios sin guardar.</span>}
      </div>
    </Formulario>
  );
}
