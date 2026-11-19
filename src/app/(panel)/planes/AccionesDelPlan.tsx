"use client";

import { useActionState, useRef } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MenuMas } from "@/presentation/components/MenuMas";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCambiarEstadoPlan, accionEliminarPlan } from "./acciones";

/**
 * «Más» de cada plan: desactivarlo (deja de venderse, se puede reactivar) o
 * eliminarlo para siempre, con su ventana de confirmación.
 */
export function AccionesDelPlan({
  planId,
  nombre,
  activo,
  vendido,
  unicaVisita,
}: {
  planId: string;
  nombre: string;
  activo: boolean;
  /** Ya se cobró alguna vez: al eliminarlo, las membresías se conservan. */
  vendido: boolean;
  /** Es el único plan de visita activo: sin él no se pueden cobrar visitas. */
  unicaVisita: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const estadoForm = useRef<HTMLFormElement>(null);
  const [estado, eliminar] = useActionState(accionEliminarPlan, estadoInicial);
  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <form ref={estadoForm} action={accionCambiarEstadoPlan} className="hidden">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="nombre" value={nombre} />
        <input type="hidden" name="activo" value={String(!activo)} />
      </form>
      <MenuMas
        chico
        opciones={[
          { texto: activo ? "Desactivar" : "Activar", icono: activo ? "pausa" : "check", alElegir: () => estadoForm.current?.requestSubmit() },
          { texto: "Eliminar para siempre", icono: "basura", peligro: true, alElegir: () => dialogo.current?.showModal() },
        ]}
      />

      <dialog
        ref={dialogo}
        aria-labelledby={`titulo-eliminar-${planId}`}
        className="dialogo-whatsapp max-w-[32rem] text-left"
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id={`titulo-eliminar-${planId}`} className="font-titulos text-[1.25rem] leading-tight text-rojo">
              ¿Eliminar «{nombre}» para siempre?
            </h2>
            <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>
          <p className="text-[0.9rem] whitespace-normal text-tinta-suave">
            {vendido ? "Deja de aparecer; los socios que lo tienen conservan su membresía y los cortes no cambian. " : "Se borra por completo. "}
            <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
          </p>
          {unicaVisita && (
            <p className="rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.86rem] whitespace-normal">
              Es tu único plan de visita: sin él, el mostrador no podrá cobrar a quien llega sin membresía.
            </p>
          )}
          <MensajeError mensaje={estado.error} titulo="No se pudo eliminar." />
          <form action={eliminar} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
            <input type="hidden" name="planId" value={planId} />
            <button type="button" onClick={cerrar} className="boton-secundario">
              Cancelar
            </button>
            <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
              Eliminar para siempre
            </BotonEnviar>
          </form>
        </div>
      </dialog>
    </>
  );
}
