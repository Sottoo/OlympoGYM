import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevoPago, Pago } from "@/domain/entities/Pago";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { FechaISO } from "@/domain/shared/fechas";
import type { FilaPago } from "../../supabase/tipos";
import { aPago, verificar } from "./mapeos";

export class SupabasePagoRepository implements PagoRepository {
  constructor(private readonly db: SupabaseClient) {}

  async crear(datos: DatosNuevoPago): Promise<Pago> {
    const fila = verificar<FilaPago>(
      await this.db
        .from("pagos")
        .insert({
          socio_id: datos.socioId,
          suscripcion_id: datos.suscripcionId,
          monto: datos.monto,
          metodo: datos.metodo,
          fecha: datos.fecha,
          nota: datos.nota,
        })
        .select()
        .single(),
    );
    return aPago(fila);
  }

  async listarPorSocio(socioId: string): Promise<Pago[]> {
    const filas = verificar<FilaPago[]>(
      await this.db.from("pagos").select("*").eq("socio_id", socioId).order("fecha", { ascending: false }),
    );
    return filas.map(aPago);
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number> {
    const filas = verificar<Pick<FilaPago, "monto">[]>(
      await this.db.from("pagos").select("monto").gte("fecha", desde).lte("fecha", hasta),
    );
    return filas.reduce((total, f) => total + Number(f.monto), 0);
  }
}
