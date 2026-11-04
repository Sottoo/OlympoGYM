"use client";

import { useActionState, useEffect, useRef } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Icono } from "@/presentation/components/Icono";
import { accionCerrarReporte } from "./acciones";

/**
 * Cerrar una falla sin registrar un mantenimiento (se arregló sola, se
 * ajustó un tornillo, no era falla). Se pide el motivo: queda en la bitácora.
 */
export function CerrarReporte({ reporteId, equipo }: { reporteId: string; equipo: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, accion] = useActionState(accionCerrarReporte, estadoInicial);

  useEffect(() => {
    if (estado.exito) dialogo.current?.close();
  }, [estado]);

  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className="boton-secundario boton-chico">
        Ya quedó, sin costo
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={`cerrar-${reporteId}`}
        className="dialogo-whatsapp max-w-[30rem]"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <Formulario action={accion} estado={estado} className="grid gap-4 p-6">
          <input type="hidden" name="reporteId" value={reporteId} />
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`cerrar-${reporteId}`} className="font-titulos text-[1.25rem] leading-tight">Cerrar la falla de «{equipo}»</h2>
              <p className="mt-1 text-[0.86rem] text-gris">Para cuando se resolvió sin pagarle a nadie. Si hubo un gasto, mejor registra el arreglo.</p>
            </div>
            <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>
          <div>
            <Etiqueta para={`cierre-${reporteId}`}>¿Qué pasó?</Etiqueta>
            <input
              id={`cierre-${reporteId}`}
              name="cierre"
              required
              maxLength={120}
              className="campo"
              placeholder="Ej. se ajustó el tornillo del asiento"
              data-regla="texto:3"
              data-falta="Escribe brevemente cómo se resolvió."
            />
            <Ayuda para="cierre" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
            <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
              Cancelar
            </button>
            <BotonEnviar textoEnviando="Cerrando…" variante="boton-oscuro">
              Cerrar la falla
            </BotonEnviar>
          </div>
        </Formulario>
      </dialog>
    </>
  );
}
