import Link from "next/link";

export interface OpcionPestana {
  href: string;
  texto: string;
  cuenta?: number;
  activa: boolean;
}

/** Filtros de una lista. La opción activa lleva su costura punteada, como en el menú. Son enlaces: el filtro vive en la URL. */
export function Pestanas({ opciones, etiqueta }: { opciones: OpcionPestana[]; etiqueta: string }) {
  return (
    <nav aria-label={etiqueta} className="max-w-full overflow-x-auto">
      <div className="inline-flex gap-1">
        {opciones.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            aria-current={o.activa ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[0.78rem] font-bold uppercase tracking-[0.08em] ${
              o.activa ? "bg-tinta text-[#f2efe8] outline-1 -outline-offset-4 outline-dashed outline-white/45" : "text-gris hover:bg-hundido hover:text-tinta"
            }`}
          >
            {o.texto}
            {o.cuenta !== undefined && <span className={`tabular-nums ${o.activa ? "opacity-70" : "opacity-60"}`}>{o.cuenta}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
