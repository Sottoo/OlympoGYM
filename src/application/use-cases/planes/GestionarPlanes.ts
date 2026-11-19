import { type DatosNuevoPlan, type Plan, validarNuevoPlan } from "@/domain/entities/Plan";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { limpiarEspacios } from "@/domain/shared/reglas";

export class ListarPlanes {
  constructor(private readonly planes: PlanRepository) {}

  ejecutar(soloActivos = false): Promise<Plan[]> {
    return this.planes.listar({ soloActivos });
  }
}

export class CrearPlan {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(datos: DatosNuevoPlan): Promise<Plan> {
    const validos = validarNuevoPlan(datos);
    const mismoNombre = (await this.planes.listar({ soloActivos: true })).find(
      (p) => p.nombre.localeCompare(validos.nombre, "es", { sensitivity: "base" }) === 0,
    );
    if (mismoNombre) throw new ErrorDeDominio(`Ya hay un plan activo llamado «${mismoNombre.nombre}». Usa otro nombre.`, "nombre");
    return this.planes.crear(validos);
  }
}

/**
 * Cambia un plan del catálogo. Lo que ya se cobró no cambia: cada membresía
 * guarda su vencimiento y cada pago su monto. Los cambios aplican a los
 * cobros que se hagan de aquí en adelante.
 *
 * Un plan que ya se vendió conserva su nombre y su duración: el historial,
 * los cortes y las métricas lo muestran con su nombre actual, y un «Mensual»
 * que de pronto dura 3 meses confunde lo ya cobrado. El precio sí cambia.
 */
export class EditarPlan {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(planId: string, datos: DatosNuevoPlan): Promise<Plan> {
    const actual = await this.planes.obtenerPorId(planId);
    if (!actual) throw new NoEncontrado("El plan");
    const validos = validarNuevoPlan(datos);
    const mismoNombre = (await this.planes.listar({ soloActivos: true })).find(
      (p) => p.id !== planId && p.nombre.localeCompare(validos.nombre, "es", { sensitivity: "base" }) === 0,
    );
    if (mismoNombre) throw new ErrorDeDominio(`Ya hay otro plan activo llamado «${mismoNombre.nombre}». Usa otro nombre.`, "nombre");
    // Solo espacios de más no cuentan como otro nombre.
    const cambiaNombre = validos.nombre !== limpiarEspacios(actual.nombre);
    const cambiaDuracion = validos.duracion !== actual.duracion || validos.unidad !== actual.unidad;
    if ((cambiaNombre || cambiaDuracion) && (await this.planes.tieneSuscripciones(planId))) {
      throw new ErrorDeDominio(
        "Este plan ya se vendió: su nombre y duración no se cambian para no alterar el historial ni los cortes. Desactívalo y crea uno nuevo.",
        cambiaNombre ? "nombre" : "duracion",
      );
    }
    return this.planes.actualizar(planId, validos);
  }
}

/** Qué planes ya se vendieron: al eliminarlos, sus membresías se conservan. */
export class ListarPlanesVendidos {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(): Promise<Set<string>> {
    return new Set(await this.planes.idsVendidos());
  }
}

/** Eliminar un plan para siempre. Lo ya cobrado no cambia. */
export class EliminarPlan {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(planId: string): Promise<string> {
    const plan = await this.planes.obtenerPorId(planId);
    if (!plan) throw new NoEncontrado("El plan");
    await this.planes.eliminar(planId);
    return plan.nombre;
  }
}

export class CambiarEstadoPlan {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(planId: string, activo: boolean): Promise<void> {
    const plan = await this.planes.obtenerPorId(planId);
    if (!plan) throw new NoEncontrado("El plan");
    await this.planes.cambiarEstado(planId, activo);
  }
}
