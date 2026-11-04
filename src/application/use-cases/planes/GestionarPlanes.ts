import { type DatosNuevoPlan, type Plan, validarNuevoPlan } from "@/domain/entities/Plan";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

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

export class CambiarEstadoPlan {
  constructor(private readonly planes: PlanRepository) {}

  async ejecutar(planId: string, activo: boolean): Promise<void> {
    const plan = await this.planes.obtenerPorId(planId);
    if (!plan) throw new NoEncontrado("El plan");
    await this.planes.cambiarEstado(planId, activo);
  }
}
