/**
 * Pictogramas de Olimpo: cada producto y cada máquina tiene su dibujo,
 * hecho como un parche bordado. La figura va en "hilo" (color de la
 * categoría, con puntada satinada encima) sobre "tela" (el fondo claro del
 * parche); los detalles se recortan en color tela, como cuando el bordado
 * deja ver la prenda.
 *
 * Todos se dibujan en una cuadrícula de 48 × 48 con formas simples y
 * gruesas, para que se reconozcan de un vistazo aun en tamaño chico.
 */

/** Los recortes dejan ver la tela del parche (la misma de la orilla). */
const T = "var(--tela, #f6f0e4)";
const L = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Orilla dentada de un empaque sellado (sobres, envolturas): de x1 a x2 sobre la línea y. */
function dientes(x1: number, x2: number, y: number, alto: number, n = 9) {
  const paso = (x2 - x1) / n;
  let d = "";
  for (let i = 0; i < n; i++) d += `L${x1 + paso * (i + 0.5)} ${y + alto}L${x1 + paso * (i + 1)} ${y}`;
  return d;
}

/* ── Productos de la tienda ──────────────────────────────────────────── */

const botella = (detalle: React.ReactNode) => (
  <>
    <rect x="19" y="3.5" width="10" height="5.5" rx="1.6" />
    <path d="M20 9h8v4l3.5 3H16.5l3.5-3z" />
    <rect x="15" y="15.5" width="18" height="28.5" rx="5" />
    <rect x="15" y="23" width="18" height="12" fill={T} />
    {detalle}
  </>
);

const frasco = (detalle: React.ReactNode) => (
  <>
    <rect x="12.5" y="8" width="23" height="6.5" rx="2.2" />
    <rect x="12" y="15.5" width="24" height="28" rx="5" />
    <rect x="12" y="21.5" width="24" height="15" fill={T} />
    {detalle}
  </>
);

