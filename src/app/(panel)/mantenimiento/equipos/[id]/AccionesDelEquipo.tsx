"use client";

import { useActionState, useRef, useState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCambiarEstadoEquipo, accionEliminarEquipo } from "../../acciones";

type Vista = "baja" | "eliminar";

/** Dar de baja, reactivar o eliminar un equipo, explicando antes qué pasa. */
export function AccionesDelEquipo({ equipoId, nombre, activo, tieneHistorial }: { equipoId: string; nombre: string; activo: boolean; tieneHistorial: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [vista, setVista] = useState<Vista>("baja");
  const [estadoEliminar, eliminar] = useActionState(accionEliminarEquipo, estadoInicial);

  function abrir(v: Vista) {
    setVista(v);
    dialogo.current?.showModal();
  }

  return (
    <>
      {activo ? (
        <button type="button" onClick={() => abrir("baja")} className="boton-secundario">
          Dar de baja
        </button>
      ) : (
        <>
          <form action={accionCambiarEstadoEquipo}>
            <input type="hidden" name="equipoId" value={equipoId} />
            <input type="hidden" name="activo" value="true" />
            <BotonEnviar textoEnviando="Reactivando…">Reactivar</BotonEnviar>
          </form>
          {!tieneHistorial && (
            <button type="button" onClick={() => abrir("eliminar")} className="boton-peligro">
              Eliminar
            </button>
          )}
        </>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-dialogo-equipo"
        // Misma hoja que las demás confirmaciones.
        className="dialogo-whatsapp max-w-[32rem]"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id="titulo-dialogo-equipo" className="font-titulos text-[1.25rem] leading-tight">
              {vista === "baja" ? `¿Dar de baja «${nombre}»?` : `¿Eliminar «${nombre}» para siempre?`}
            </h2>
            <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>
          {vista === "baja" ? (
            <>
              <ul className="grid gap-1.5 text-[0.9rem] text-tinta-suave">
                <li>· Para máquinas que se vendieron, se tiraron o ya no se usan.</li>
                <li>· Deja de aparecer para reportar fallas y en los preventivos.</li>
                <li>· Su historial y lo que costó se conservan; puedes reactivarla.</li>
              </ul>
              {!tieneHistorial && (
                <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.86rem] text-gris">
                  ¿La diste de alta por error? Como no tiene historial, también puedes{" "}
                  <button type="button" onClick={() => setVista("eliminar")} className="enlace font-semibold text-rojo">
                    eliminarla
                  </button>
                  .
                </p>
              )}
              <form action={accionCambiarEstadoEquipo} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="equipoId" value={equipoId} />
                <input type="hidden" name="activo" value="false" />
                <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
                  Cancelar
                </button>
                <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
                  Sí, dar de baja
                </BotonEnviar>
              </form>
            </>
          ) : (
            <>
              <p className="text-[0.9rem] text-tinta-suave">
                Úsalo solo si lo diste de alta por error. <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
              </p>
              <MensajeError mensaje={estadoEliminar.error} titulo="No se pudo eliminar." />
              <form action={eliminar} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="equipoId" value={equipoId} />
                <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
                  Cancelar
                </button>
                <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
                  Sí, eliminar
                </BotonEnviar>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
