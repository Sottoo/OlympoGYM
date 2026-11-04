/**
 * Formato para mostrar datos a personas (fechas, dinero, teléfonos).
 * Utilidad transversal: la usan la interfaz y las plantillas de correo.
 */
import type { FechaISO } from "@/domain/shared/fechas";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-09-30" → "30 sep 2026" */
/** Hora del día (0-23) en la zona del gimnasio: para saludar con "buenos días" o "buenas tardes". */
export function horaLocal(zonaHoraria: string, instante = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria, hour: "numeric", hourCycle: "h23" }).format(instante)) % 24;
}

export function formatearFecha(fecha: FechaISO): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

/** "2026-09-30" → "30 de septiembre de 2026" */
export function formatearFechaLarga(fecha: FechaISO): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const pesosConCentavos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** "$550" si es cantidad cerrada; "$27.50" si trae centavos. */
export function formatearDinero(monto: number): string {
  return Number.isInteger(monto) ? pesos.format(monto) : pesosConCentavos.format(monto);
}

/** Fecha local (AAAA-MM-DD) de un instante guardado en UTC: lo dado de alta a las 19:00 del 31 sigue siendo del 31. */
export function fechaLocal(instante: string, zonaHoraria: string): FechaISO {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria }).format(new Date(instante));
}

/**
 * Tamaño de letra de una cifra en las etiquetas tejidas: las cantidades
 * largas ($120,000.50) bajan de tamaño para no cortarse.
 */
export function tamanoDeCifra(valor: unknown, normal = "text-[2.1rem]"): string {
  const largo = typeof valor === "string" ? valor.length : typeof valor === "number" ? String(valor).length : 0;
  return largo > 11 ? "text-[1.3rem]" : largo > 9 ? "text-[1.5rem]" : largo > 7 ? "text-[1.75rem]" : normal;
}

/** Hora local de un instante ISO: "2026-09-22T17:05:00Z" → "11:05". */
export function formatearHora(instante: string, zonaHoraria: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: zonaHoraria, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(instante),
  );
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-09-22" → "martes" */
export function diaDeLaSemana(fecha: FechaISO): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** 1 socio, 2 socios. Si el plural no es regular, se indica. */
export function plural(n: number, singular: string, varios = `${singular}s`): string {
  return `${n.toLocaleString("es-MX")} ${n === 1 ? singular : varios}`;
}

/** "5512345678" → "55 1234 5678" */
export function formatearTelefono(telefono: string | null): string {
  if (!telefono) return "";
  const d = telefono.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : telefono;
}

/** Texto humano para los días restantes de una membresía. */
export function describirDiasRestantes(dias: number): string {
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  if (dias > 1) return `Vence en ${dias} días`;
  if (dias === -1) return "Venció ayer";
  return `Venció hace ${Math.abs(dias)} días`;
}
