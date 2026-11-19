import type { DatosNuevoPlan, Plan } from "../entities/Plan";

export interface PlanRepository {
  listar(filtro?: { soloActivos?: boolean }): Promise<Plan[]>;
  obtenerPorId(id: string): Promise<Plan | null>;
  crear(datos: DatosNuevoPlan): Promise<Plan>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
  /** Cambia nombre, descripción, precio o duración. Lo ya cobrado no cambia. */
  actualizar(id: string, datos: DatosNuevoPlan): Promise<Plan>;
  /** Si ya se vendió alguna vez (hay membresías o visitas con este plan). */
  tieneSuscripciones(id: string): Promise<boolean>;
  /** Los planes que ya se vendieron alguna vez (sus ids). */
  idsVendidos(): Promise<string[]>;
  /**
   * Elimina el plan para siempre. Si nunca se vendió se borra por completo;
   * si ya se vendió deja de aparecer, pero las membresías y pagos se conservan.
   */
  eliminar(id: string): Promise<"completo" | "conservado">;
}
