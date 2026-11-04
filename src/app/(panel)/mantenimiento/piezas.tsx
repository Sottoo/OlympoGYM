import {
  type EstadoEquipo,
  ESTADOS_EQUIPO,
  ESTADOS_PAGO,
  estadoDePago,
  type Mantenimiento,
  type Preventivo,
} from "@/domain/entities/Mantenimiento";
import { Insignia, type Tono } from "@/presentation/components/Insignia";
import { formatearFecha } from "@/shared/formato";

const TONO_EQUIPO: Record<EstadoEquipo, Tono> = {
  funcionando: "verde",
  con_falla: "ambar",
  fuera_de_servicio: "rojo",
  de_baja: "neutro",
};

export function EstadoEquipoInsignia({ estado }: { estado: EstadoEquipo }) {
  return <Insignia tono={TONO_EQUIPO[estado]}>{ESTADOS_EQUIPO[estado]}</Insignia>;
}

const TONO_PAGO = { sin_costo: "neutro", pagado: "verde", parcial: "ambar", por_pagar: "rojo" } as const;

export function EstadoPagoInsignia({ m }: { m: Pick<Mantenimiento, "total" | "pagado"> }) {
  const estado = estadoDePago(m);
  return <Insignia tono={TONO_PAGO[estado]}>{ESTADOS_PAGO[estado]}</Insignia>;
}

/** "Vencido hace 12 días", "Toca mañana", "En 9 días" o la fecha, con su color. */
export function textoPreventivo(p: Preventivo): { texto: string; clase: string } {
  if (p.estado === "sin_programa") return { texto: "Sin programa", clase: "text-gris" };
  if (p.estado === "vencido") {
    const d = -p.dias;
    return { texto: `Vencido hace ${d} ${d === 1 ? "día" : "días"}`, clase: "font-semibold text-rojo" };
  }
  if (p.estado === "pronto") {
    return { texto: p.dias === 0 ? "Toca hoy" : p.dias === 1 ? "Toca mañana" : `En ${p.dias} días`, clase: "font-semibold text-ambar" };
  }
  return { texto: formatearFecha(p.proximo), clase: "text-tinta-suave" };
}

export function Preventivo({ p }: { p: Preventivo }) {
  const { texto, clase } = textoPreventivo(p);
  return <span className={clase}>{texto}</span>;
}

/** "Hace 3 días", "Hoy", "Ayer" a partir de un instante y la fecha de hoy. */
export function hace(fecha: string, hoy: string): string {
  const dias = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}
