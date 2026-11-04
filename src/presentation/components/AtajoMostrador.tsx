"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export const ID_BUSQUEDA_MOSTRADOR = "mostrador-busqueda";

/**
 * F2 desde cualquier pantalla lleva al mostrador con el cursor listo para
 * escribir o escanear. Es la acción más frecuente de recepción.
 */
export function AtajoMostrador() {
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "F2") return;
      e.preventDefault();
      const campo = document.getElementById(ID_BUSQUEDA_MOSTRADOR);
      if (campo) campo.focus();
      else router.push("/panel");
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [router, ruta]);

  return null;
}
