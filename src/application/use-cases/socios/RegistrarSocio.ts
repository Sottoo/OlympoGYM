import { type MetodoPago, revisarFechaDeCobro, validarNuevoPago } from "@/domain/entities/Pago";
import { esPlanDeVisita } from "@/domain/entities/Plan";
import { type DatosNuevoSocio, type Socio, validarNuevoSocio } from "@/domain/entities/Socio";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, SinPermiso } from "@/domain/shared/ErrorDeDominio";
import type { CobrarVisita } from "../asistencias/Mostrador";
import type { AsignarPlan } from "../suscripciones/AsignarPlan";
import { asegurarCelularLibre } from "./celular";
import { buscarParecidos } from "./Duplicados";

export interface CobroDeInscripcion {
  planId: string;
  metodoPago: MetodoPago;
  /** Si no se indica, se cobra el precio del plan. */
  monto?: number;
  nota?: string | null;
  /** Día en que se cobró, si se registra tarde (hasta 31 días atrás). Si no, hoy. */
  fecha?: string | null;
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
    /** Si quien inscribe puede anotar el cobro con fecha de otro día (cambia cortes ya cerrados). */
    private readonly permitirOtraFecha = true,
  ) {}

  async ejecutar(datos: DatosNuevoSocio, cobro: CobroDeInscripcion, opciones: { esOtraPersona?: boolean } = {}): Promise<{ socio: Socio; esVisita: boolean }> {
    const validos = validarNuevoSocio(datos, this.reloj.hoy());
    await asegurarCelularLibre(this.socios, validos.telefono);
    // Alguien con el mismo nombre ya está inscrito: casi siempre es la misma persona que regresó.
    // Se cobra en su ficha; solo si de verdad es otra persona se inscribe aparte.
    if (!opciones.esOtraPersona) {
      const mismo = (await buscarParecidos(this.socios, { nombre: validos.nombre, apellidos: validos.apellidos })).find((p) => p.motivo === "nombre");
      if (mismo) {
        throw new ErrorDeDominio(
          `${mismo.nombre} ya está inscrito (${mismo.numero}${mismo.activo ? "" : ", en espera"}). Si es la misma persona, ábrelo y cóbrale desde su ficha. Si es otra persona con el mismo nombre, marca «Es otra persona».`,
          "nombre",
        );
      }
    }

    if (!cobro.planId) throw new ErrorDeDominio("Elige el plan con el que se inscribe.", "planId");
    const plan = await this.planes.obtenerPorId(cobro.planId);
    if (!plan || !plan.activo) throw new ErrorDeDominio("Ese plan ya no está disponible. Elige otro.", "planId");
    const esVisita = esPlanDeVisita(plan);
    const dia = revisarFechaDeCobro(cobro.fecha, this.reloj.hoy());
    // Se revisa antes de guardar al socio, para no dejarlo inscrito a medias.
    if (!this.permitirOtraFecha && dia !== this.reloj.hoy()) throw new SinPermiso("registrar un cobro con fecha de otro día");
    // La visita es la entrada de hoy: no se cobra con otra fecha.
    if (esVisita && dia !== this.reloj.hoy()) {
      throw new ErrorDeDominio("La visita se cobra el mismo día que se entrena. Para otro día, usa un plan de membresía.", "fecha");
    }
    if (!esVisita && cobro.monto !== undefined && cobro.monto !== plan.precio && !this.permitirOtroMonto) {
      throw new SinPermiso("cobrar un monto distinto al precio del plan");
    }
    // El pago se revisa antes de guardar nada (monto, método, nota).
    validarNuevoPago({
      socioId: "-",
      suscripcionId: null,
      monto: esVisita ? plan.precio : (cobro.monto ?? plan.precio),
      metodo: cobro.metodoPago,
      fecha: dia,
      nota: cobro.nota ?? null,
    });

    const socio = await this.socios.crear(validos);
    try {
      // Se cobra la visita que eligieron (puede haber varias, p. ej. general y estudiante).
      if (esVisita) await this.cobrarVisita.ejecutar(socio.id, cobro.metodoPago, { planId: plan.id, nombre: plan.nombre, precio: plan.precio });
      else await this.asignarPlan.ejecutar({ socioId: socio.id, planId: plan.id, metodoPago: cobro.metodoPago, monto: cobro.monto, nota: cobro.nota, fecha: dia });
    } catch (error) {
      await this.socios.eliminarSinHistorial(socio.id).catch(() => undefined);
      throw error;
    }
    return { socio, esVisita };
  }
}
