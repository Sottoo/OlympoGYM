"use client";

import { useRef, useState, useTransition } from "react";
import { Icono } from "@/presentation/components/Icono";
import { accionCancelarMembresia } from "../acciones";

interface Props {
  socioId: string;
  suscripcionId: string;
  plan: string;
  /** "26 nov 2026 – 2 dic 2026" */
  periodo: string;
  /** "$200", o null si no tiene pago. */
  importe: string | null;
  /** Día del corte del que sale el dinero, ya en texto. */
  cobradoEl: string | null;
}

/**
 * "Cancelar" en la membresía próxima (o la registrada hoy) del historial, para
 * cuando se cobró por error. Confirma en una ventana propia porque también
 * quita el pago del corte del día en que se cobró.
 */
export function BotonCancelarMembresia({ socioId, suscripcionId, plan, periodo, importe, cobradoEl }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [cancelando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => {
    if (!cancelando) dialogo.current?.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          dialogo.current?.showModal();
        }}
        className="enlace mt-0.5 text-[0.76rem]"
      >
        Cancelar
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={`titulo-cancelar-${suscripcionId}`}
        className="dialogo-whatsapp max-w-[30rem] text-left"
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id={`titulo-cancelar-${suscripcionId}`} className="font-titulos text-[1.25rem] leading-tight text-rojo">
              ¿Cancelar esta membresía?
            </h2>
            <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>

          <div className="flex items-start justify-between gap-3 rounded-[10px] border-[1.5px] border-dashed border-linea-fuerte px-4 py-3">
            <span>
              <b className="block text-[0.95rem] font-semibold">{plan}</b>
              <span className="text-[0.82rem] text-gris tabular-nums">{periodo}</span>
            </span>
            {importe && <span className="cifra text-[1.2rem]">{importe}</span>}
          </div>

          <p className="text-[0.9rem] text-tinta-suave">
            Se borran la membresía y su pago
            {importe && cobradoEl ? (
              <>
                , y los <b className="font-semibold text-tinta">{importe}</b> salen del corte del <b className="font-semibold text-tinta">{cobradoEl}</b>
              </>
            ) : null}
            . Úsalo solo si se cobró por error. Queda anotado en la bitácora.
          </p>

          {error && (
            <p role="alert" className="text-[0.86rem] font-semibold text-rojo">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
            <button type="button" className="boton-secundario" onClick={cerrar} disabled={cancelando}>
              No, dejarla
            </button>
            <button
              type="button"
              className="boton-peligro"
              disabled={cancelando}
              onClick={() => {
                setError(null);
                iniciar(async () => {
                  const r = await accionCancelarMembresia(socioId, suscripcionId);
                  if (r.ok) dialogo.current?.close();
                  else setError(r.error);
                });
              }}
            >
              {cancelando ? "Cancelando…" : "Sí, cancelarla"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
