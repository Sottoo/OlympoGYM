"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icono, type NombreIcono } from "./Icono";
import { useCerrarAlTocarFuera } from "./formulario/flotante";

export interface OpcionMenu {
  texto: string;
  icono: NombreIcono;
  /** Acción que no se deshace (eliminar): va al final, en rojo y separada. */
  peligro?: boolean;
  /** Lleva a otra pantalla… */
  href?: string;
  /** …o hace algo aquí mismo (abrir una ventana de confirmación). */
  alElegir?: () => void;
}

/**
 * El botón «Más» de las fichas: junta las acciones poco frecuentes (editar,
 * dar de baja, eliminar…) para que la pantalla muestre solo lo del día a día.
 * Se usa con el ratón o con el teclado (flechas, Enter y Escape).
 */
export function MenuMas({ opciones, className = "", chico = false }: { opciones: OpcionMenu[]; className?: string; chico?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarAlTocarFuera(abierto, [caja], cerrar);
  // Al abrir, el foco va a la primera opción.
  useEffect(() => {
    if (abierto) caja.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [abierto]);

  if (opciones.length === 0) return null;

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAbierto(false);
      boton.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(caja.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  const clase = (peligro?: boolean) =>
    `opcion-muestrario w-full text-left text-[0.9rem] font-semibold hover:bg-hundido focus-visible:bg-hundido focus-visible:outline-none ${peligro ? "text-rojo hover:bg-rojo-tenue!" : ""}`;

  return (
    <div ref={caja} className={`relative ${className}`} onKeyDown={alTeclear}>
      <button ref={boton} type="button" className={chico ? "boton-secundario boton-chico" : "boton-secundario w-full"} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <Icono nombre="puntos" className="size-4" />
        Más
      </button>
      {abierto && (
        <div role="menu" aria-label="Más acciones" className="muestrario aparece absolute top-full right-0 z-20 mt-2 w-60">
          {opciones.map((o, i) => (
            <div key={o.texto}>
              {o.peligro && i > 0 && <hr aria-hidden className="mx-2 my-1.5 border-t border-dashed border-linea" />}
              {o.href ? (
                <Link href={o.href} role="menuitem" className={clase(o.peligro)} onClick={cerrar}>
                  <Icono nombre={o.icono} className="size-[17px]" />
                  {o.texto}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={clase(o.peligro)}
                  onClick={() => {
                    setAbierto(false);
                    o.alElegir?.();
                  }}
                >
                  <Icono nombre={o.icono} className="size-[17px]" />
                  {o.texto}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
