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
      role="radiogroup"
      className={`gap-1 rounded-[10px] border-[1.5px] border-linea-fuerte bg-elevado p-1 ${completo ? "flex" : "inline-flex flex-wrap"}`}
    >
      {Object.entries(opciones).map(([v, texto]) => (
        <label
          key={v}
          className={`cursor-pointer rounded-[7px] py-1.5 text-center ${completo ? "flex-auto px-2" : "px-3.5"} text-[0.84rem] font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tinta ${
            valor === v ? "bg-tinta text-[#f2efe8] outline-1 -outline-offset-[3px] outline-dashed outline-white/40" : "text-gris hover:text-tinta"
          }`}
        >
          {/* El radio solo sirve para elegir con teclado; lo que se envía va en el campo oculto de abajo
              (React 19 restablece los radios al terminar cada envío y podrían quedar desfasados). */}
          <input type="radio" name={`${nombre}-opcion`} value={v} checked={valor === v} onChange={() => alCambiar(v)} className="sr-only" />
          {texto}
        </label>
      ))}
      <input type="hidden" name={nombre} value={valor} />
    </div>
  );
}
