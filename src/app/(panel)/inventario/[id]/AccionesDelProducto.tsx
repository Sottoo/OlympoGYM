"use client";

import { useActionState, useRef, useState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCambiarEstadoProducto, accionEliminarProducto } from "../acciones";

type Vista = "desactivar" | "eliminar";

/**
 * Desactivar, reactivar o eliminar un producto, explicando antes qué pasa con
 * cada opción: desactivar lo oculta y conserva todo; eliminar es solo para
 * altas por error (sin ventas) y no se puede deshacer.
 */
export function AccionesDelProducto({
  productoId,
  nombre,
  activo,
  tieneVentas,
  movimientos,
}: {
  productoId: string;
  nombre: string;
  activo: boolean;
  tieneVentas: boolean;
  movimientos: number;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [vista, setVista] = useState<Vista>("desactivar");
  const [estadoEliminar, eliminar] = useActionState(accionEliminarProducto, estadoInicial);

  function abrir(v: Vista) {
    setVista(v);
    dialogo.current?.showModal();
  }

  return (
    <>
      {activo ? (
        <button type="button" onClick={() => abrir("desactivar")} className="boton-secundario">
          Desactivar
        </button>
      ) : (
        <>
          <form action={accionCambiarEstadoProducto}>
            <input type="hidden" name="productoId" value={productoId} />
            <input type="hidden" name="activo" value="true" />
            <BotonEnviar textoEnviando="Reactivando…">Reactivar</BotonEnviar>
          </form>
          {!tieneVentas && (
            <button type="button" onClick={() => abrir("eliminar")} className="boton-peligro">
              Eliminar
            </button>
          )}
        </>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-dialogo-producto"
        // Misma hoja que el mensaje de WhatsApp (fondo, sombra, costura y animación), más angosta.
        className="dialogo-whatsapp max-w-[32rem]"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id="titulo-dialogo-producto" className="font-titulos text-[1.25rem] leading-tight">
              {vista === "desactivar" ? `¿Desactivar «${nombre}»?` : `¿Eliminar «${nombre}» para siempre?`}
            </h2>
            <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>

          {vista === "desactivar" ? (
            <>
              <ul className="grid gap-1.5 text-[0.9rem] text-tinta-suave">
                <li>· Deja de aparecer en la Tienda, la lista de compra y los conteos.</li>
                <li>· Su historial de ventas y movimientos se conserva.</li>
                <li>· Puedes reactivarlo cuando quieras desde Inventario › Desactivados.</li>
              </ul>
              {!tieneVentas && (
                <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.86rem] text-gris">
                  ¿Lo diste de alta por error? Como no tiene ventas, también puedes{" "}
                  <button type="button" onClick={() => setVista("eliminar")} className="enlace font-semibold text-rojo">
                    eliminarlo
                  </button>
                  .
                </p>
              )}
              <form action={accionCambiarEstadoProducto} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="productoId" value={productoId} />
                <input type="hidden" name="activo" value="false" />
                <button type="button" onClick={() => dialogo.current?.close()} className="boton-secundario">
                  Cancelar
                </button>
                <BotonEnviar textoEnviando="Desactivando…" variante="boton-oscuro">
                  Sí, desactivar
                </BotonEnviar>
              </form>
            </>
          ) : (
            <>
              <p className="text-[0.9rem] text-tinta-suave">
                Úsalo solo si lo diste de alta por error.{" "}
                {movimientos > 0
                  ? `También se borran sus ${movimientos === 1 ? "movimiento" : `${movimientos} movimientos`} de inventario. `
                  : ""}
                <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
              </p>
              <MensajeError mensaje={estadoEliminar.error} titulo="No se pudo eliminar." />
              <form action={eliminar} className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
                <input type="hidden" name="productoId" value={productoId} />
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
