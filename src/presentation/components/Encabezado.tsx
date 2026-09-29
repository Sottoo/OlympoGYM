import Link from "next/link";
import { Icono } from "./Icono";

interface Props {
  titulo: string;
  descripcion?: React.ReactNode;
  volver?: { href: string; texto: string };
  /** Etiquetas junto al título (estado, categoría…). */
  etiquetas?: React.ReactNode;
  acciones?: React.ReactNode;
}

export function Encabezado({ titulo, descripcion, volver, etiquetas, acciones }: Props) {
  return (
    <header className="space-y-3">
      {volver && (
        <Link href={volver.href} className="inline-flex items-center gap-1 text-sm font-medium text-gris hover:text-tinta">
          <Icono nombre="atras" className="size-4" />
          {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="titulo">{titulo}</h1>
            {etiquetas}
          </div>
          {descripcion && <div className="mt-2 text-gris">{descripcion}</div>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </header>
  );
}
