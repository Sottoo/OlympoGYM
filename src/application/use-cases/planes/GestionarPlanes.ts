import { type DatosNuevoPlan, type Plan, validarNuevoPlan } from "@/domain/entities/Plan";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export class ListarPlanes {
  constructor(private readonly planes: PlanRepository) {}

  ejecutar(soloActivos = false): Promise<Plan[]> {
    return this.planes.listar({ soloActivos });
  }
}

export class CrearPlan {
  constructor(private readonly planes: PlanRepository) {}

  ejecutar(datos: DatosNuevoPlan): Promise<Plan> {
    return this.planes.crear(validarNuevoPlan(datos));
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
