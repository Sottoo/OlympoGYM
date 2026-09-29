import { type MetodoPago, validarNuevoPago } from "@/domain/entities/Pago";
import { calcularFechaFin } from "@/domain/entities/Plan";
import type { Suscripcion } from "@/domain/entities/Suscripcion";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { sumarDias } from "@/domain/shared/fechas";

export interface EntradaAsignarPlan {
  socioId: string;
  planId: string;
  metodoPago: MetodoPago;
  /** Si no se indica, se cobra el precio del plan. */
  monto?: number;
  nota?: string | null;
}

/**
 * Asigna (o renueva) un plan a un socio y registra el pago en mostrador.
 *
 * Regla de negocio: si el socio renueva antes de que se le acabe su plan,
 * el nuevo periodo empieza al día siguiente de su vencimiento actual,
 * para que no pierda los días que ya pagó.
 */
export class AsignarPlan {
  constructor(
    private readonly socios: SocioRepository,
    private readonly planes: PlanRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly pagos: PagoRepository,
    private readonly reloj: Reloj,
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

    const hoy = this.reloj.hoy();
    const ultima = await this.suscripciones.obtenerUltimaDeSocio(socio.id);
    const fechaInicio = ultima && ultima.fechaFin >= hoy ? sumarDias(ultima.fechaFin, 1) : hoy;

    const pago = validarNuevoPago({
      socioId: socio.id,
      suscripcionId: null,
      monto: entrada.monto ?? plan.precio,
      metodo: entrada.metodoPago,
      fecha: hoy,
      nota: entrada.nota ?? null,
    });

    const suscripcion = await this.suscripciones.crear({
      socioId: socio.id,
      planId: plan.id,
      fechaInicio,
      fechaFin: calcularFechaFin(fechaInicio, plan),
    });
    await this.pagos.crear({ ...pago, suscripcionId: suscripcion.id });

    return suscripcion;
  }
}
