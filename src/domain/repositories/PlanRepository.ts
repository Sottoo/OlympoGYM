import type { DatosNuevoPlan, Plan } from "../entities/Plan";

export interface PlanRepository {
  listar(filtro?: { soloActivos?: boolean }): Promise<Plan[]>;
  obtenerPorId(id: string): Promise<Plan | null>;
  crear(datos: DatosNuevoPlan): Promise<Plan>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
}
