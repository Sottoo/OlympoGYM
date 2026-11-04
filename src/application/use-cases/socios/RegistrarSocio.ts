import { type MetodoPago, validarNuevoPago } from "@/domain/entities/Pago";
import { esPlanDeVisita } from "@/domain/entities/Plan";
import { type DatosNuevoSocio, type Socio, validarNuevoSocio } from "@/domain/entities/Socio";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, SinPermiso } from "@/domain/shared/ErrorDeDominio";
import type { CobrarVisita } from "../asistencias/Mostrador";
import type { AsignarPlan } from "../suscripciones/AsignarPlan";
import { asegurarCelularLibre } from "./celular";

export interface CobroDeInscripcion {
  planId: string;
  metodoPago: MetodoPago;
  /** Si no se indica, se cobra el precio del plan. */
  monto?: number;
  nota?: string | null;
}

/**
 * Inscribe a un socio: sus datos, su plan y el pago, en un solo paso.
 *
 * Nadie queda registrado "sin plan": quien se inscribe sale de recepción con
 * su membresía activa (o con su visita de hoy pagada y su entrada anotada).
 * Primero se revisa todo; si aun así el cobro fallara, el registro se deshace
 * para no dejar un socio a medias.
 */
export class RegistrarSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly planes: PlanRepository,
    private readonly asignarPlan: AsignarPlan,
    private readonly cobrarVisita: CobrarVisita,
    private readonly reloj: Reloj,
    private readonly permitirOtroMonto = true,
  ) {}

  async ejecutar(datos: DatosNuevoSocio, cobro: CobroDeInscripcion): Promise<{ socio: Socio; esVisita: boolean }> {
    const validos = validarNuevoSocio(datos, this.reloj.hoy());
    await asegurarCelularLibre(this.socios, validos.telefono);

    if (!cobro.planId) throw new ErrorDeDominio("Elige el plan con el que se inscribe.", "planId");
    const plan = await this.planes.obtenerPorId(cobro.planId);
    if (!plan || !plan.activo) throw new ErrorDeDominio("Ese plan ya no está disponible. Elige otro.", "planId");
    const esVisita = esPlanDeVisita(plan);
    if (!esVisita && cobro.monto !== undefined && cobro.monto !== plan.precio && !this.permitirOtroMonto) {
      throw new SinPermiso("cobrar un monto distinto al precio del plan");
    }
    // El pago se revisa antes de guardar nada (monto, método, nota).
    validarNuevoPago({
      socioId: "-",
      suscripcionId: null,
      monto: esVisita ? plan.precio : (cobro.monto ?? plan.precio),
      metodo: cobro.metodoPago,
      fecha: this.reloj.hoy(),
      nota: cobro.nota ?? null,
    });

    const socio = await this.socios.crear(validos);
    try {
      if (esVisita) await this.cobrarVisita.ejecutar(socio.id, cobro.metodoPago);
      else await this.asignarPlan.ejecutar({ socioId: socio.id, planId: plan.id, metodoPago: cobro.metodoPago, monto: cobro.monto, nota: cobro.nota });
    } catch (error) {
      await this.socios.eliminarSinHistorial(socio.id).catch(() => undefined);
      throw error;
    }
    return { socio, esVisita };
  }
}
