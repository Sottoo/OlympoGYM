/**
 * El parche bordado del socio: un círculo de tela negra con su orilla
 * cosida, el nombre del gimnasio bordado en arco, sus iniciales (o su foto)
 * al centro y su número de socio. Es la "credencial" de Olimpo: se ve como
 * el parche que lleva la ropa del gimnasio.
 */
/** Hilo rojo sobre tela negra: un rojo más vivo que el de la pantalla para que se lea sobre el negro. */
const HILO_ROJO = "#d8402f";

export function Parche({
  iniciales,
  numero,
  desde,
  fotoUrl,
  gimnasio = "Olimpo GYM",
  tamano = 210,
  apagado = false,
  className = "",
}: {
  iniciales: string;
  numero: number;
  /** Año en que se hizo socio, para la leyenda de abajo. */
  desde?: string;
  fotoUrl?: string | null;
  gimnasio?: string;
  tamano?: number;
  /** Socio dado de baja: el parche se ve deslavado. */
  apagado?: boolean;
  className?: string;
}) {
  const id = `parche-${numero}-${tamano}`;
  const dorsal = String(numero).padStart(2, "0");
  return (
    <svg
      role="img"
      aria-label={`Parche del socio número ${dorsal}`}
      width={tamano}
      height={tamano}
      viewBox="0 0 210 210"
      className={`shrink-0 ${apagado ? "opacity-45 grayscale" : ""} ${className}`}
      style={{ filter: "drop-shadow(0 6px 10px rgb(0 0 0 / 0.25))" }}
    >
      <defs>
        <path id={`${id}-a`} d="M30 105a75 75 0 0 1 150 0" />
        <path id={`${id}-b`} d="M36 112a69 69 0 0 0 138 0" />
        {/* Hilo: puntadas diagonales muy finas sobre el negro */}
        <pattern id={`${id}-hilo`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="4" height="4" fill="#161514" />
          <rect width="1.4" height="4" fill="#24221f" />
        </pattern>
        <clipPath id={`${id}-foto`}>
          <circle cx="105" cy="105" r="56" />
        </clipPath>
      </defs>
      <circle cx="105" cy="105" r="102" fill="#e9e5dc" />
      <circle cx="105" cy="105" r="97" fill={`url(#${id}-hilo)`} />
      <circle cx="105" cy="105" r="93" fill="none" stroke="#f2efe8" strokeWidth="2" strokeDasharray="3 2.4" />
      <text fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="800" letterSpacing="4" fill="#f2efe8">
        <textPath href={`#${id}-a`} startOffset="50%" textAnchor="middle">
          {`${gimnasio.toUpperCase()} · SOCIO`}
        </textPath>
      </text>
      {desde && (
        <text fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" letterSpacing="3.5" fill="#f2efe8" opacity=".8">
          <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle">
            {`DESDE ${desde}`}
          </textPath>
        </text>
      )}
      {fotoUrl ? (
        <>
          <image href={fotoUrl} x="49" y="49" width="112" height="112" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-foto)`} />
          <circle cx="105" cy="105" r="58" fill="none" stroke="#f2efe8" strokeWidth="2" strokeDasharray="2.5 2" />
          <rect x="83" y="150" width="44" height="17" rx="8.5" fill="#161514" stroke={HILO_ROJO} strokeWidth="1" strokeDasharray="2 1.6" />
          <text x="105" y="162.5" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10.5" fontWeight="800" letterSpacing="1.5" fill={HILO_ROJO}>
            {`Nº ${dorsal}`}
          </text>
        </>
      ) : (
        <>
          <circle cx="105" cy="105" r="60" fill="none" stroke="#f2efe8" strokeWidth="1.4" strokeDasharray="2.5 2" />
          {/* Marcellus directa: --font-titulos empieza con la cara del cero, cuyo respaldo (Arial) taparía a Marcellus. */}
          <text x="105" y="104" textAnchor="middle" fontFamily="var(--fuente-titulos)" fontSize="44" fill="#f2efe8">
            {iniciales}
          </text>
          <text x="105" y="131" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="14" fontWeight="800" letterSpacing="2" fill={HILO_ROJO}>
            {`Nº ${dorsal}`}
          </text>
        </>
      )}
    </svg>
  );
}

/** Lugar del parche mientras nadie llega: la silueta punteada donde se cose. */
export function HuecoDeParche({ tamano = 210 }: { tamano?: number }) {
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 210 210" className="shrink-0">
      <circle cx="105" cy="105" r="100" fill="none" stroke="#c9c2b5" strokeWidth="2" strokeDasharray="5 5" />
      <circle cx="105" cy="105" r="60" fill="none" stroke="#d9d3c6" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M105 82a14 14 0 1 1 0 28 14 14 0 0 1 0-28Zm-26 52c3-13 13-20 26-20s23 7 26 20" fill="none" stroke="#bdb6a9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
