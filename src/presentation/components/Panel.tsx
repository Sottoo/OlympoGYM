import Link from "next/link";
import { Icono, type NombreIcono } from "./Icono";
import { Emblema } from "./pictogramas/Emblema";

export type Tono = "vino" | "verde" | "ambar" | "rojo" | "pizarra" | "tinta";

/**
 * Hoja: tela cruda con su costura punteada por dentro y un título en
 * Marcellus. Opcionalmente, un rótulo en mayúsculas encima del título.
 */
export function Panel({
  titulo,
  rotulo,
  accion,
  descripcion,
  children,
  className = "",
  id,
  icono,
}: {
  titulo?: string;
  rotulo?: string;
  /** Parche chico junto al título, para reconocer la hoja de un vistazo. */
  icono?: NombreIcono;
  tono?: Tono;
  accion?: React.ReactNode;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const base = titulo ?? rotulo ?? "panel";
  const idTitulo = id ?? `panel-${base.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={idTitulo} className={`panel px-6 py-[22px] ${className}`}>
      <header className="mb-4 flex items-start gap-3">
        {icono && <Emblema icono={icono} hilo="carbon" tamano="sm" className="mt-0.5" />}
        <div className="min-w-0 flex-1">
          {rotulo && (
            <p id={titulo ? undefined : idTitulo} className="rotulo">
              {rotulo}
            </p>
          )}
          {titulo && (
            <h2 id={idTitulo} className={`font-titulos text-[1.3rem] leading-tight ${rotulo ? "mt-1" : ""}`}>
              {titulo}
            </h2>
          )}
          {descripcion && <p className="mt-1 text-[0.84rem] leading-snug text-gris">{descripcion}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

/** Ícono dentro de un círculo de costura punteada. */
export function FichaIcono({ icono, tamano = "normal" }: { icono: NombreIcono; tono?: Tono; tamano?: "normal" | "chico" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-linea-fuerte text-tinta ${tamano === "chico" ? "size-8" : "size-10"}`}
    >
      <Icono nombre={icono} className={tamano === "chico" ? "size-[16px]" : "size-[19px]"} />
    </span>
  );
}

/** Enlace pequeño de "ver más" para la esquina de una hoja. */
export function EnlacePanel({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap pt-1 text-[0.74rem] font-bold uppercase tracking-[0.1em] text-tinta hover:underline">
      {children}
    </Link>
  );
}

/**
 * Hoja para tablas: el título va dentro, a la misma altura que el de las
 * hojas vecinas, y alineado con la primera columna de la tabla.
 */
export function PanelTabla({
  titulo,
  descripcion,
  accion,
  children,
  id,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  const idTitulo = id ?? `tabla-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={idTitulo} className="superficie min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-[17px] pb-2 pt-[13px]">
        <div className="min-w-0">
          <h2 id={idTitulo} className="font-titulos text-[1.3rem] leading-tight">
            {titulo}
          </h2>
          {descripcion && <p className="mt-1 text-[0.84rem] leading-snug text-gris">{descripcion}</p>}
        </div>
        {accion}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
