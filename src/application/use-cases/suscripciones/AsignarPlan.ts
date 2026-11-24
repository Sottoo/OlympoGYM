import { type Devolucion, type MetodoPago, revisarFechaDeCobro, validarDevolucion, validarNuevoPago } from "@/domain/entities/Pago";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import { calcularFechaFin, esPlanDeVisita } from "@/domain/entities/Plan";
import { diaDePago, fechaDePago, type Suscripcion } from "@/domain/entities/Suscripcion";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado, SinPermiso } from "@/domain/shared/ErrorDeDominio";
import { sumarDias } from "@/domain/shared/fechas";
import { formatearFecha } from "@/shared/formato";

export interface EntradaAsignarPlan {
  socioId: string;
  planId: string;
  metodoPago: MetodoPago;
  /** Si no se indica, se cobra el precio del plan. */
  monto?: number;
  nota?: string | null;
  /** Día en que se cobró, si se olvidó registrar a tiempo (hasta 31 días atrás). Si no, hoy. */
  fecha?: string | null;
}

/**
 * Asigna (o renueva) un plan a un socio y registra el pago en mostrador.
 * Si se olvidó registrar un cobro, se puede anotar con su fecha real.
 *
 * Reglas de negocio:
 *  · Una membresía a la vez: mientras la actual siga vigente no se le puede
 *    cobrar otra (así no se cobra dos veces por error). Desde su último día
 *    ya se puede renovar.
 *  · Si renueva su último día, el nuevo periodo empieza al día siguiente,
 *    para que no pierda ese día que ya pagó.
 */
export class AsignarPlan {
  constructor(
    private readonly socios: SocioRepository,
    private readonly planes: PlanRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
    /** Si quien cobra puede poner un monto distinto al precio del plan (descuentos). */
    private readonly permitirOtroMonto = true,
    /** Si quien cobra puede anotar un cobro con fecha de otro día (cambia cortes ya cerrados). */
    private readonly permitirOtraFecha = true,
  ) {}

  async ejecutar(entrada: EntradaAsignarPlan): Promise<Suscripcion> {
    const [socio, plan] = await Promise.all([
      this.socios.obtenerPorId(entrada.socioId),
      this.planes.obtenerPorId(entrada.planId),
    ]);
    if (!socio) throw new NoEncontrado("El socio");
    if (!plan) throw new NoEncontrado("El plan");
    if (!socio.activo) throw new ErrorDeDominio("Este socio está dado de baja. Reactívalo para asignarle un plan.");
    if (!plan.activo) throw new ErrorDeDominio("Ese plan está desactivado. Elige otro o actívalo en Planes.");

    if (!this.permitirOtroMonto && entrada.monto !== undefined && entrada.monto !== plan.precio) {
      throw new SinPermiso("cobrar un monto distinto al precio del plan");
    }

    // El cobro cuenta el día en que se hizo: si se registra tarde, la membresía empieza ese día
    // y el dinero entra en el corte de ese día.
    const dia = revisarFechaDeCobro(entrada.fecha, this.reloj.hoy());
    if (!this.permitirOtraFecha && dia !== this.reloj.hoy()) throw new SinPermiso("registrar un cobro con fecha de otro día");
    const historial = await this.suscripciones.listarPorSocio(socio.id);
    // Las visitas de un día no son membresías: no bloquean ni se renuevan.
    const ultima = ultimaMembresia(historial);
    if (ultima && ultima.fechaFin > dia) {
      throw new ErrorDeDominio(
        ultima.fechaInicio > dia
          ? `${socio.nombre} ya tiene pagada su siguiente membresía (${ultima.planNombre}, del ${formatearFecha(ultima.fechaInicio)} al ${formatearFecha(fechaDePago(ultima))}). No se le puede cobrar otra.`
          : `${socio.nombre} ya tiene su membresía vigente; vence el ${formatearFecha(fechaDePago(ultima))}. Se puede renovar desde el ${formatearFecha(ultima.fechaFin)}.`,
      );
    }
    // Ese día ya lo tiene pagado (es el último de su membresía, o pagó la visita): la nueva empieza al siguiente.
    const diaYaPagado = ultima?.fechaFin === dia || (!esPlanDeVisita(plan) && historial.some((s) => s.esVisita && s.fechaInicio === dia));
    const fechaInicio = diaYaPagado ? sumarDias(dia, 1) : dia;

    const pago = validarNuevoPago({
      socioId: socio.id,
      suscripcionId: null,
      monto: entrada.monto ?? plan.precio,
      metodo: entrada.metodoPago,
      fecha: dia,
      nota: entrada.nota ?? null,
    });

    const { socioId, monto, metodo, fecha, nota } = pago;
    const datosPago = { socioId, monto, metodo, fecha, nota };
    // Si renueva sin cortar, conserva su día de pago (el 31 sigue siendo 31 después de febrero).
    const fechaFin = calcularFechaFin(fechaInicio, plan, diaDePago(historial, fechaInicio));
    return this.suscripciones.crearConPago({ socioId: socio.id, planId: plan.id, fechaInicio, fechaFin }, datosPago);
  }
}

