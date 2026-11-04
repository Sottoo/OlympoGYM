"use client";

import { useState } from "react";
import { IconoWhatsApp } from "@/presentation/components/BotonWhatsApp";

/** Copiar la lista o abrir WhatsApp con ella escrita para mandarla al proveedor. */
export function CompartirPedido({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <>
      <button type="button" onClick={copiar} className="boton-secundario">
        {copiado ? "Copiada" : "Copiar lista"}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="boton-whatsapp">
        <IconoWhatsApp />
        Mandar por WhatsApp
      </a>
    </>
  );
}
