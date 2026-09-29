import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevaSuscripcion, Suscripcion } from "@/domain/entities/Suscripcion";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { FilaSuscripcion } from "../../supabase/tipos";
import { aSuscripcion, verificar } from "./mapeos";

const CON_PLAN = "*, planes(nombre)";

export class SupabaseSuscripcionRepository implements SuscripcionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async crear(datos: DatosNuevaSuscripcion): Promise<Suscripcion> {
    const fila = verificar<FilaSuscripcion>(
      await this.db
        .from("suscripciones")
        .insert({
          socio_id: datos.socioId,
          plan_id: datos.planId,
          fecha_inicio: datos.fechaInicio,
          fecha_fin: datos.fechaFin,
        })
        .select(CON_PLAN)
        .single(),
    );
    return aSuscripcion(fila);
  }

  async listarPorSocio(socioId: string): Promise<Suscripcion[]> {
    const filas = verificar<FilaSuscripcion[]>(
      await this.db
        .from("suscripciones")
        .select(CON_PLAN)
        .eq("socio_id", socioId)
        .order("fecha_fin", { ascending: false })
        .order("creado_en", { ascending: false }),
    );
    return filas.map(aSuscripcion);
  }

  async listarUltimaDeCadaSocio(): Promise<Suscripcion[]> {
    const filas = verificar<FilaSuscripcion[]>(await this.db.from("ultima_suscripcion_por_socio").select("*"));
    return filas.map(aSuscripcion);
  }

  async obtenerUltimaDeSocio(socioId: string): Promise<Suscripcion | null> {
    const fila = verificar<FilaSuscripcion | null>(
      await this.db.from("ultima_suscripcion_por_socio").select("*").eq("socio_id", socioId).maybeSingle(),
    );
    return fila ? aSuscripcion(fila) : null;
  }

  async listarAvisosEnviados(suscripcionIds: string[]) {
    if (suscripcionIds.length === 0) return [];
    const filas = verificar<{ suscripcion_id: string; dias_antes: number }[]>(
      await this.db.from("avisos_enviados").select("suscripcion_id, dias_antes").in("suscripcion_id", suscripcionIds),
    );
    return filas.map((f) => ({ suscripcionId: f.suscripcion_id, diasAntes: f.dias_antes }));
  }

  async registrarAvisoEnviado(suscripcionId: string, diasAntes: number, canal: string): Promise<void> {
    verificar(
      await this.db
        .from("avisos_enviados")
        .upsert({ suscripcion_id: suscripcionId, dias_antes: diasAntes, canal }, { onConflict: "suscripcion_id,dias_antes" }),
    );
  }
}
