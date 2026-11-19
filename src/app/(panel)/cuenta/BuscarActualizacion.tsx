"use client";

import { useEffect, useState } from "react";
import { escritorio } from "@/presentation/escritorio";

type Paso =
  | { tipo: "inicio" }
  | { tipo: "buscando" }
  | { tipo: "al-dia"; publicada: string | null }
  | { tipo: "lista"; version: string }
  | { tipo: "error"; mensaje: string };

/**
 * «Buscar actualización»: revisa en ese momento si hay versión nueva, en vez
 * de esperar a la revisión automática. Si la hay, la descarga y abre la
 * ventana de «Respaldar y actualizar». Solo existe en el programa instalado.
 */
export function BuscarActualizacion({ version }: { version: string }) {
  const [disponible, setDisponible] = useState(false);
  const [paso, setPaso] = useState<Paso>({ tipo: "inicio" });

  useEffect(() => setDisponible(Boolean(escritorio()?.buscarActualizacion)), []);
  if (!disponible) return null;

  async function buscar() {
    setPaso({ tipo: "buscando" });
    try {
      const r = await escritorio()?.buscarActualizacion?.();
      if (!r || r.estado === "desarrollo") return setPaso({ tipo: "error", mensaje: "Las actualizaciones solo funcionan en el programa instalado." });
      if (r.estado === "al-dia") return setPaso({ tipo: "al-dia", publicada: r.publicada });
      if (r.estado === "lista") return setPaso({ tipo: "lista", version: r.version });
      setPaso({ tipo: "error", mensaje: r.mensaje });
    } catch {
      setPaso({ tipo: "error", mensaje: "No se pudo buscar la actualización. Intenta de nuevo." });
    }
  }

  return (
    <div className="mt-2 grid gap-1.5">
      <button type="button" onClick={() => void buscar()} disabled={paso.tipo === "buscando"} className="boton-secundario w-fit">
        {paso.tipo === "buscando" ? (
          <>
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-linea-fuerte border-t-tinta" />
            Buscando y descargando…
          </>
        ) : (
          "Buscar actualización"
        )}
      </button>
      <p role="status" aria-live="polite" className="text-[0.82rem]">
        {paso.tipo === "buscando" && <span className="text-gris">Si hay una versión nueva, se descarga ahora (un minuto o dos). Puedes seguir trabajando.</span>}
        {paso.tipo === "al-dia" && (
          <span className="font-semibold text-verde">Ya tienes la versión más nueva ({paso.publicada && paso.publicada !== version ? paso.publicada : version}).</span>
        )}
        {paso.tipo === "lista" && (
          <span className="font-semibold text-tinta">La versión {paso.version} está lista. Se abrió la ventana para respaldar y actualizar.</span>
        )}
        {paso.tipo === "error" && <span className="font-semibold text-rojo">{paso.mensaje}</span>}
      </p>
    </div>
  );
}
