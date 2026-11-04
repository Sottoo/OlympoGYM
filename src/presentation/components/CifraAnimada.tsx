"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que cuenta hasta su nuevo valor cuando cambia (por ejemplo, al
 * registrar una entrada). Al abrir la pantalla muestra el valor real de una
 * vez: nunca enseña una cifra que no es. Respeta "reducir movimiento".
 */
export function CifraAnimada({ valor, duracion = 650 }: { valor: number; duracion?: number }) {
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);

  useEffect(() => {
    const desde = anterior.current;
    anterior.current = valor;
    if (desde === valor || matchMedia("(prefers-reduced-motion: reduce)").matches) return setMostrado(valor);
    const inicio = performance.now();
    let cuadro = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      setMostrado(Math.round(desde + (valor - desde) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracion]);

  return <span className="tabular-nums">{mostrado.toLocaleString("es-MX")}</span>;
}
