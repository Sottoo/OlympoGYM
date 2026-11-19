"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icono } from "@/presentation/components/Icono";

/** Pausa al teclear antes de buscar: no se consulta en cada letra. */
const PAUSA_MS = 250;

/**
 * Buscador de la lista de socios: busca mientras se escribe (sin Enter ni
 * botón). Cambia ?q= en la dirección, así la lista se filtra en el servidor
 * igual que antes y se conserva el filtro elegido (activos, por vencer…).
 */
export function BuscadorSocios({ inicial }: { inicial: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(inicial);
  const [buscando, iniciar] = useTransition();
  const ultimoEnviado = useRef(inicial);

  useEffect(() => {
    const buscado = texto.trim();
    if (buscado === ultimoEnviado.current) return;
    const espera = setTimeout(() => {
      ultimoEnviado.current = buscado;
      const p = new URLSearchParams(parametros.toString());
      if (buscado) p.set("q", buscado);
      else p.delete("q");
      p.delete("eliminado");
      const qs = p.toString();
      // replace: buscar no llena el historial de "atrás".
      iniciar(() => router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false }));
    }, PAUSA_MS);
    return () => clearTimeout(espera);
  }, [texto, parametros, ruta, router]);

  return (
    <div role="search" className="flex w-full gap-2 sm:w-[19rem]">
      <label htmlFor="q" className="sr-only">
        Buscar socio
      </label>
      <div className="relative flex-1">
        <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gris" />
        <input
          id="q"
          name="q"
          type="search"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTexto("");
          }}
          placeholder="Nombre, apellido, número o celular"
          className="campo pl-8"
          aria-busy={buscando}
        />
        {buscando && (
          <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-linea-fuerte border-t-tinta" />
        )}
      </div>
      {texto && (
        <button type="button" onClick={() => setTexto("")} className="boton-secundario">
          Limpiar
        </button>
      )}
    </div>
  );
}
