import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevaVenta, Venta } from "@/domain/entities/Venta";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { FechaISO } from "@/domain/shared/fechas";
import type { FilaVenta } from "../../supabase/tipos";
import { aVenta, verificar } from "./mapeos";

const CON_PARTIDAS = "*, movimientos_inventario(producto_id, cantidad, precio_unitario, productos(nombre))";

export class SupabaseVentaRepository implements VentaRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** La función SQL descuenta stock y guarda la venta en una sola transacción. */
  async registrar(datos: DatosNuevaVenta): Promise<Venta> {
    const ventaId = verificar<string>(
      await this.db.rpc("registrar_venta", {
        p_fecha: datos.fecha,
        p_metodo: datos.metodo,
        p_nota: datos.nota,
        p_partidas: datos.partidas.map((p) => ({ producto_id: p.productoId, cantidad: p.cantidad })),
      }),
    );
    const fila = verificar<FilaVenta>(await this.db.from("ventas").select(CON_PARTIDAS).eq("id", ventaId).single());
    return aVenta(fila);
  }

  async listarEntre(desde: FechaISO, hasta: FechaISO): Promise<Venta[]> {
    const filas = verificar<FilaVenta[]>(
      await this.db
        .from("ventas")
        .select(CON_PARTIDAS)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false }),
    );
    return filas.map(aVenta);
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO): Promise<number> {
    const filas = verificar<Pick<FilaVenta, "total">[]>(
      await this.db.from("ventas").select("total").gte("fecha", desde).lte("fecha", hasta),
    );
    return filas.reduce((total, f) => total + Number(f.total), 0);
  }
}
