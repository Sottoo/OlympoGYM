import Link from "next/link";
import { Icono, type NombreIcono } from "./Icono";
import { Emblema } from "./pictogramas/Emblema";

interface Props {
  titulo: string;
  descripcion?: React.ReactNode;
  volver?: { href: string; texto: string };
  /** Etiquetas junto al título (estado, categoría…). */
  etiquetas?: React.ReactNode;
  acciones?: React.ReactNode;
  /** Foto o dibujo a la izquierda del título. */
  imagen?: React.ReactNode;
  /** Parche de la sección (Tienda, Inventario…): ayuda a saber dónde se está. */
  icono?: NombreIcono;
}

export function Encabezado({ titulo, descripcion, volver, etiquetas, acciones, imagen, icono }: Props) {
  return (
    <header className="grid gap-3">
      {volver && (
        <Link href={volver.href} className="inline-flex w-fit items-center gap-1 text-[0.84rem] font-bold text-gris hover:text-tinta">
          <Icono nombre="atras" className="size-4" />
          {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {imagen ?? (icono && <Emblema icono={icono} hilo="negro" tamano="lg" />)}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="titulo">{titulo}</h1>
              {etiquetas}
            </div>
            {descripcion && <div className="mt-1.5 text-[0.95rem] text-gris">{descripcion}</div>}
          </div>
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </header>
  );
}
