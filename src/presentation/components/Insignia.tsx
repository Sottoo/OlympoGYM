import type { EstadoStock } from "@/domain/entities/Producto";
import type { EstadoMembresia as Estado } from "@/domain/entities/Suscripcion";

export type Tono = "verde" | "ambar" | "rojo" | "neutro" | "oscuro";

const TONOS: Record<Tono, string> = {
  verde: "bg-verde-tenue text-verde",
  ambar: "bg-ambar-tenue text-ambar",
  rojo: "bg-rojo-tenue text-rojo",
  neutro: "bg-hundido text-gris",
  oscuro: "bg-tinta text-[#f2efe8]",
};

/**
 * Estado como etiqueta tejida pequeña: color suave con una costura punteada
 * por dentro. Nunca solo color: siempre lleva texto.
 */
/** Una señal además del color: palomita (bien), signo (atención), cruz (agotado o vencido). */
const SENAL: Partial<Record<Tono, React.ReactNode>> = {
  verde: <path d="M3.2 8.4 6.4 11.5 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  ambar: (
    <>
      <path d="M8 3.2v5.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="8" cy="12.4" r="1.4" fill="currentColor" />
    </>
  ),
  rojo: <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
};

export function Insignia({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  const senal = SENAL[tono];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] px-2 py-[0.18rem] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] outline-1 -outline-offset-[3px] outline-dashed outline-current/35 ${TONOS[tono]}`}
    >
      {senal && (
        <svg aria-hidden viewBox="0 0 16 16" className="-ml-0.5 size-[10px] shrink-0">
          {senal}
        </svg>
      )}
      {children}
    </span>
  );
}

const MEMBRESIA: Record<Estado, { texto: string; tono: Tono }> = {
  vigente: { texto: "Al corriente", tono: "verde" },
  por_vencer: { texto: "Por vencer", tono: "ambar" },
  vencida: { texto: "Vencida", tono: "rojo" },
  sin_plan: { texto: "Sin plan", tono: "neutro" },
};

export function EstadoMembresia({ estado, activo = true }: { estado: Estado; activo?: boolean }) {
  if (!activo) return <Insignia tono="oscuro">Baja</Insignia>;
  const { texto, tono } = MEMBRESIA[estado];
  return <Insignia tono={tono}>{texto}</Insignia>;
}

const STOCK: Record<EstadoStock, { texto: string; tono: Tono }> = {
  suficiente: { texto: "Suficiente", tono: "verde" },
  bajo: { texto: "Stock bajo", tono: "ambar" },
  agotado: { texto: "Agotado", tono: "rojo" },
};

export function EstadoStockInsignia({ estado }: { estado: EstadoStock }) {
  const { texto, tono } = STOCK[estado];
  return <Insignia tono={tono}>{texto}</Insignia>;
}
