"use client";

import { useEffect, useRef } from "react";

/**
 * Lector de código de barras USB: "teclea" el código muy rápido y termina con
 * Enter. Este gancho lo reconoce en cualquier parte de la pantalla (sin tener
 * que hacer clic en un buscador) y distingue al lector de una persona
 * escribiendo por la velocidad entre teclas.
 *
 * Los campos con `data-lector-propio` manejan el lector por su cuenta.
 */
export function useLectorDeCodigos(alEscanear: (codigo: string) => void, activo = true) {
  const callback = useRef(alEscanear);
  callback.current = alEscanear;

  useEffect(() => {
    if (!activo) return;
    let buffer = "";
    let ultima = 0;
    let lento = false;

    function alTeclear(e: KeyboardEvent) {
      const objetivo = e.target as HTMLElement | null;
      if (objetivo?.closest?.("[data-lector-propio]")) return;
      const ahora = performance.now();
      const pausa = ahora - ultima;
      ultima = ahora;

      if (e.key === "Enter") {
        const codigo = buffer;
        const esLector = codigo.length >= 4 && !lento;
        buffer = "";
        lento = false;
        if (!esLector) return;
        e.preventDefault();
        e.stopPropagation();
        // Si el lector escribió en un campo de texto, se le quita lo que tecleó.
        if (objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement) {
          if (objetivo.value.endsWith(codigo)) objetivo.value = objetivo.value.slice(0, -codigo.length);
        }
        callback.current(codigo);
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      if (pausa > 120) {
        // Empieza otra secuencia.
        buffer = e.key;
        lento = false;
      } else {
        if (pausa > 45) lento = true;
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [activo]);
}
