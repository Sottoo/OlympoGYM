"use client";

import { useActionState, useRef, useState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MenuMas } from "@/presentation/components/MenuMas";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCambiarEstadoEquipo, accionEliminarEquipo } from "../../acciones";

type Vista = "baja" | "eliminar";

/**
 * «Más» de la ficha de la máquina: editar sus datos, darla de baja o
 * eliminarla. Dar de baja y eliminar se confirman en su ventana. Si está dada
 * de baja, «Reactivar» se muestra a la vista.
 */
export function AccionesDelEquipo({ equipoId, nombre, activo, tieneHistorial }: { equipoId: string; nombre: string; activo: boolean; tieneHistorial: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [vista, setVista] = useState<Vista>("baja");
  const [estadoEliminar, eliminar] = useActionState(accionEliminarEquipo, estadoInicial);

  function abrir(v: Vista) {
    setVista(v);
    dialogo.current?.showModal();
  }
  const cerrar = () => dialogo.current?.close();

  return (
    <>
      {!activo && (
        <form action={accionCambiarEstadoEquipo}>
          <input type="hidden" name="equipoId" value={equipoId} />
          <input type="hidden" name="activo" value="true" />
          <BotonEnviar textoEnviando="Reactivando…" variante="boton-secundario">
            Reactivar
          </BotonEnviar>
        </form>
      )}
      <MenuMas
        opciones={[
          { texto: "Editar datos", icono: "editar", href: `/mantenimiento/equipos/${equipoId}/editar` },
          ...(activo ? [{ texto: "Dar de baja", icono: "pausa" as const, alElegir: () => abrir("baja") }] : []),
          { texto: "Eliminar para siempre", icono: "basura", peligro: true, alElegir: () => abrir("eliminar") },
        ]}
      />

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-dialogo-equipo"
        className="dialogo-whatsapp max-w-[32rem]"
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id="titulo-dialogo-equipo" className={`font-titulos text-[1.25rem] leading-tight ${vista === "eliminar" ? "text-rojo" : ""}`}>
              {vista === "baja" ? `¿Dar de baja «${nombre}»?` : `¿Eliminar «${nombre}» para siempre?`}
            </h2>
            <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>
          {vista === "baja" ? (
            <>
              <p className="text-[0.9rem] text-tinta-suave">Deja de aparecer para reportar fallas y en los preventivos. Su historial se conserva y se puede reactivar.</p>
              <form action={accionCambiarEstadoEquipo} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="equipoId" value={equipoId} />
                <input type="hidden" name="activo" value="false" />
                <button type="button" onClick={cerrar} className="boton-secundario">
                  Cancelar
                </button>
                <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
                  Dar de baja
                </BotonEnviar>
              </form>
            </>
          ) : (
            <>
              <p className="text-[0.9rem] text-tinta-suave">
                {tieneHistorial ? "Desaparece de la lista; lo que se gastó en ella se queda en el historial y en los gastos. " : "Se borra por completo. "}
                <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
              </p>
              <MensajeError mensaje={estadoEliminar.error} titulo="No se pudo eliminar." />
              <form action={eliminar} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="equipoId" value={equipoId} />
                <button type="button" onClick={cerrar} className="boton-secundario">
                  Cancelar
                </button>
                <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
                  Eliminar para siempre
                </BotonEnviar>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
