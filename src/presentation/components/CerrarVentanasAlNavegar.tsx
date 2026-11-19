"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Cuando una acción termina bien, el programa lleva a la página con su aviso
 * («Socio dado de baja», «Producto desactivado»…). En ese momento se cierra
 * la ventana de confirmación desde la que se envió, para que se vea el aviso
 * con su palomita y no una ventana vacía. Si la acción falla, no hay cambio
 * de página y la ventana se queda abierta mostrando el error.
 */
export function CerrarVentanasAlNavegar() {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const direccion = `${ruta}?${parametros.toString()}`;
  // Ventanas desde las que se envió un formulario y que esperan respuesta.
  const enviadas = useRef(new Set<HTMLDialogElement>());

  useEffect(() => {
    const alEnviar = (e: SubmitEvent) => {
      const ventana = (e.target as Element).closest("dialog[open]");
      if (ventana instanceof HTMLDialogElement) enviadas.current.add(ventana);
    };
    document.addEventListener("submit", alEnviar, true);
    return () => document.removeEventListener("submit", alEnviar, true);
  }, []);

  useEffect(() => {
    if (enviadas.current.size === 0) return;
    enviadas.current.forEach((d) => d.open && d.close());
    enviadas.current.clear();
    // Que el aviso de éxito quede a la vista.
    const exito = document.querySelector<HTMLElement>("[data-exito]");
    if (exito) {
      const { top, bottom } = exito.getBoundingClientRect();
      if (top < 0 || bottom > window.innerHeight) exito.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [direccion]);

  return null;
}
