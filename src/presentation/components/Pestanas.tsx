import Link from "next/link";

export interface OpcionPestana {
  href: string;
  texto: string;
  cuenta?: number;
  activa: boolean;
}

/** Filtros de una lista, como pestañas. Son enlaces: el filtro vive en la URL. */
export function Pestanas({ opciones, etiqueta }: { opciones: OpcionPestana[]; etiqueta: string }) {
  return (
    <nav aria-label={etiqueta} className="-mb-px flex gap-6 overflow-x-auto border-b border-linea">
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.activa ? "page" : undefined}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[0.93rem] font-semibold transition-colors ${
            o.activa ? "border-rojo text-tinta" : "border-transparent text-gris hover:text-tinta"
          }`}
        >
          {o.texto}
          {o.cuenta !== undefined && (
            <span className={`rounded px-1.5 text-xs tabular-nums ${o.activa ? "bg-tinta text-white" : "bg-hundido text-gris"}`}>
              {o.cuenta}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