export const PICTOGRAMAS = {
  agua: botella(<path d="M18.5 29.5c1.9-2 3.7-2 5.5 0s3.6 2 5.5 0" {...L} strokeWidth="2" />),
  suero: botella(<path d="M24 24.6c-2.3 2.9-3.4 4.5-3.4 5.9a3.4 3.4 0 0 0 6.8 0c0-1.4-1.1-3-3.4-5.9z" />),
  lata: (
    <>
      <rect x="16" y="5" width="16" height="4.5" rx="1.6" />
      <path d="M14 10.5h20V40a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 14 40z" />
      <path d="M26.5 14.5 18.8 27h5.4l-2.3 10.5 8.6-13.4h-5.4l2.4-9.6z" fill={T} />
    </>
  ),
  proteina: (
    <>
      <rect x="8.5" y="7" width="31" height="8" rx="2.6" />
      <path d="M10.5 16.5h27v21.5a5.5 5.5 0 0 1-5.5 5.5H16a5.5 5.5 0 0 1-5.5-5.5z" />
      <rect x="10.5" y="22" width="27" height="14" fill={T} />
      <rect x="17" y="27.7" width="14" height="2.8" rx="1" />
      <rect x="14.5" y="24.6" width="4" height="9" rx="1.3" />
      <rect x="29.5" y="24.6" width="4" height="9" rx="1.3" />
    </>
  ),
  scoop: (
    <>
      <rect x="4" y="8" width="25" height="6.5" rx="2.2" />
      <path d="M6 15.5h21v20a4.5 4.5 0 0 1-4.5 4.5h-12A4.5 4.5 0 0 1 6 35.5z" />
      <rect x="6" y="20.5" width="21" height="10" fill={T} />
      <rect x="10" y="24.3" width="13" height="2.6" rx="1.2" />
      <path d="M27.5 31.5h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M29.5 31.5c1.6-3.4 3.9-5 6.5-5s4.9 1.6 6.5 5z" />
      <path d="M41 30 46 18.5" {...L} strokeWidth="3.4" />
    </>
  ),
  creatina: frasco(<path d="M24 23.5 30 29l-6 5.5-6-5.5z" />),
  preentreno: frasco(<path d="M26.3 22.5 19.6 31h4.6l-1.7 6 7.1-9h-4.6l1.3-5.5z" />),
  capsulas: (
    <>
      <g transform="rotate(-38 19 19)">
        <rect x="6" y="13.5" width="26" height="11" rx="5.5" />
        <rect x="18.3" y="13.5" width="1.8" height="11" fill={T} />
      </g>
      <g transform="rotate(28 32 33)">
        <rect x="21" y="28" width="22" height="10" rx="5" />
        <rect x="31.2" y="28" width="1.7" height="10" fill={T} />
      </g>
    </>
  ),
  barra: (
    <g transform="rotate(-16 24 24)">
      <path d="M10 15h28v18H10z" />
      <path d="M10 15 5.5 17.3l3.5 2.2-3.5 2.2 3.5 2.3-3.5 2.2 3.5 2.3-3.5 2.2L10 33z" />
      <path d="M38 15l4.5 2.3-3.5 2.2 3.5 2.2-3.5 2.3 3.5 2.2-3.5 2.3 3.5 2.2L38 33z" />
      <rect x="16" y="20" width="16" height="8" rx="1.5" fill={T} />
      <rect x="19" y="23" width="10" height="2" rx="1" />
    </g>
  ),
  galleta: (
    <>
      <path d="M24 7a17 17 0 1 0 16.6 13.3 5.6 5.6 0 0 1-6.4-6.4A5.6 5.6 0 0 1 28 7.5 17 17 0 0 0 24 7z" />
      <circle cx="17" cy="19" r="2.3" fill={T} />
      <circle cx="27" cy="21.5" r="1.9" fill={T} />
      <circle cx="31" cy="31" r="2.5" fill={T} />
      <circle cx="18.5" cy="31" r="2.1" fill={T} />
      <circle cx="24.5" cy="37.5" r="1.6" fill={T} />
    </>
  ),
  nueces: (
    <>
      <circle cx="18.5" cy="17.5" r="9" />
      <circle cx="29.5" cy="30.5" r="9" />
      <rect x="18" y="17" width="12" height="14" transform="rotate(-40 24 24)" />
      <circle cx="16" cy="15" r="1.4" fill={T} />
      <circle cx="21" cy="19.5" r="1.4" fill={T} />
      <circle cx="16.5" cy="21" r="1.2" fill={T} />
      <circle cx="27" cy="28" r="1.4" fill={T} />
      <circle cx="32" cy="32.5" r="1.4" fill={T} />
      <circle cx="31" cy="27" r="1.2" fill={T} />
    </>
  ),
  fruta: (
    <>
      <path d="M24 16.5c-3.3-2.7-12.4-3.4-14 5.4-1.7 9.2 3.8 21.1 9.4 21.1 2 0 2.8-1.1 4.6-1.1s2.6 1.1 4.6 1.1c5.6 0 11.1-11.9 9.4-21.1-1.6-8.8-10.7-8.1-14-5.4z" />
      <path d="M23.6 16.4c.2-3.6 1-6.4 2.8-8.8" {...L} strokeWidth="2.6" />
      <path d="M27 10.4c2.3-4 7.2-5.2 10.2-4.1-1.2 4.2-5.6 6.4-10.2 4.1z" />
      <path d="M14.5 23.5c.6-3.2 2.6-4.8 4.8-5.1" {...L} stroke={T} strokeWidth="2" />
    </>
  ),
  shaker: (
    <>
      <rect x="20.5" y="3.5" width="7" height="4.5" rx="1.2" />
      <path d="M14.5 8.5h19l-1.2 5.5H15.7z" />
      <path d="M13.5 15h21l-2.6 26.2a3.3 3.3 0 0 1-3.3 3H19.4a3.3 3.3 0 0 1-3.3-3z" />
      <rect x="18" y="21" width="6" height="2" rx="1" fill={T} />
      <rect x="18" y="26.5" width="8.5" height="2" rx="1" fill={T} />
      <rect x="18" y="32" width="6" height="2" rx="1" fill={T} />
    </>
  ),
  toalla: (
    <>
      <rect x="6" y="7" width="36" height="3.6" rx="1.8" />
      <path d="M11 10.6h26V40a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" />
      <path d="M11 10.6h17V37l-8.5-3.5L11 37z" fill={T} opacity="0.45" />
      <rect x="11" y="34.5" width="26" height="2.2" fill={T} />
      <rect x="11" y="38.4" width="26" height="1.6" fill={T} />
    </>
  ),
  guantes: (
    <>
      <rect x="13" y="13" width="5" height="11" rx="2.5" />
      <rect x="18.6" y="11" width="5" height="13" rx="2.5" />
      <rect x="24.2" y="11.5" width="5" height="12.5" rx="2.5" />
      <rect x="29.8" y="14" width="4.8" height="10" rx="2.4" />
      <rect x="13" y="19" width="21.6" height="17" rx="5" />
      <rect x="4.5" y="22.5" width="13" height="6" rx="3" transform="rotate(-32 11 25.5)" />
      <rect x="13" y="31.5" width="21.6" height="2.4" fill={T} />
      <rect x="14" y="34" width="19.6" height="10" rx="2.5" />
      <rect x="17" y="37.6" width="13.6" height="2.4" rx="1.2" fill={T} />
    </>
  ),
  munequera: (
    <>
      <circle cx="21" cy="22" r="15" />
      <circle cx="21" cy="22" r="7.5" fill={T} />
      <path d="M21 7a15 15 0 0 1 15 15" {...L} stroke={T} strokeWidth="1.6" strokeDasharray="2.5 2.5" />
      <path d="M27.5 35.5h15.5v7H31z" />
    </>
  ),
  cinturon: (
    <>
      <rect x="3" y="20" width="42" height="9.5" rx="2" />
      <rect x="15" y="15" width="13" height="19.5" rx="2.4" />
      <rect x="18.3" y="18.5" width="6.4" height="12.5" rx="1.2" fill={T} />
      <rect x="20.7" y="18.5" width="1.8" height="12.5" />
      <circle cx="35" cy="24.75" r="1.5" fill={T} />
      <circle cx="40" cy="24.75" r="1.5" fill={T} />
    </>
  ),
  candado: (
    <>
      <path d="M16 22v-6a8 8 0 0 1 16 0v6" {...L} strokeWidth="4.4" />
      <rect x="10.5" y="20.5" width="27" height="23" rx="4.5" />
      <circle cx="24" cy="29.5" r="3.2" fill={T} />
      <rect x="22.6" y="30" width="2.8" height="7.5" rx="1.2" fill={T} />
    </>
  ),
  playera: (
    <>
      <path d="M17.5 6 5 12.5l4.4 9 4.6-2.2V43h20V19.3l4.6 2.2 4.4-9L30.5 6c-1.1 3.4-3.6 5-6.5 5s-5.4-1.6-6.5-5z" />
      <path d="M14 19.3 11 14.8M34 19.3l3-4.5" {...L} stroke={T} strokeWidth="1.5" strokeDasharray="2 2" />
    </>
  ),
  sudadera: (
    <>
      <path d="M15.5 9 8 13.5 3.5 39h6.5l3.5-15.5V44h21V23.5L38 39h6.5L40 13.5 32.5 9z" />
      <path d="M15.5 10.5C15.5 5.8 19.3 3 24 3s8.5 2.8 8.5 7.5c-1.7 3.8-4.8 5.5-8.5 5.5s-6.8-1.7-8.5-5.5z" />
      <path d="M19 10.5c1.1 2.6 3 3.6 5 3.6s3.9-1 5-3.6c-1.1-2.2-3-3.2-5-3.2s-3.9 1-5 3.2z" fill={T} />
      <path d="M18 33h12l-1.6 6H19.6z" {...L} stroke={T} strokeWidth="1.6" />
    </>
  ),
  mancuerna: (
    <>
      <rect x="14" y="21.3" width="20" height="5.4" rx="1.6" />
      <rect x="8" y="13" width="7" height="22" rx="2.2" />
      <rect x="33" y="13" width="7" height="22" rx="2.2" />
      <rect x="3.5" y="17.5" width="5" height="13" rx="1.8" />
      <rect x="39.5" y="17.5" width="5" height="13" rx="1.8" />
    </>
  ),
  cafe: (
    <>
      <path d="M16.5 3.5c-2 2.3 2 4 0 6.4M23.5 2.5c-2 2.3 2 4 0 6.4M30.5 3.5c-2 2.3 2 4 0 6.4" {...L} strokeWidth="2.3" />
      <path d="M7.5 14h29v12.5A12.5 12.5 0 0 1 24 39h-4A12.5 12.5 0 0 1 7.5 26.5z" />
      <path d="M36 18.5h2.8a5 5 0 0 1 0 10H35" {...L} strokeWidth="3.6" />
      <rect x="3.5" y="40.5" width="37" height="3.8" rx="1.9" />
      <ellipse cx="22" cy="25.5" rx="4.2" ry="6" transform="rotate(32 22 25.5)" fill={T} />
      <path d="M19.4 21.6c3.1 1.8.4 5.8 5.2 7.8" {...L} strokeWidth="1.5" />
    </>
  ),
  termo: (
    <>
      <rect x="16.5" y="2.5" width="15" height="7" rx="2.4" />
      <rect x="18.5" y="10" width="11" height="2.6" />
      <rect x="14" y="13" width="20" height="31" rx="6.5" />
      <rect x="14" y="18.5" width="20" height="2" fill={T} />
      <rect x="14" y="37" width="20" height="2" fill={T} />
      <rect x="18" y="23.5" width="2.6" height="10" rx="1.3" fill={T} />
      <path d="M34 21.5h2.4a2.8 2.8 0 0 1 2.8 2.8v6.4a2.8 2.8 0 0 1-2.8 2.8H34" {...L} strokeWidth="2.8" />
    </>
  ),
  sobre: (
    <>
      <path d={`M10 10V7.5${dientes(10, 38, 7.5, -3.2)}V10z`} />
      <rect x="10" y="9.5" width="28" height="29" />
      <path d={`M10 38V40.5${dientes(10, 38, 40.5, 3.2)}V38z`} />
      <rect x="10" y="17" width="28" height="14" fill={T} />
      <path d="M24 19.2c-2.6 3.3-3.8 5.1-3.8 6.7a3.8 3.8 0 0 0 7.6 0c0-1.6-1.2-3.4-3.8-6.7z" />
      <path d="M33.5 9.5l2.5 2.5" {...L} stroke={T} strokeWidth="1.4" />
      <path d="M13 35h22" {...L} stroke={T} strokeWidth="1.2" strokeDasharray="1.8 1.8" />
    </>
  ),
  chocolate: (
    <>
      <rect x="11" y="4" width="26" height="24" rx="2.5" />
      <path d="M24 4.5v19M11.5 11.5h25M11.5 18.5h25" {...L} stroke={T} strokeWidth="1.5" />
      <path d={`M9.5 27.5${dientes(9.5, 38.5, 27.5, -2.6, 8)}V42a2 2 0 0 1-2 2h-25a2 2 0 0 1-2-2z`} />
      <path d={`M9.5 25${dientes(9.5, 38.5, 25, -2.6, 8)}`} {...L} stroke={T} strokeWidth="1.3" />
      <rect x="14.5" y="31" width="19" height="8.5" rx="1.6" fill={T} />
      <rect x="18" y="34.2" width="12" height="2.2" rx="1.1" />
    </>
  ),
  gomitas: (
    <>
      <circle cx="17.5" cy="7.5" r="3.4" />
      <circle cx="30.5" cy="7.5" r="3.4" />
      <circle cx="24" cy="13.5" r="8" />
      <ellipse cx="13.5" cy="25.5" rx="3.6" ry="6" transform="rotate(-40 13.5 25.5)" />
      <ellipse cx="34.5" cy="25.5" rx="3.6" ry="6" transform="rotate(40 34.5 25.5)" />
      <ellipse cx="24" cy="31" rx="10.5" ry="11" />
      <circle cx="16.5" cy="40.5" r="4.4" />
      <circle cx="31.5" cy="40.5" r="4.4" />
      <circle cx="21" cy="12.2" r="1.2" fill={T} />
      <circle cx="27" cy="12.2" r="1.2" fill={T} />
      <ellipse cx="24" cy="16.6" rx="2.2" ry="1.4" fill={T} />
      <ellipse cx="24" cy="32" rx="5.2" ry="6.2" fill={T} opacity="0.5" />
      <path d="M18 26.5c.5-2.2 1.7-3.6 3.4-4.2" {...L} stroke={T} strokeWidth="1.6" />
    </>
  ),
  papas: (
    <>
      <rect x="8.5" y="3.5" width="31" height="6" rx="1.2" />
      <path d="M10.5 9c2.2 6.5 2.2 23.5 0 30h27c-2.2-6.5-2.2-23.5 0-30z" />
      <rect x="8.5" y="38.5" width="31" height="6" rx="1.2" />
      <path d="M12 4.5v4M15.5 4.5v4M19 4.5v4M22.5 4.5v4M26 4.5v4M29.5 4.5v4M33 4.5v4M36.5 4.5v4M12 39.5v4M15.5 39.5v4M19 39.5v4M22.5 39.5v4M26 39.5v4M29.5 39.5v4M33 39.5v4M36.5 39.5v4" {...L} stroke={T} strokeWidth="1.1" />
      <path d="M15.5 24.5c2.4-6.2 14.6-7.8 17.6-1.6s-2.4 10-8.8 10-11.2-2.4-8.8-8.4z" fill={T} />
      <path d="M19 24.5c3-1.6 7.5-1.8 11 0M19.5 28.5c3 1.4 7 1.4 10.5 0" {...L} strokeWidth="1.4" />
    </>
  ),
  maleta: (
    <>
      <path d="M17 17v-5.5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3V17" {...L} strokeWidth="3.4" />
      <rect x="3.5" y="15.5" width="41" height="25" rx="9.5" />
      <path d="M12.5 16v24M35.5 16v24" {...L} stroke={T} strokeWidth="1.4" />
      <path d="M14.5 21.5h19" {...L} stroke={T} strokeWidth="1.6" strokeDasharray="1.4 1.4" />
      <rect x="30.5" y="22.5" width="3" height="5" rx="1.2" fill={T} />
      <rect x="16" y="29" width="16" height="6.5" rx="1.6" fill={T} />
      <rect x="19" y="31.3" width="10" height="1.9" rx="0.95" />
    </>
  ),
  gorra: (
    <>
      <path d="M4.5 33c0-12 7.8-20.5 18-20.5S38.5 21 38.5 33z" />
      <circle cx="22.5" cy="12" r="2.4" />
      <path d="M33.5 29.5c6-.9 10.4.6 10.9 4.6-.3 1.8-2.8 2.8-6.6 2.8h-4.3z" />
      <rect x="4.5" y="32" width="34" height="5.5" rx="1.6" />
      <path d="M22.5 14c-3.2 4.6-4.8 10.8-4.8 18M22.5 14c4.6 4.2 7.2 10.4 7.6 18" {...L} stroke={T} strokeWidth="1.4" />
      <path d="M7 34.75h29" {...L} stroke={T} strokeWidth="1.2" strokeDasharray="2 2" />
    </>
  ),
  calcetas: (
    <>
      <path d="M14.5 3.5h15v21l9.2 8.4a6.6 6.6 0 0 1-8.9 9.7L17.2 32a8.4 8.4 0 0 1-2.7-6.2z" />
      <rect x="14.5" y="8.5" width="15" height="1.8" fill={T} />
      <rect x="14.5" y="12.2" width="15" height="1.8" fill={T} />
      <path d="M15.3 26.5c1.4 3.2 4.2 4.4 7.4 3.8" {...L} stroke={T} strokeWidth="1.3" strokeDasharray="1.8 1.6" />
      <path d="M31.4 36.6l5-4.6" {...L} stroke={T} strokeWidth="1.3" strokeDasharray="1.8 1.6" />
    </>
  ),
  short: (
    <>
      <path d="M9 7h30l4.5 33H28.6L24 21.5 19.4 40H4.5z" />
      <rect x="9" y="11.5" width="30" height="1.8" fill={T} />
      <path d="M22.3 13.5l-1.8 5M25.7 13.5l1.8 5" {...L} stroke={T} strokeWidth="1.4" />
      <path d="M10.6 17 8 37M37.4 17 40 37" {...L} stroke={T} strokeWidth="1.3" strokeDasharray="2 2" />
    </>
  ),
  pants: (
    <>
      <path d="M12 3.5h24l3.2 40.5h-9.6L24 16.5 18.4 44H8.8z" />
      <rect x="12" y="8" width="24" height="1.7" fill={T} />
      <path d="M22.6 10l-1.3 4M25.4 10l1.3 4" {...L} stroke={T} strokeWidth="1.3" />
      <path d="M13 13.5 10.6 40.5M35 13.5l2.4 27" {...L} stroke={T} strokeWidth="1.2" strokeDasharray="2 2" />
    </>
  ),
  cuerda: (
    <>
      <path d="M12.5 19.5c-1 14.5 5 23.5 11.5 23.5s12.5-9 11.5-23.5" {...L} strokeWidth="2.6" />
      <g transform="rotate(-9 12 11.5)">
        <rect x="8.5" y="3" width="7" height="17" rx="3.3" />
        <path d="M9.5 9h5M9.5 12.5h5" {...L} stroke={T} strokeWidth="1.3" />
      </g>
      <g transform="rotate(9 36 11.5)">
        <rect x="32.5" y="3" width="7" height="17" rx="3.3" />
        <path d="M33.5 9h5M33.5 12.5h5" {...L} stroke={T} strokeWidth="1.3" />
      </g>
    </>
  ),
  ligas: (
    <g transform="rotate(-18 24 24)">
      <ellipse cx="24" cy="24" rx="20.5" ry="12.5" />
      <ellipse cx="24" cy="24" rx="14.5" ry="6.6" fill={T} />
      <ellipse cx="24" cy="24" rx="17.5" ry="9.55" {...L} stroke={T} strokeWidth="1.1" strokeDasharray="2 2.2" />
    </g>
  ),
  tapete: (
    <>
      <rect x="16" y="33.5" width="29" height="6.5" rx="1.2" />
      <circle cx="16" cy="28" r="12" />
      <circle cx="16" cy="28" r="7.6" {...L} stroke={T} strokeWidth="1.5" />
      <circle cx="16" cy="28" r="3.4" {...L} stroke={T} strokeWidth="1.5" />
      <path d="M30 36.75h12" {...L} stroke={T} strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M8.5 17.5c4-6 11-6 15 0" {...L} strokeWidth="2.4" />
    </>
  ),
  rodillo: (
    <g transform="rotate(-24 24 24)">
      <path d="M9 15h29v18H9a4.6 9 0 0 1 0-18z" />
      <ellipse cx="38" cy="24" rx="4.6" ry="9" />
      <ellipse cx="38" cy="24" rx="4.6" ry="9" {...L} stroke={T} strokeWidth="1.2" />
      <ellipse cx="38" cy="24" rx="1.9" ry="3.8" fill={T} />
      {[11.5, 18, 24.5, 31].map((x) => (
        <g key={x}>
          <rect x={x} y="17.8" width="3.4" height="4.4" rx="1.4" fill={T} />
          <rect x={x} y="25.8" width="3.4" height="4.4" rx="1.4" fill={T} />
        </g>
      ))}
    </g>
  ),
  etiqueta: (
    <>
      <path d="M7 9.5A2.5 2.5 0 0 1 9.5 7h14l18 18a3 3 0 0 1 0 4.2l-12.6 12.6a3 3 0 0 1-4.2 0L7 23.5z" />
      <circle cx="15" cy="15" r="3" fill={T} />
      <path d="M22 26.5h10M25 31.5h6" {...L} stroke={T} strokeWidth="2" transform="rotate(45 27 29)" />
    </>
  ),

  /* ── Máquinas e instalaciones ─────────────────────────────────────── */

  caminadora: (
    <>
      <rect x="27" y="7" width="16" height="7.5" rx="2.2" />
      <path d="M36.5 14.5 41 37h-3.8L33 14.5z" />
      <path d="M33 19H19" {...L} strokeWidth="3" />
      <path d="M3 34.5 41 30.5l3 4.5-38.5 5z" />
      <path d="M7.5 36.4 39.5 33" {...L} stroke={T} strokeWidth="1.4" />
      <rect x="5" y="39.5" width="5" height="4" rx="1" />
      <rect x="36" y="36.5" width="5" height="7" rx="1" />
    </>
  ),
  eliptica: (
    <>
      <rect x="3" y="40" width="42" height="4" rx="2" />
      <circle cx="11" cy="32" r="7.5" />
      <circle cx="11" cy="32" r="3" fill={T} />
      <path d="M11 32 36 36.5" {...L} strokeWidth="3.4" />
      <rect x="29" y="34" width="11" height="3.4" rx="1.7" />
      <path d="M37 39 38.5 19" {...L} strokeWidth="3.4" />
      <path d="M38.5 19 33 5.5M38.5 19l5.5-12" {...L} strokeWidth="2.8" />
      <rect x="34.5" y="14" width="8" height="5" rx="1.6" />
    </>
  ),
  bicicleta: (
    <>
      <rect x="5" y="40" width="36" height="3.8" rx="1.9" />
      <path d="M15 40 19.5 22 33 31M19.5 22 17.5 15M33 31l3-17" {...L} strokeWidth="3.4" />
      <path d="M11 13.5h12l-2.2 3.4h-7.6z" />
      <path d="M32 12.5h8.5" {...L} strokeWidth="3.2" />
      <circle cx="33.5" cy="32" r="7.8" />
      <circle cx="33.5" cy="32" r="2.8" fill={T} />
    </>
  ),
  spinning: (
    <>
      <rect x="4" y="40" width="40" height="3.8" rx="1.9" />
      <path d="M13 40 17 21l12 9M17 21l-1.8-7M29 30l5-15" {...L} strokeWidth="3.6" />
      <path d="M9 12.5h12l-2.2 3.4H11z" />
      <path d="M31 13.5h10l2 3" {...L} strokeWidth="3.2" />
      <circle cx="34" cy="31.5" r="9.5" />
      <circle cx="34" cy="31.5" r="6" fill={T} />
      <circle cx="34" cy="31.5" r="2.4" />
    </>
  ),
  escaladora: (
    <>
      <path d="M5 44V36h8.5v-7.5H22V21h8.5v-7.5H39V44z" />
      <path d="M12 23 38 5.5" {...L} strokeWidth="3" />
      <path d="M38 5.5V13" {...L} strokeWidth="3" />
      <path d="M8 40h31M16.5 32.5H39M25 25h14M33.5 17.5H39" {...L} stroke={T} strokeWidth="1.3" />
    </>
  ),
  remadora: (
    <>
      <rect x="3" y="34" width="42" height="4" rx="2" />
      <path d="M6 38v5.5M42 38v5.5" {...L} strokeWidth="3.2" />
      <rect x="15" y="27.5" width="11" height="5.5" rx="2" />
      <circle cx="38.5" cy="25.5" r="7" />
      <circle cx="38.5" cy="25.5" r="2.6" fill={T} />
      <rect x="29" y="27" width="4" height="7" rx="1.2" />
      <path d="M31.5 21.5 23 20" {...L} strokeWidth="2.6" />
    </>
  ),
  estacion: (
    <>
      <rect x="4" y="41" width="40" height="3.6" rx="1.8" />
      <rect x="7" y="5" width="4" height="37" rx="1" />
      <rect x="27" y="5" width="4" height="37" rx="1" />
      <rect x="7" y="5" width="33" height="4" rx="1.5" />
      <path d="M19 9v10M38 9v12" {...L} strokeWidth="1.8" />
      {[20, 24.5, 29, 33.5].map((y) => (
        <rect key={y} x="12.5" y={y} width="13" height="3.6" rx="1" />
      ))}
      <rect x="32.5" y="29" width="11.5" height="4.6" rx="2" />
      <rect x="36.5" y="33.6" width="3.5" height="8" />
    </>
  ),
  banco: (
    <>
      <rect x="4" y="19" width="40" height="7.5" rx="3.75" />
      <path d="M11 26.5 9 40M37 26.5 39 40" {...L} strokeWidth="3.6" />
      <rect x="21.8" y="26.5" width="4.4" height="10" rx="1" />
      <rect x="4.5" y="39.5" width="10" height="3.6" rx="1.8" />
      <rect x="33.5" y="39.5" width="10" height="3.6" rx="1.8" />
      <path d="M8 22.75h32" {...L} stroke={T} strokeWidth="1.3" strokeDasharray="2 2" />
    </>
  ),
  rack: (
    <>
      <rect x="9" y="5" width="4.2" height="37" rx="1" />
      <rect x="34.8" y="5" width="4.2" height="37" rx="1" />
      <rect x="9" y="5" width="30" height="3.8" rx="1.5" />
      <rect x="4" y="41" width="40" height="3.6" rx="1.8" />
      <rect x="2" y="20.2" width="44" height="2.8" rx="1.4" />
      <rect x="3" y="14.5" width="4.6" height="14" rx="1.4" />
      <rect x="40.4" y="14.5" width="4.6" height="14" rx="1.4" />
    </>
  ),
  mancuernero: (
    <>
      <path d="M6 43 10.5 13h27L42 43h-4.2l-3.6-25.5H13.8L10.2 43z" />
      {[15.5, 24, 32.5].map((x) => (
        <g key={x}>
          <rect x={x - 4.2} y="19.5" width="8.4" height="5.6" rx="2" />
          <rect x={x - 4.6} y="28.5" width="9.2" height="6.4" rx="2.2" />
        </g>
      ))}
    </>
  ),
  aire: (
    <>
      <rect x="4" y="7" width="40" height="17" rx="3.5" />
      <rect x="8" y="17.5" width="32" height="2" rx="1" fill={T} />
      <rect x="8" y="20.8" width="32" height="1.3" rx="0.65" fill={T} />
      <circle cx="37.5" cy="11.5" r="1.4" fill={T} />
      {[14, 24, 34].map((x) => (
        <path key={x} d={`M${x} 28c-2.2 2.6 2.2 4.4 0 7s2.2 4.4 0 7`} {...L} strokeWidth="2.6" />
      ))}
    </>
  ),
  regadera: (
    <>
      <path d="M8 5.5h17v6" {...L} strokeWidth="3.6" />
      <path d="M16.5 11.5h17L30 18.5H20z" />
      {[
        [19, 23],
        [25, 23],
        [31, 23],
        [17, 31],
        [23, 31],
        [29, 31],
        [21, 39],
        [27, 39],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="2.6" height="5" rx="1.3" transform={`rotate(12 ${x} ${y})`} />
      ))}
    </>
  ),
  sonido: (
    <>
      <rect x="11" y="4" width="26" height="40" rx="4.5" />
      <circle cx="24" cy="30" r="8.5" fill={T} />
      <circle cx="24" cy="30" r="3.6" />
      <circle cx="24" cy="14" r="4" fill={T} />
      <circle cx="24" cy="14" r="1.5" />
    </>
  ),
  barra_olimpica: (
    <>
      <rect x="1.5" y="22.5" width="45" height="3" rx="1.5" />
      <rect x="6" y="10" width="5.4" height="28" rx="1.7" />
      <rect x="11.9" y="14" width="4.4" height="20" rx="1.5" />
      <rect x="16.8" y="20.3" width="2.6" height="7.4" rx="0.9" />
      <rect x="36.6" y="10" width="5.4" height="28" rx="1.7" />
      <rect x="31.7" y="14" width="4.4" height="20" rx="1.5" />
      <rect x="28.6" y="20.3" width="2.6" height="7.4" rx="0.9" />
      <path d="M22 22.5v3M26 22.5v3" {...L} stroke={T} strokeWidth="0.9" />
    </>
  ),
  kettlebell: (
    <>
      <path d="M15.5 22v-7.5a5.5 5.5 0 0 1 5.5-5.5h6a5.5 5.5 0 0 1 5.5 5.5V22" {...L} strokeWidth="4.6" />
      <circle cx="24" cy="30" r="14" />
      <rect x="14" y="39.5" width="20" height="4.5" rx="1.6" />
      <rect x="18" y="26.5" width="12" height="7.5" rx="2" fill={T} />
      <rect x="21" y="29.2" width="6" height="2.1" rx="1" />
      <path d="M13.6 28a10.5 10.5 0 0 1 4.2-6.4" {...L} stroke={T} strokeWidth="1.8" />
    </>
  ),
  disco: (
    <>
      <circle cx="24" cy="24" r="20.5" />
      <circle cx="24" cy="24" r="15.5" {...L} stroke={T} strokeWidth="1.3" />
      {[0, 120, 240].map((a) => (
        <rect key={a} x="19.5" y="9.6" width="9" height="4" rx="2" fill={T} transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="4.6" fill={T} />
      <circle cx="24" cy="24" r="7.2" {...L} stroke={T} strokeWidth="1.1" strokeDasharray="1.6 1.6" />
    </>
  ),
  saco: (
    <>
      <path d="M24 2v5.5M17.5 12.5 24 7.5l6.5 5" {...L} strokeWidth="2.2" />
      <rect x="15.5" y="11" width="17" height="4.4" rx="1.6" />
      <rect x="13.5" y="14.5" width="21" height="30" rx="7.5" />
      <rect x="13.5" y="21" width="21" height="2.2" fill={T} />
      <rect x="13.5" y="36" width="21" height="2.2" fill={T} />
      <path d="M24 25v9" {...L} stroke={T} strokeWidth="1.3" strokeDasharray="1.8 1.6" />
      <path d="M17 26.5c.4-.9.9-1.5 1.6-2" {...L} stroke={T} strokeWidth="1.5" />
    </>
  ),
  step: (
    <>
      <path d="M8 16h32l4.5 9.5h-41z" />
      <rect x="3.5" y="25" width="41" height="5" rx="1" />
      <rect x="5" y="30" width="9.5" height="11" rx="1.6" />
      <rect x="33.5" y="30" width="9.5" height="11" rx="1.6" />
      <path d="M10 20.5h28" {...L} stroke={T} strokeWidth="1.4" strokeDasharray="2.4 1.8" />
      <rect x="7.5" y="33" width="4.5" height="1.6" rx="0.8" fill={T} />
      <rect x="36" y="33" width="4.5" height="1.6" rx="0.8" fill={T} />
    </>
  ),
  bascula: (
    <>
      <rect x="5" y="5" width="38" height="38" rx="9" />
      <rect x="15" y="9.5" width="18" height="8.5" rx="2.2" fill={T} />
      <path d="M19 12v3.5M22.5 12v3.5M27 12.5h2.6v3" {...L} strokeWidth="1.5" />
      <rect x="10.5" y="22.5" width="11" height="16" rx="4.5" fill={T} />
      <rect x="26.5" y="22.5" width="11" height="16" rx="4.5" fill={T} />
      <path d="M13.5 26.5h5M13.5 30.5h5M13.5 34.5h5M29.5 26.5h5M29.5 30.5h5M29.5 34.5h5" {...L} strokeWidth="1.2" />
    </>
  ),
  pelota: (
    <>
      <circle cx="24" cy="24" r="19.5" />
      <path d="M5.5 20.5c8.5 4.2 28.5 4.2 37 0M5.5 27.5c8.5 4.2 28.5 4.2 37 0" {...L} stroke={T} strokeWidth="1.5" />
      <path d="M12.5 11.5a17 17 0 0 1 8-5.5" {...L} stroke={T} strokeWidth="1.8" />
      <rect x="19" y="34" width="10" height="3.4" rx="1.7" fill={T} />
    </>
  ),
  ventilador: (
    <>
      <circle cx="24" cy="17" r="14.5" {...L} strokeWidth="2.4" />
      {[0, 120, 240].map((a) => (
        <path key={a} d="M24 17c-2.4-4.6-1.6-9.8 2.8-11.6 3.6 3 3 8.4-2.8 11.6z" transform={`rotate(${a} 24 17)`} />
      ))}
      <circle cx="24" cy="17" r="3.2" />
      <circle cx="24" cy="17" r="1.2" fill={T} />
      <rect x="22.4" y="31" width="3.2" height="9.5" rx="1" />
      <rect x="13.5" y="40" width="21" height="4.2" rx="2.1" />
    </>
  ),
  bebedero: (
    <>
      <path d="M17 3h14v3c3.1 1.1 4.2 3.2 4.2 6.2v6.3H12.8v-6.3c0-3 1.1-5.1 4.2-6.2z" />
      <path d="M15.3 12c2.9 1.8 5.8 1.8 8.7 0s5.8-1.8 8.7 0" {...L} stroke={T} strokeWidth="1.5" />
      <rect x="11" y="20" width="26" height="24" rx="2.6" />
      <rect x="15.5" y="26" width="17" height="11" rx="1.6" fill={T} />
      <rect x="18.4" y="26" width="3.6" height="3.8" rx="0.8" />
      <rect x="26" y="26" width="3.6" height="3.8" rx="0.8" />
      <rect x="17.5" y="34" width="13" height="1.5" rx="0.75" />
      <circle cx="31.5" cy="40.5" r="1.3" fill={T} />
    </>
  ),
  casilleros: (
    <>
      <rect x="5" y="4.5" width="38" height="39.5" rx="2.6" />
      <path d="M17.7 4.5V44M30.3 4.5V44" {...L} stroke={T} strokeWidth="1.6" />
      {[11.35, 24, 36.65].map((x) => (
        <g key={x}>
          {[9, 11.6, 14.2].map((y) => (
            <rect key={y} x={x - 3.2} y={y} width="6.4" height="1.2" rx="0.6" fill={T} />
          ))}
          <rect x={x + 2.2} y="23" width="1.8" height="5.5" rx="0.9" fill={T} />
          <circle cx={x - 1} cy="36.5" r="1.5" fill={T} />
        </g>
      ))}
    </>
  ),
  foco: (
    <>
      <path d="M24 3.5a13.5 13.5 0 0 0-7.8 24.5c1.7 1.3 2.6 3 2.6 5.2V34h10.4v-.8c0-2.2.9-3.9 2.6-5.2A13.5 13.5 0 0 0 24 3.5z" />
      <rect x="18.5" y="35.4" width="11" height="3.2" rx="1" />
      <rect x="19.5" y="39.4" width="9" height="3" rx="1" />
      <rect x="21.6" y="43" width="4.8" height="2" rx="1" />
      <path d="M19.5 23l2.2-4.5 2.3 4.5 2.3-4.5 2.2 4.5" {...L} stroke={T} strokeWidth="1.6" />
      <path d="M14.8 14.5a9.5 9.5 0 0 1 4.8-6.2" {...L} stroke={T} strokeWidth="1.8" />
    </>
  ),
  herramienta: (
    <g transform="scale(0.1875)">
      <path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69Z" />
      <circle cx="56" cy="200" r="10" fill={T} />
    </g>
  ),
} as const;

export type NombrePictograma = keyof typeof PICTOGRAMAS;

/**
 * Un pictograma como parche recortado: el bordado sigue la silueta del
 * dibujo y alrededor queda una orilla de tela cruda con su canto, como los
 * parches que se planchan en la ropa. Con `satinado` (en tamaños medianos y
 * grandes) se ve la puntada y el brillo del hilo; en chico va liso para que
 * no se empaste.
 */
export function Pictograma({ nombre, className = "", satinado = true }: { nombre: NombrePictograma; className?: string; satinado?: boolean }) {
  const forma = PICTOGRAMAS[nombre];
  return (
    <svg aria-hidden viewBox="-5 -5 58 58" fill="currentColor" className={`pictograma ${className}`}>
      <g filter="url(#parche-recortado)">
        {forma}
        {satinado && (
          <>
            <g fill="url(#hilo-satinado)" className="satinado">
              {forma}
            </g>
            <g fill="url(#hilo-brillo)" className="satinado">
              {forma}
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

/** La puntada, el brillo del hilo y la orilla recortada; van una sola vez en la página. */
export function DefinicionesDeHilo() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        {/* Puntada satinada: hebras finas, unas con luz y otras con sombra. */}
        <pattern id="hilo-satinado" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width="0.75" height="2.4" fill="rgb(255 255 255 / 0.17)" />
          <rect x="1.3" width="0.45" height="2.4" fill="rgb(0 0 0 / 0.1)" />
        </pattern>
        {/* El hilo brilla arriba a la izquierda y se apaga abajo, como el satín con luz de lado. */}
        <linearGradient id="hilo-brillo" gradientUnits="userSpaceOnUse" x1="4" y1="2" x2="44" y2="46">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <filter id="parche-recortado" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.7" result="orilla" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="3.4" result="canto" />
          <feFlood floodColor="#f6f0e4" result="crema" />
          <feComposite in="crema" in2="orilla" operator="in" result="orillaCrema" />
          <feFlood floodColor="#5a4632" floodOpacity="0.32" result="tono" />
          <feComposite in="tono" in2="canto" operator="in" result="cantoOscuro" />
          <feOffset in="cantoOscuro" dy="1.4" result="cantoBajo" />
          <feGaussianBlur in="cantoBajo" stdDeviation="1.1" result="sombra" />
          <feMerge>
            <feMergeNode in="sombra" />
            <feMergeNode in="cantoOscuro" />
            <feMergeNode in="orillaCrema" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
