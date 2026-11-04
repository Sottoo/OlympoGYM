/*
 * Pequeñas marcas de taller para los controles de formulario: la puntada en
 * cruz (lo elegido), el botón de ropa cosido (opción marcada) y los íconos
 * de los campos. Son trazos simples para que se lean a cualquier tamaño.
 */

/** Puntada en cruz en hilo rojo: marca lo elegido, como las rachas. */
export function PuntadaX({ tamano = 12, className = "" }: { tamano?: number; className?: string }) {
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 12 12" className={`shrink-0 ${className}`}>
      <path d="M2 2l8 8M10 2l-8 8" stroke="var(--color-hilo)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Botón de ropa para las opciones de "elige una": vacío es un ojal punteado;
 * marcado es un botón negro de cuatro agujeros cosido con hilo rojo en cruz.
 * Sin `marcado`, lo decide el CSS según el radio que tenga adentro su tarjeta.
 */
export function BotonDeRopa({ marcado, tamano = 22 }: { marcado?: boolean; tamano?: number }) {
  const control = marcado === undefined ? "" : marcado ? "boton-ropa-si" : "boton-ropa-no";
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 24 24" className={`boton-ropa shrink-0 ${control}`}>
      <circle className="ojal" cx="12" cy="12" r="10" fill="none" stroke="var(--color-linea-fuerte)" strokeWidth="1.6" strokeDasharray="2.6 2.2" />
      <g className="cosido">
        <circle cx="12" cy="12" r="10.5" fill="var(--color-tinta)" />
        <circle cx="12" cy="12" r="8" fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth="0.9" />
        {[
          [9, 9],
          [15, 9],
          [9, 15],
          [15, 15],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.55" fill="var(--color-superficie)" />
        ))}
        <path d="M9 9l6 6M15 9l-6 6" stroke="#d8402f" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Flecha de los selectores: dos puntadas que forman una "v". */
export function FlechaHilo({ abierto = false }: { abierto?: boolean }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}>
      <path d="M3 5.2l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoCalendario({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.8" r="2.6" fill="none" stroke="var(--color-hilo)" strokeWidth="1.5" strokeDasharray="1.6 1.2" />
    </svg>
  );
}

export function IconoOjo({ tachado = false }: { tachado?: boolean }) {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {tachado && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

export function IconoArchivo() {
  return (
    <svg aria-hidden width="30" height="30" viewBox="0 0 32 32" className="shrink-0">
      <path d="M8 3.5h11l6.5 6.5v18.5H8Z" fill="var(--color-superficie)" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19 3.5V10h6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M16.5 23v-8.5M13 18l3.5-3.5L20 18" fill="none" stroke="var(--color-hilo)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
