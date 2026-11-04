"use client";

import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Posición de un panel flotante (lista de opciones, calendario) junto a su
 * campo. Se dibuja fuera del formulario —en el cuerpo de la página— para que
 * ninguna tabla o tarjeta con scroll lo recorte, y se voltea hacia arriba si
 * abajo no cabe.
 */
export function usePosicionFlotante(ancla: RefObject<HTMLElement | null>, abierto: boolean, alto: number, anchoMinimo = 0) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);

  const medir = useCallback(() => {
    const el = ancla.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ancho = Math.max(r.width, anchoMinimo);
    const cabeAbajo = window.innerHeight - r.bottom >= alto + 12;
    const arriba = !cabeAbajo && r.top > window.innerHeight - r.bottom;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8);
    setPos({ top: arriba ? r.top - 6 : r.bottom + 6, left, width: ancho, arriba });
  }, [ancla, alto, anchoMinimo]);

  useLayoutEffect(() => {
    if (abierto) medir();
  }, [abierto, medir]);

  useEffect(() => {
    if (!abierto) return;
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto, medir]);

  return pos;
}

/** Cierra el panel al tocar fuera de él y de su campo. */
export function useCerrarAlTocarFuera(abierto: boolean, elementos: RefObject<HTMLElement | null>[], cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const alTocar = (e: PointerEvent) => {
      const objetivo = e.target as Node;
      if (elementos.some((r) => r.current?.contains(objetivo))) return;
      cerrar();
    };
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, [abierto, elementos, cerrar]);
}

/** El panel flotante: una hoja con su costura, pegada al campo. */
export function PanelFlotante({
  pos,
  panel,
  children,
  className = "",
  etiqueta,
}: {
  pos: { top: number; left: number; width: number; arriba: boolean } | null;
  panel: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  className?: string;
  etiqueta?: string;
}) {
  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role={etiqueta ? "dialog" : undefined}
      aria-label={etiqueta}
      className={`muestrario ${pos.arriba ? "muestrario-arriba" : ""} ${className}`}
      style={{ position: "fixed", left: pos.left, width: pos.width, ...(pos.arriba ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Quita acentos y mayúsculas para buscar escribiendo ("medico" encuentra "Médico"). */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
