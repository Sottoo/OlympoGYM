"use client";

/** Grupo de opciones tipo "botones pegados". Accesible: por dentro son radios. */
export function SelectorSegmentado({
  nombre,
  opciones,
  valor,
  alCambiar,
  completo = false,
}: {
  nombre: string;
  opciones: Record<string, string>;
  valor: string;
  alCambiar: (v: string) => void;
  /** Ocupa todo el ancho, con opciones del mismo tamaño. */
  completo?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-linea-fuerte bg-superficie p-0.5 ${completo ? "grid auto-cols-fr grid-flow-col" : "inline-flex flex-wrap"}`}
    >
      {Object.entries(opciones).map(([v, texto]) => (
        <label
          key={v}
          className={`cursor-pointer rounded px-3 py-1.5 text-center text-[0.9rem] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tinta ${
            valor === v ? "bg-tinta text-white" : "text-gris hover:text-tinta"
          }`}
        >
          <input type="radio" name={nombre} value={v} checked={valor === v} onChange={() => alCambiar(v)} className="sr-only" />
          {texto}
        </label>
      ))}
    </div>
  );
}
