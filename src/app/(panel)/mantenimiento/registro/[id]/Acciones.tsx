"use client";

import { useActionState, useRef } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionEliminarAbono, accionEliminarMantenimiento } from "../../acciones";

/** Hoja de confirmación compartida. */
function Confirmacion({
  dialogo,
  titulo,
  children,
}: {
  dialogo: React.RefObject<HTMLDialogElement | null>;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={dialogo}
      aria-label={titulo}
      className="dialogo-whatsapp max-w-[30rem] text-left"
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
    >
      <div className="grid gap-4 p-6">
        <header className="flex items-start justify-between gap-4">
          <h2 className="font-titulos text-[1.25rem] leading-tight">{titulo}</h2>
          <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
            <Icono nombre="cerrar" className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function AnularPago({ abonoId, monto }: { abonoId: string; monto: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, accion] = useActionState(accionEliminarAbono, estadoInicial);
  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className="text-[0.8rem] font-semibold text-gris hover:text-rojo">
        Anular
      </button>
      <Confirmacion dialogo={dialogo} titulo={`¿Anular el pago de ${monto}?`}>
        <p className="text-[0.9rem] text-tinta-suave">Úsalo si se registró por error. El monto vuelve a quedar por pagar y, si fue en efectivo, deja de restarse en el corte de ese día.</p>
        <MensajeError mensaje={estado.error} titulo="No se pudo anular." />
        <form action={accion} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
          <input type="hidden" name="abonoId" value={abonoId} />
          <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
            Cancelar
          </button>
          <BotonEnviar textoEnviando="Anulando…" variante="boton-peligro">
            Sí, anular
          </BotonEnviar>
        </form>
      </Confirmacion>
    </>
  );
}

export function EliminarRegistro({ mantenimientoId, titulo, pagos }: { mantenimientoId: string; titulo: string; pagos: number }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, accion] = useActionState(accionEliminarMantenimiento, estadoInicial);
  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className="boton-peligro w-full">
        Eliminar registro
      </button>
      <Confirmacion dialogo={dialogo} titulo={`¿Eliminar la ${titulo}?`}>
        <p className="text-[0.9rem] text-tinta-suave">
          {pagos > 0 ? `También se borran sus ${pagos === 1 ? "pago" : `${pagos} pagos`}. ` : ""}
          Queda anotado en la bitácora. <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
        </p>
        <MensajeError mensaje={estado.error} titulo="No se pudo eliminar." />
        <form action={accion} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
          <input type="hidden" name="mantenimientoId" value={mantenimientoId} />
          <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
            Cancelar
          </button>
          <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
            Sí, eliminar
          </BotonEnviar>
        </form>
      </Confirmacion>
    </>
  );
}
