"use client";

import { useState } from "react";
import { escritorio } from "@/presentation/escritorio";
import type { EstadoLector } from "./lectorDeHuellas";

/** Página oficial de descarga del programa de HID (para cuando no se usa la app de escritorio). */
const PAGINA_HID = "https://crossmatch.hid.gl/lite-client/";

type Paso = { tipo: "inicio" } | { tipo: "descargando" } | { tipo: "abierto" } | { tipo: "error"; mensaje: string };

/**
 * Cuando el lector de huellas no está disponible: explica qué falta y, si es
 * el programa de HID, lo descarga de la página oficial de HID y abre su
 * instalador. Al terminar se vuelve a intentar la conexión.
 */
export function AyudaLector({ estado, reconectar, className = "" }: { estado: EstadoLector; reconectar: () => void; className?: string }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "inicio" });
  if (estado !== "sin_programa" && estado !== "sin_lector") return null;

  if (estado === "sin_lector") {
    return (
      <p className={`text-[0.84rem] text-gris ${className}`}>
        Conecta el lector de huellas a la computadora.{" "}
        <button type="button" onClick={reconectar} className="enlace">
          Reintentar
        </button>
      </p>
    );
  }

  async function instalar() {
    const puente = escritorio();
    if (!puente) {
      window.open(PAGINA_HID, "_blank", "noopener");
      return setPaso({ tipo: "abierto" });
    }
    setPaso({ tipo: "descargando" });
    const r = await puente.instalarLector();
    setPaso(r.ok ? { tipo: "abierto" } : { tipo: "error", mensaje: r.error });
  }

  return (
    <div role="status" className={`grid gap-2 rounded-[10px] border-[1.5px] border-dashed border-linea-fuerte px-4 py-3 text-[0.86rem] ${className}`}>
      {paso.tipo === "abierto" ? (
        <p className="text-tinta-suave">
          Sigue los pasos del instalador de HID. Cuando termine, conecta el lector y da clic en <b className="font-semibold">Reintentar</b>.
        </p>
      ) : (
        <p className="text-tinta-suave">
          Para usar el lector de huellas falta instalar el programa gratuito de HID (fabricante del lector). Se descarga de su página oficial (unos 55 MB).
        </p>
      )}
      {paso.tipo === "error" && <p className="font-semibold text-rojo">{paso.mensaje}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {paso.tipo !== "abierto" && (
          <button type="button" onClick={instalar} disabled={paso.tipo === "descargando"} className="boton-secundario">
            {paso.tipo === "descargando" ? "Descargando…" : "Instalar programa del lector"}
          </button>
        )}
        <button type="button" onClick={reconectar} className="enlace">
          Reintentar
        </button>
      </div>
    </div>
  );
}
