"use client";

import { useEffect, useRef, useState } from "react";
import { escritorio } from "@/presentation/escritorio";
import { Icono } from "@/presentation/components/Icono";

type Paso = { tipo: "inicio" } | { tipo: "respaldando" } | { tipo: "listo"; archivo: string } | { tipo: "error"; mensaje: string };

/**
 * Aviso en el riel cuando ya se descargó una versión nueva (ver
 * electron/actualizador.cjs). Hay tres formas de instalarla y todas hacen
 * antes un respaldo comprobado:
 *   · No hacer nada: se instala sola al cerrar el programa.
 *   · "Actualizar ahora" aquí, o clic en la notificación de Windows: abre esta
 *     ventana, respalda, cierra, instala y vuelve a abrir.
 * Si el respaldo falla, no se actualiza y el programa sigue igual.
 * En el navegador no aparece.
 */
export function AvisoDeActualizacion() {
  const [version, setVersion] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>({ tipo: "inicio" });
  const dialogo = useRef<HTMLDialogElement>(null);
  const trabajando = paso.tipo === "respaldando" || paso.tipo === "listo";

  useEffect(() => {
    const puente = escritorio();
    if (!puente?.actualizacionLista || !puente.alHaberActualizacion) return;
    const abrir = () => {
      setPaso((p) => (p.tipo === "respaldando" || p.tipo === "listo" ? p : { tipo: "inicio" }));
      if (!dialogo.current?.open) dialogo.current?.showModal();
    };
    void puente.actualizacionLista().then((info) => info && setVersion(info.version));
    const dejarDeOir = [
      puente.alHaberActualizacion((info) => setVersion(info.version)),
      // Clic en la notificación de Windows.
      puente.alPedirActualizar?.(() => {
        void puente.actualizacionLista?.().then((info) => {
          if (!info) return;
          setVersion(info.version);
          abrir();
        });
      }),
    ];
    return () => dejarDeOir.forEach((f) => f?.());
  }, []);

  if (!version) return null;

  async function actualizar() {
    setPaso({ tipo: "respaldando" });
    try {
      const r = await escritorio()?.actualizarAhora?.();
      if (!r) return setPaso({ tipo: "error", mensaje: "Esta versión del programa no puede actualizarse desde aquí." });
      setPaso(r.ok ? { tipo: "listo", archivo: r.archivo } : { tipo: "error", mensaje: r.error });
    } catch {
      setPaso({ tipo: "error", mensaje: "No hubo respuesta. No se actualizó y todo sigue igual; intenta de nuevo." });
    }
  }

  const cerrar = () => {
    if (!trabajando) dialogo.current?.close();
  };

  return (
    <>
      <div role="status" className="grid gap-2 rounded-[10px] border-[1.5px] border-dashed border-white/25 px-3 py-2.5 text-[0.8rem] leading-snug text-[#f2efe8]/75">
        <p>
          <b className="block text-[0.86rem] font-semibold text-white">Versión nueva lista</b>
          Se instala al cerrar el programa.
        </p>
        <button
          type="button"
          onClick={() => {
            setPaso({ tipo: "inicio" });
            dialogo.current?.showModal();
          }}
          className="w-fit rounded-[8px] bg-white/10 px-2.5 py-1.5 text-[0.8rem] font-semibold text-white hover:bg-white/[0.16]"
        >
          Actualizar ahora
        </button>
      </div>

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-actualizar"
        className="dialogo-whatsapp max-w-[30rem] text-tinta"
        // Mientras respalda no se puede cerrar con Esc ni con clic afuera.
        onCancel={(e) => trabajando && e.preventDefault()}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        <div className="grid gap-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 id="titulo-actualizar" className="font-titulos text-[1.25rem] leading-tight">
              Actualizar a la versión {version}
            </h2>
            {!trabajando && (
              <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
                <Icono nombre="cerrar" className="size-5" />
              </button>
            )}
          </header>

          <ol className="grid gap-2 text-[0.9rem] text-tinta-suave" aria-live="polite">
            <li className="flex gap-2.5">
              <Numero n={1} activo={paso.tipo === "respaldando"} hecho={paso.tipo === "listo"} />
              <span>
                {paso.tipo === "listo" ? (
                  <>
                    <b className="font-semibold text-verde">Respaldo listo</b> ({paso.archivo}).
                  </>
                ) : (
                  <>
                    Se hace un <b className="font-semibold text-tinta">respaldo</b> de toda la información (socios, pagos, fotos) en Documentos\Olimpo GYM\Respaldos.
                  </>
                )}
              </span>
            </li>
            <li className="flex gap-2.5">
              <Numero n={2} activo={paso.tipo === "listo"} />
              <span>
                {paso.tipo === "listo" ? (
                  <b className="font-semibold text-tinta">Reiniciando con la versión nueva… se vuelve a abrir solo en unos segundos.</b>
                ) : (
                  "El programa se reinicia con la versión nueva y se vuelve a abrir solo (unos segundos)."
                )}
              </span>
            </li>
          </ol>

          {paso.tipo === "respaldando" && (
            <p role="status" className="text-[0.88rem] font-semibold text-tinta">
              Haciendo el respaldo… no apagues la computadora.
            </p>
          )}
          {paso.tipo === "error" && (
            <p role="alert" className="text-[0.88rem] font-semibold text-rojo">
              {paso.mensaje}
            </p>
          )}
          {paso.tipo === "inicio" && (
            <p className="text-[0.82rem] text-gris">Si prefieres hacerlo después, se instala sola (también con respaldo) cuando cierres el programa.</p>
          )}

          {paso.tipo !== "listo" && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
              <button type="button" className="boton-secundario" onClick={cerrar} disabled={trabajando}>
                Más tarde
              </button>
              <button type="button" className="boton" onClick={() => void actualizar()} disabled={trabajando}>
                {paso.tipo === "respaldando" ? "Respaldando…" : paso.tipo === "error" ? "Intentar de nuevo" : "Respaldar y actualizar"}
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function Numero({ n, activo = false, hecho = false }: { n: number; activo?: boolean; hecho?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed text-[0.75rem] font-bold ${
        hecho ? "border-verde bg-verde text-white" : activo ? "animate-pulse border-tinta bg-tinta text-white" : "border-linea-fuerte text-gris"
      }`}
    >
      {hecho ? <Icono nombre="check" className="size-3.5" /> : n}
    </span>
  );
}
