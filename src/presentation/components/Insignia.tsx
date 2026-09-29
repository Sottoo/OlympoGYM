import type { EstadoStock } from "@/domain/entities/Producto";
import type { EstadoMembresia as Estado } from "@/domain/entities/Suscripcion";

export type Tono = "verde" | "ambar" | "rojo" | "neutro" | "oscuro";

const TONOS: Record<Tono, string> = {
  verde: "bg-verde-tenue text-verde",
  ambar: "bg-ambar-tenue text-ambar",
  rojo: "bg-rojo-tenue text-rojo",
  neutro: "bg-hundido text-gris",
  oscuro: "bg-tinta text-white",
};

/** Etiqueta compacta de estado. Sin íconos decorativos: el color y el texto bastan. */
export function Insignia({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[0.8rem] font-semibold ${TONOS[tono]}`}>
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
