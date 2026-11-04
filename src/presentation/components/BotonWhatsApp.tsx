"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { formatearTelefono } from "@/shared/formato";
import { type ContextoMensaje, enlaceWhatsApp, REDACCIONES, redactarMensaje, sinFormato, tarjetaDelMensaje } from "../whatsapp";
import { Icono } from "./Icono";
import { type ManejoTarjeta, TarjetaWhatsApp } from "./TarjetaWhatsApp";

/**
 * Botón para escribirle al socio por WhatsApp. Antes de abrir WhatsApp
 * muestra el mensaje que se va a mandar (corto y adaptado a su situación) y
 * una imagen con el mismo aviso. «Abrir WhatsApp» copia la imagen y abre el
 * chat con el texto escrito. Si la redacción no convence, "Otra redacción"
 * lo dice de otra forma.
 */
export function BotonWhatsApp({ telefono, contexto, compacto = false }: { telefono: string; contexto: ContextoMensaje; compacto?: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tarjeta = useRef<ManejoTarjeta>(null);
  const [abierto, setAbierto] = useState(false);
  const [variante, setVariante] = useState(0);
  const [copiado, setCopiado] = useState<"texto" | "imagen" | "error" | null>(null);
  const mensaje = redactarMensaje(contexto, variante);
  const datosTarjeta = useMemo(
    () => ({ ...tarjetaDelMensaje(contexto), socio: contexto.nombreCompleto ?? contexto.nombre, plan: contexto.plan, cumpleHoy: Boolean(contexto.cumpleHoy) }),
    [contexto],
  );

  function abrir() {
    setVariante(0);
    setCopiado(null);
    setAbierto(true);
    dialogo.current?.showModal();
  }

  function avisar(que: "texto" | "imagen" | "error") {
    setCopiado(que);
    setTimeout(() => setCopiado((actual) => (actual === que ? null : actual)), 2500);
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(mensaje);
      avisar("texto");
    } catch {
      avisar("error");
    }
  }

  /** Deja la imagen en el portapapeles. Devuelve la imagen si no se pudo copiar (o null si ni se generó). */
  async function imagenAlPortapapeles(): Promise<{ ok: true } | { ok: false; png: Blob | null }> {
    const png = (await tarjeta.current?.png()) ?? null;
    if (!png) return { ok: false, png };
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      return { ok: true };
    } catch {
      return { ok: false, png };
    }
  }

  async function copiarImagen() {
    const r = await imagenAlPortapapeles();
    if (r.ok) return avisar("imagen");
    if (!r.png) return avisar("error");
    // Si el portapapeles no acepta imágenes, se descarga para adjuntarla a mano.
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(r.png);
    enlace.download = `aviso-${contexto.nombre.toLowerCase()}.png`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  /**
   * Lo más automático que permite WhatsApp sin su API: copia la imagen y abre
   * el chat con el texto ya escrito. En WhatsApp solo falta Ctrl+V y enviar.
   * (El enlace de WhatsApp acepta texto, no imágenes.)
   */
  async function abrirWhatsApp(evento: React.MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault();
    const enlace = evento.currentTarget.href;
    await imagenAlPortapapeles();
    window.open(enlace, "_blank", "noopener");
    dialogo.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-verde ${compacto ? "text-[0.78rem] hover:underline" : "rounded-[10px] border-[1.5px] border-verde/40 px-3.5 py-2 text-[0.88rem] hover:border-verde hover:bg-verde-tenue"}`}
        title="Ver el mensaje y abrir WhatsApp"
      >
        <IconoWhatsApp />
        {compacto ? "Escribir" : "Mensaje por WhatsApp"}
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={`wa-${contexto.socioId}`}
        className="dialogo-whatsapp"
        onClose={() => setAbierto(false)}
        onClick={(e) => {
          // Clic fuera de la hoja: se cierra.
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="grid gap-5 p-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="rotulo">Mensaje por WhatsApp</p>
              <h2 id={`wa-${contexto.socioId}`} className="mt-1 font-titulos text-[1.3rem] leading-tight">
                Para {contexto.nombreCompleto ?? contexto.nombre}
              </h2>
              <p className="mt-0.5 text-[0.84rem] text-gris tabular-nums">{formatearTelefono(telefono)}</p>
            </div>
            <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <Icono nombre="cerrar" className="size-5" />
            </button>
          </header>

          <div className="grid items-start gap-5 sm:grid-cols-[15rem_minmax(0,1fr)]">
            <figure className="grid gap-2">
              {/* Se dibuja solo con el diálogo abierto: no carga fuentes ni logo por cada fila de la lista. */}
              {abierto ? <TarjetaWhatsApp ref={tarjeta} datos={datosTarjeta} className="aspect-square w-full rounded-[10px] shadow-md" /> : <div className="aspect-square w-full rounded-[10px] bg-carbon" />}
              <button type="button" onClick={copiarImagen} className="boton-secundario boton-chico justify-center">
                <Icono nombre="foto" className="size-4" />
                {copiado === "imagen" ? "Imagen copiada" : "Copiar imagen"}
              </button>
            </figure>

            <div className="grid gap-3">
              <div className="burbuja-whatsapp" aria-live="polite">
                <MensajeConFormato texto={mensaje} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setVariante((v) => (v + 1) % REDACCIONES)} className="boton-secundario boton-chico">
                  Otra redacción
                </button>
                <button type="button" onClick={copiarTexto} className="boton-secundario boton-chico" aria-label={`Copiar el mensaje: ${sinFormato(mensaje).slice(0, 40)}…`}>
                  {copiado === "texto" ? "Texto copiado" : "Copiar texto"}
                </button>
              </div>
              {copiado === "error" && <p className="text-[0.8rem] font-semibold text-rojo">No se pudo copiar. Inténtalo de nuevo.</p>}
            </div>
          </div>

          <ol className="grid gap-1 text-[0.8rem] text-gris">
            <li>
              <b className="text-tinta">1.</b> «Abrir WhatsApp» copia la imagen y abre el chat con el texto ya escrito.
            </li>
            <li>
              <b className="text-tinta">2.</b> En el chat pega la imagen con <kbd>Ctrl</kbd>+<kbd>V</kbd> y envía.
            </li>
          </ol>

          <div className="flex items-center justify-end border-t border-linea pt-4">
            <a href={enlaceWhatsApp(telefono, mensaje)} target="_blank" rel="noopener noreferrer" onClick={abrirWhatsApp} className="boton-whatsapp">
              <IconoWhatsApp />
              Abrir WhatsApp
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Muestra *negritas* y _cursivas_ como se verán en WhatsApp. */
function MensajeConFormato({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linea, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {linea.split(/(\*[^*]+\*|_[^_]+_)/g).map((parte, j) =>
            parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
              <strong key={j} className="font-semibold">{parte.slice(1, -1)}</strong>
            ) : parte.startsWith("_") && parte.endsWith("_") && parte.length > 2 ? (
              <em key={j} className="text-gris">{parte.slice(1, -1)}</em>
            ) : (
              <Fragment key={j}>{parte}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

export function IconoWhatsApp() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
