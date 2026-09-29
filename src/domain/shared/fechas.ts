/**
 * Utilidades de fechas del dominio.
 *
 * Todas las fechas de negocio (inicio y fin de una suscripción, fecha de pago)
 * se manejan como texto "AAAA-MM-DD", sin hora. Así evitamos errores de zona
 * horaria: una membresía vence "el 30 de septiembre", no "el 30 a las 18:00 UTC".
 */
export type FechaISO = string;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(valor: string): valor is FechaISO {
  if (!PATRON_FECHA.test(valor)) return false;
  const d = aDate(valor);
  return !Number.isNaN(d.getTime()) && aTexto(d) === valor;
}

/** Fecha de hoy en la zona horaria indicada (ej. America/Mexico_City). */
export function hoyEn(zonaHoraria: string): FechaISO {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** Suma meses respetando fin de mes: 31 ene + 1 mes = 28/29 feb. */
export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const d = aDate(fecha);
  const diaOriginal = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(diaOriginal, ultimoDia));
  return aTexto(d);
}

/** Días que hay de `desde` a `hasta` (negativo si `hasta` ya pasó). */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  const ms = aDate(hasta).getTime() - aDate(desde).getTime();
  return Math.round(ms / 86_400_000);
}

export function primerDiaDelMes(fecha: FechaISO): FechaISO {
  return `${fecha.slice(0, 7)}-01`;
}

function aDate(fecha: FechaISO): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aTexto(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}
