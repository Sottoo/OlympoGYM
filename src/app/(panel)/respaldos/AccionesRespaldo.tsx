"use client";

import { CampoArchivo, Casilla } from "@/presentation/components/formulario/campos";
import { useActionState, useEffect, useState, useTransition } from "react";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { escritorio } from "@/presentation/escritorio";
import { accionCambiarCarpetaExtra, accionCrearRespaldo, accionRestaurar } from "./acciones";

type Aviso = { tono: "ok" | "error" | "info"; texto: React.ReactNode } | null;

function AvisoAccion({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const tonos = { ok: "bg-verde-tenue", error: "bg-rojo-tenue", info: "bg-hundido" };
  return (
    <div role="status" className={`aparece rounded-[12px] px-4 py-3 text-[0.92rem] ${tonos[aviso.tono]}`}>
      {aviso.texto}
    </div>
  );
}

/** Crear un respaldo al momento, enviarlo por WhatsApp o abrir la carpeta. */
export function BotonesRespaldo({ carpeta }: { carpeta: string }) {
  const [trabajando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enEscritorio, setEnEscritorio] = useState(false);
  useEffect(() => setEnEscritorio(Boolean(escritorio())), []);

  function crear(paraWhatsApp: boolean) {
    setAviso(null);
    iniciar(async () => {
      const r = await accionCrearRespaldo();
      if (!r.ok) return setAviso({ tono: "error", texto: r.error });
      const puente = escritorio();
      if (paraWhatsApp && puente) {
        await puente.mostrarArchivo(r.valor.ruta);
        await puente.abrirWhatsApp();
        return setAviso({
          tono: "info",
          texto: (
            <>
              <strong className="font-semibold">Respaldo listo.</strong> Se abrió la carpeta con el archivo seleccionado y WhatsApp. Arrastra el
              archivo <span className="font-medium">{r.valor.nombre}</span> al chat donde quieras guardarlo (por ejemplo, a tu propio número).
              WhatsApp no permite adjuntarlo de forma automática.
            </>
          ),
        });
      }
      if (paraWhatsApp) window.location.href = `/api/respaldos/${encodeURIComponent(r.valor.nombre)}`;
      setAviso({
        tono: r.valor.copiaExtra && r.valor.copiaExtra !== "ok" ? "error" : "ok",
        texto:
          r.valor.copiaExtra && r.valor.copiaExtra !== "ok"
            ? r.valor.copiaExtra
            : `Respaldo creado: ${r.valor.nombre}${r.valor.copiaExtra === "ok" ? ", también copiado a la carpeta extra." : "."}`,
      });
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => crear(false)} disabled={trabajando} className="boton">
          {trabajando ? "Creando respaldo…" : "Crear respaldo ahora"}
        </button>
        <button onClick={() => crear(true)} disabled={trabajando} className="boton-secundario">
          Enviar por WhatsApp
        </button>
        {enEscritorio && (
          <button onClick={() => escritorio()?.abrirCarpeta(carpeta)} className="boton-secundario">
            Abrir carpeta de respaldos
          </button>
        )}
      </div>
      <AvisoAccion aviso={aviso} />
    </div>
  );
}

/** Carpeta extra (Google Drive, OneDrive o USB) donde se copia cada respaldo. */
export function CarpetaExtra({ actual }: { actual: string | null }) {
  const [trabajando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enEscritorio, setEnEscritorio] = useState(false);
  useEffect(() => setEnEscritorio(Boolean(escritorio())), []);

  function cambiar(ruta: string | null) {
    iniciar(async () => {
      const r = await accionCambiarCarpetaExtra(ruta);
      setAviso(r.ok ? { tono: "ok", texto: ruta ? "Listo: cada respaldo se copiará también en esa carpeta." : "Se quitó la carpeta extra." } : { tono: "error", texto: r.error });
    });
  }

  async function elegir() {
    const ruta = await escritorio()?.elegirCarpeta();
    if (ruta) cambiar(ruta);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-linea bg-superficie px-4 py-3">
        <span className={`size-2 shrink-0 rounded-full ${actual ? "bg-verde" : "bg-ambar"}`} aria-hidden />
        <span className={`min-w-0 flex-1 text-[0.92rem] ${actual ? "truncate" : ""}`} title={actual ?? undefined}>
          {actual ?? <span className="text-gris">Sin carpeta extra: los respaldos solo están en esta computadora.</span>}
        </span>
        {enEscritorio ? (
          <button onClick={elegir} disabled={trabajando} className="boton-secundario boton-chico">
            {actual ? "Cambiar carpeta" : "Elegir carpeta"}
          </button>
        ) : (
          <span className="text-[0.82rem] text-gris">Se elige desde el programa instalado.</span>
        )}
        {actual && (
          <button onClick={() => cambiar(null)} disabled={trabajando} className="text-[0.84rem] text-gris hover:text-tinta">
            Quitar
          </button>
        )}
      </div>
      <AvisoAccion aviso={aviso} />
    </div>
  );
}

/** Restaurar reemplaza toda la información: se pide el archivo y una confirmación explícita. */
export function FormularioRestaurar() {
  const [estado, accion] = useActionState(accionRestaurar, {});
  const [confirmo, setConfirmo] = useState(false);
  return (
    <form action={accion} className="grid gap-4">
      <MensajeError mensaje={estado.error} />
      <div>
        <label htmlFor="respaldo" className="etiqueta">Archivo del respaldo</label>
        <CampoArchivo
          id="respaldo"
          nombre="respaldo"
          acepta=".zip,application/zip"
          requerido
          texto="Suelta aquí el respaldo o haz clic para elegirlo"
          detalle="Un archivo .zip hecho por este programa (por ejemplo, respaldo-olimpo-2026-10-21.zip)."
        />
      </div>
      <Casilla nombre="confirmo" marcada={confirmo} alCambiar={setConfirmo}>
        Entiendo que se reemplazará toda la información actual por la del respaldo. Antes se guarda una copia de lo actual.
      </Casilla>
      <div>
        <BotonEnviar textoEnviando="Restaurando…" variante="boton-peligro" disabled={!confirmo}>
          Restaurar este respaldo
        </BotonEnviar>
      </div>
    </form>
  );
}
