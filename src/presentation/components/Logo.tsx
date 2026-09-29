/**
 * Marca de Olimpo GYM: la silueta del monte Olimpo (dos cumbres) en rojo.
 * Figura geométrica simple para que se lea bien en tamaño de favicon.
 */
export function MarcaOlimpo({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className}>
      <path d="M1 27 12 7l5.5 10 3.5-6 10 16Z" fill="var(--color-rojo)" />
      <path d="m12 7 3.2 5.8-3.2-1.8-3.2 1.8Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function Logo({ nombre, tamano = "normal" }: { nombre: string; tamano?: "normal" | "grande" }) {
  const [principal, ...resto] = nombre.split(" ");
  const grande = tamano === "grande";
  return (
    <span className="inline-flex items-center gap-2.5">
      <MarcaOlimpo className={grande ? "size-14" : "size-7"} />
      <span className={`font-display font-bold uppercase leading-none tracking-wide ${grande ? "text-5xl" : "text-[1.35rem]"}`}>
        {principal}
        {resto.length > 0 && <span className="ml-1.5 font-semibold text-white/55">{resto.join(" ")}</span>}
      </span>
    </span>
  );
}
