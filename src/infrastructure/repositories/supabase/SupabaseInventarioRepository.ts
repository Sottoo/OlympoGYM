import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevoMovimiento, MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { FilaMovimiento } from "../../supabase/tipos";
import { aMovimiento, verificar } from "./mapeos";

export class SupabaseInventarioRepository implements InventarioRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** La función SQL actualiza el stock y guarda el movimiento en una sola transacción. */
  async registrarMovimiento(datos: DatosNuevoMovimiento): Promise<MovimientoInventario> {
    const fila = verificar<FilaMovimiento>(
      await this.db
        .rpc("registrar_movimiento_inventario", {
          p_producto_id: datos.productoId,
          p_tipo: datos.tipo,
          p_cantidad: datos.cantidad,
          p_nota: datos.nota,
          p_fecha: datos.fecha,
        })
        .single(),
    );
    return aMovimiento(fila);
  }

  async listarPorProducto(productoId: string, limite = 50): Promise<MovimientoInventario[]> {
    const filas = verificar<FilaMovimiento[]>(
      await this.db
        .from("movimientos_inventario")
        .select("*")
        .eq("producto_id", productoId)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .limit(limite),
    );
    return filas.map(aMovimiento);
  }
}