/**
 * Corrige la membresía más reciente de un socio cuando se registró con el
 * plan equivocado (p. ej. se puso Quincena y era Mensual): cambia el plan, el
 * vencimiento (desde el mismo día de inicio) y el monto y método de su pago.
 * Solo la última, para no descuadrar las que siguen. Queda en la bitácora.
 *
 * Solo el mismo día que se cobró: el corte de un día pasado ya se contó y no
 * cambia. Después, si hay que regresar dinero, se hace una devolución.
 */
export class CorregirMembresia {
  constructor(
    private readonly planes: PlanRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Pick<Reloj, "hoy" | "local">,
  ) {}

  async ejecutar(entrada: { suscripcionId: string; planId: string; monto?: number; metodoPago: MetodoPago }): Promise<Suscripcion> {
    const actual = await this.suscripciones.obtenerPorId(entrada.suscripcionId);
    if (!actual) throw new NoEncontrado("La membresía");
    if (actual.esVisita) throw new ErrorDeDominio("Las visitas de un día no se corrigen aquí.");
    const historial = await this.suscripciones.listarPorSocio(actual.socioId);
    if (ultimaMembresia(historial)?.id !== actual.id) throw new ErrorDeDominio("Solo se puede corregir la membresía más reciente del socio.");
    if (!cobradaHoy(actual, this.reloj)) {
      throw new ErrorDeDominio("Solo se corrige el mismo día que se cobró: el corte de ese día ya se contó. Si hay que regresar dinero, usa «Devolución».");
    }
    const plan = await this.planes.obtenerPorId(entrada.planId);
    if (!plan) throw new ErrorDeDominio("Elige el plan correcto.", "planId");
    if (esPlanDeVisita(plan)) throw new ErrorDeDominio("Elige un plan de membresía, no la visita de un día.", "planId");
    const pago = validarNuevoPago({
      socioId: actual.socioId,
      suscripcionId: actual.id,
      monto: entrada.monto ?? plan.precio,
      metodo: entrada.metodoPago,
      fecha: actual.fechaInicio,
      nota: null,
    });
    const fechaFin = calcularFechaFin(actual.fechaInicio, plan, diaDePago(historial, actual.fechaInicio));
    return this.suscripciones.corregir(actual.id, { planId: plan.id, fechaFin }, { monto: pago.monto, metodo: pago.metodo });
  }
}

/**
 * Cancela una membresía cobrada por error (por ejemplo, se le cobró dos
 * veces): borra la membresía y su pago. Queda en la bitácora.
 *
 * Solo la más reciente del socio y solo el mismo día que se registró: así
 * únicamente cambia el corte de hoy, que todavía no se cuenta. Desde el día
 * siguiente ya no se borra nada: si hay que regresar dinero, se hace una
 * devolución (sale de la caja del día en que se devuelve).
 */
