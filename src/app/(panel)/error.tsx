"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Si una pantalla falla, se explica en español y se puede reintentar sin cerrar el programa. */
export default function ErrorDelPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="superficie mx-auto mt-10 max-w-xl px-8 py-10 text-center">
      {/* Una mancuerna que se cayó al piso. */}
      <svg aria-hidden viewBox="0 0 64 64" className="mx-auto mb-5 size-16">
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-tinta)" strokeWidth="2" />
        <g transform="translate(4 -3) rotate(-24 32 34)">
          <rect x="21" y="32" width="22" height="4" rx="1.5" fill="var(--color-tinta)" />
          <rect x="14" y="25" width="7" height="18" rx="2" fill="var(--color-tinta)" />
          <rect x="43" y="25" width="7" height="18" rx="2" fill="var(--color-tinta)" />
        </g>
        <path d="M17 43l-4 1M19 47.5l-3 3M24.5 49l-.5 4" stroke="var(--color-hilo)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <h1 className="titulo mb-3">Esta pantalla se quedó a media serie</h1>
      <p className="text-tinta-suave">
        No se pudo mostrar, pero lo que ya estaba guardado sigue a salvo. Inténtalo de nuevo; si vuelve a pasar, cierra y abre el programa.
      </p>
      {error.digest && <p className="ayuda mt-3">Código para soporte: {error.digest}</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="boton-oscuro">Intentar de nuevo</button>
        <Link href="/panel" className="boton-secundario">Volver a Hoy</Link>
      </div>
    </section>
  );
}
