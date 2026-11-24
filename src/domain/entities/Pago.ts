import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { LIMITES, revisarDinero } from "../shared/reglas";
import { esFechaValida, type FechaISO, sumarDias } from "../shared/fechas";

/** El gimnasio cobra en efectivo o por transferencia (no hay terminal de tarjeta). */
export type MetodoPago = "efectivo" | "transferencia";

export const METODOS_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

/** Nombre para mostrar del método guardado en un cobro, incluso si ya no se ofrece. */
export function nombreDelMetodo(metodo: string): string {
  return METODOS_PAGO[metodo as MetodoPago] ?? metodo.charAt(0).toUpperCase() + metodo.slice(1);
}

export interface Pago {
  id: string;
  socioId: string;
  suscripcionId: string | null;
  monto: number;
  metodo: MetodoPago;
  fecha: FechaISO;
  nota: string | null;
  creadoEn: string;
}

export type DatosNuevoPago = Omit<Pago, "id" | "creadoEn">;

/** Un cobro de membresía o visita, con a quién y qué se le cobró (para el corte de caja). */
export interface PagoDelDia extends Pago {
  socioNombre: string;
  planNombre: string | null;
}

/**
 * Dinero que se le regresa a un socio. Desde el día siguiente a un cobro ya
 * no se borra ni se corrige (el corte de ese día ya se contó): la devolución
 * se registra el día en que se hace, sale de la caja de ese día, lleva su
 * motivo y termina la membresía. Los cortes pasados nunca cambian.
 */
export interface Devolucion {
  id: string;
  socioId: string;
  suscripcionId: string | null;
  monto: number;
  metodo: MetodoPago;
  fecha: FechaISO;
  motivo: string;
  creadoEn: string;
}

export type DatosNuevaDevolucion = Omit<Devolucion, "id" | "creadoEn">;

/** Una devolución del día, con a quién y de qué plan (para el corte de caja). */
export interface DevolucionDelDia extends Devolucion {
  socioNombre: string;
  planNombre: string | null;
}

/** Revisa una devolución: hasta lo que pagó por esa membresía (menos lo ya devuelto), con método y motivo. */
export function validarDevolucion(datos: DatosNuevaDevolucion, maximo: number): DatosNuevaDevolucion {
  const errorMonto = revisarDinero(datos.monto, { minExclusivo: true, que: "Lo que se devuelve" });
  if (errorMonto) throw new ErrorDeDominio(errorMonto, "monto");
  if (datos.monto > maximo + 0.001) throw new ErrorDeDominio(`No se puede devolver más de lo que pagó por esta membresía (${maximo.toFixed(2).replace(/\.00$/, "")} pesos).`, "monto");
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige cómo se le devuelve el dinero.", "metodoPago");
  const motivo = datos.motivo.trim().replace(/\s+/g, " ");
  if (motivo.length < 3) throw new ErrorDeDominio("Escribe el motivo de la devolución.", "motivo");
  if (motivo.length > LIMITES.nota) throw new ErrorDeDominio(`El motivo puede tener hasta ${LIMITES.nota} caracteres.`, "motivo");
  return { ...datos, monto: Math.round(datos.monto * 100) / 100, motivo };
}

/** Hasta cuántos días atrás se puede registrar un cobro que se olvidó anotar. */
export const DIAS_PARA_COBRO_ATRASADO = 31;

/**
 * Fecha de un cobro: hoy, o un día anterior si se olvidó registrarlo. Nunca
 * en el futuro ni más atrás de 31 días (un mes completo para corregir).
 */
export function revisarFechaDeCobro(fecha: FechaISO | undefined | null, hoy: FechaISO): FechaISO {
  if (!fecha || fecha === hoy) return hoy;
  if (!esFechaValida(fecha)) throw new ErrorDeDominio("La fecha del cobro no es válida.", "fecha");
  if (fecha > hoy) throw new ErrorDeDominio("La fecha del cobro no puede ser en el futuro.", "fecha");
  if (fecha < sumarDias(hoy, -DIAS_PARA_COBRO_ATRASADO)) {
    throw new ErrorDeDominio(`Solo se pueden registrar cobros de hasta ${DIAS_PARA_COBRO_ATRASADO} días atrás.`, "fecha");
  }
  return fecha;
}

export function validarNuevoPago(datos: DatosNuevoPago): DatosNuevoPago {
  const errorMonto = revisarDinero(datos.monto, { que: "El monto" });
  if (errorMonto) throw new ErrorDeDominio(errorMonto, "monto");
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige un método de pago.", "metodoPago");
  const nota = datos.nota?.trim() || null;
  if (nota && nota.length > LIMITES.nota) throw new ErrorDeDominio(`La nota puede tener hasta ${LIMITES.nota} caracteres.`, "nota");
  return { ...datos, monto: Math.round(datos.monto * 100) / 100, nota };
}
