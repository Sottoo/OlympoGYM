/**
 * Sello del mes: un parche pequeño bordado por cada día que el socio vino.
 * Negro, con su orilla cosida en hilo crudo y el día al centro.
 */
export function Sello({
  texto,
  tamano = 40,
  nuevo = false,
}: {
  texto: string | number;
  tamano?: number;
  /** Recién ganado: entra con un pequeño golpe, como cuando se cose. */
  nuevo?: boolean;
  /** Compatibilidad con versiones anteriores (ya no se usa). */
  semilla?: number;
  giro?: number;
  color?: string;
}) {
  const largo = String(texto).length > 2;
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 40 40" className={`shrink-0 ${nuevo ? "sello-nuevo" : ""}`}>
      <circle cx="20" cy="20" r="18.5" fill="#161514" />
      <circle cx="20" cy="20" r="15" fill="none" stroke="#f2efe8" strokeWidth="1.3" strokeDasharray="2 1.6" />
      <text x="20" y={largo ? 24 : 25} textAnchor="middle" fontFamily="var(--font-titulos)" fontSize={largo ? 11 : 14} fill="#f2efe8" style={{ fontVariationSettings: '"wght" 300, "wdth" 88' }}>
        {texto}
      </text>
    </svg>
  );
}

/** Lugar vacío para un sello todavía sin ganar; el de hoy va marcado en tinta. */
export function HuecoDeSello({ tamano = 40, texto, hoy = false }: { tamano?: number; texto?: string | number; hoy?: boolean }) {
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 40 40" className="shrink-0">
      <circle
        cx="20"
        cy="20"
        r={hoy ? 17.5 : 17}
        fill="none"
        stroke={hoy ? "#a8231b" : "#c9c3b7"}
        strokeWidth={hoy ? 1.6 : 1.4}
        strokeDasharray={hoy ? "2.5 2" : "2.5 2.5"}
      />
      {texto !== undefined && (
        <text x="20" y="25" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="12" fontWeight={hoy ? 800 : 700} fill={hoy ? "#a8231b" : "#a59e92"}>
          {texto}
        </text>
      )}
    </svg>
  );
}
