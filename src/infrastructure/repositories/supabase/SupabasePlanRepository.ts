import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevoPlan, Plan } from "@/domain/entities/Plan";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { FilaPlan } from "../../supabase/tipos";
import { aPlan, verificar } from "./mapeos";

export class SupabasePlanRepository implements PlanRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(filtro?: { soloActivos?: boolean }): Promise<Plan[]> {
    let consulta = this.db.from("planes").select("*").order("precio");
    if (filtro?.soloActivos) consulta = consulta.eq("activo", true);
    return verificar<FilaPlan[]>(await consulta).map(aPlan);
  }

  async obtenerPorId(id: string): Promise<Plan | null> {
    const fila = verificar<FilaPlan | null>(await this.db.from("planes").select("*").eq("id", id).maybeSingle());
    return fila ? aPlan(fila) : null;
  }

  async crear(datos: DatosNuevoPlan): Promise<Plan> {
    return aPlan(verificar<FilaPlan>(await this.db.from("planes").insert(datos).select().single()));
  }

  async cambiarEstado(id: string, activo: boolean): Promise<void> {
    verificar(await this.db.from("planes").update({ activo }).eq("id", id));
  }
}