export class CancelarMembresia {
  constructor(
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(suscripcionId: string): Promise<void> {
    const actual = await this.suscripciones.obtenerPorId(suscripcionId);
    if (!actual) throw new NoEncontrado("La membresía");
    if (actual.esVisita) throw new ErrorDeDominio("Las visitas de un día se anulan desde el mostrador.");
    if (ultimaMembresia(await this.suscripciones.listarPorSocio(actual.socioId))?.id !== actual.id) {
      throw new ErrorDeDominio("Solo se puede cancelar la membresía más reciente del socio.");
    }
    if (!sePuedeCancelar(actual, this.reloj)) {
      throw new ErrorDeDominio("Solo se cancela el mismo día que se cobró: el corte de ese día ya se contó. Si hay que regresar dinero, usa «Devolución».");
    }
    await this.suscripciones.anularConSuPago(actual.id);
  }
}

/** Se registró hoy (aunque se haya anotado con fecha de otro día): su corte todavía no se cuenta. */
export function cobradaHoy(s: Pick<Suscripcion, "creadoEn">, reloj: Pick<Reloj, "hoy" | "local">): boolean {
  return reloj.local(s.creadoEn).fecha === reloj.hoy();
}

/** Cancelar (borrar membresía y pago) solo el mismo día que se registró. */
export const sePuedeCancelar = cobradaHoy;

/**
 * Devolución: regresa dinero de la membresía más reciente, que sigue vigente o
 * ya pagada para después, y no se cobró hoy (eso se cancela). Se registra hoy,
 * sale de la caja de hoy, lleva su motivo y la membresía termina ayer (ya no
 * entra). Nunca más de lo que pagó por ella. Queda en la bitácora.
 */
export class DevolverMembresia {
  constructor(
    private readonly suscripciones: SuscripcionRepository,
    private readonly pagos: PagoRepository,
    private readonly reloj: Pick<Reloj, "hoy" | "local">,
  ) {}

  async ejecutar(entrada: { suscripcionId: string; monto: number; metodoPago: MetodoPago; motivo: string }): Promise<Devolucion> {
    const actual = await this.suscripciones.obtenerPorId(entrada.suscripcionId);
    if (!actual) throw new NoEncontrado("La membresía");
    if (actual.esVisita) throw new ErrorDeDominio("Las visitas no se devuelven: se anulan el mismo día desde el mostrador.");
    if (ultimaMembresia(await this.suscripciones.listarPorSocio(actual.socioId))?.id !== actual.id) {
      throw new ErrorDeDominio("Solo se puede devolver la membresía más reciente del socio.");
    }
    const hoy = this.reloj.hoy();
    if (actual.fechaFin < hoy) throw new ErrorDeDominio("Esta membresía ya terminó: no quedan días que devolver.");
    if (cobradaHoy(actual, this.reloj)) throw new ErrorDeDominio("Se cobró hoy: en lugar de devolución, cancélala (sale del corte de hoy).");
    const { pagado, devuelto } = await this.pagos.montosDeMembresia(actual.id);
    const maximo = Math.round((pagado - devuelto) * 100) / 100;
    if (maximo <= 0) throw new ErrorDeDominio("No hay dinero que devolver de esta membresía.");
    const datos = validarDevolucion(
      { socioId: actual.socioId, suscripcionId: actual.id, monto: entrada.monto, metodo: entrada.metodoPago, fecha: hoy, motivo: entrada.motivo },
      maximo,
    );
    // Termina ayer: hoy ya no entra con ella. Si aún no empezaba, queda de un día (ayer) para no perder su historial.
    const fechaFin = sumarDias(hoy, -1);
    const fechaInicio = actual.fechaInicio > fechaFin ? fechaFin : actual.fechaInicio;
    return this.pagos.registrarDevolucion(datos, { id: actual.id, fechaInicio, fechaFin });
  }
}

/** La membresía más reciente, sin contar visitas de un día. Recibe la lista de la más lejana a la más antigua. */
function ultimaMembresia(historial: Suscripcion[]): Suscripcion | null {
  return historial.find((s) => !s.esVisita) ?? null;
}
