/**
 * Listón bordado que se cose sobre el parche en un día especial: el
 * cumpleaños del socio o una visita redonda. Rojo de la marca, con las
 * puntas en cola de golondrina y la costura en hilo crudo.
 */
export function Liston({ texto, ancho = 196 }: { texto: string; ancho?: number }) {
  return (
    <svg role="img" aria-label={texto} width={ancho} height={(ancho * 46) / 196} viewBox="0 0 196 46" className="shrink-0" style={{ filter: "drop-shadow(0 3px 4px rgb(0 0 0 / 0.25))" }}>
      {/* puntas dobladas por detrás */}
      <path d="M0 14h26v28H0l8-14Z" fill="#7d1912" />
      <path d="M196 14h-26v28h26l-8-14Z" fill="#7d1912" />
      <path d="M18 34 26 42V34Z M178 34l-8 8v-8Z" fill="#4f0f0b" />
      {/* frente del listón */}
      <rect x="18" y="6" width="160" height="28" rx="2" fill="#a8231b" />
      <rect x="21" y="9" width="154" height="22" rx="1.5" fill="none" stroke="#f2efe8" strokeOpacity=".7" strokeWidth="1" strokeDasharray="2.5 2" />
      <text x="98" y="24.5" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="800" letterSpacing="2.2" fill="#f7f3ec">
        {texto.toUpperCase()}
      </text>
    </svg>
  );
}
