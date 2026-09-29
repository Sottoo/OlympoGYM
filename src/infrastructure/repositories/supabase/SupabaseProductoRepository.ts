import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosProducto, Producto } from "@/domain/entities/Producto";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { FilaProducto } from "../../supabase/tipos";
import { aProducto, verificar } from "./mapeos";

const aFila = (d: DatosProducto) => ({
  nombre: d.nombre,
  categoria: d.categoria,
  codigo: d.codigo,
  precio_venta: d.precioVenta,
  costo: d.costo,
  stock_minimo: d.stockMinimo,
});

export class SupabaseProductoRepository implements ProductoRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(filtro?: { busqueda?: string; soloActivos?: boolean }): Promise<Producto[]> {
    let consulta = this.db.from("productos").select("*").order("nombre");
    if (filtro?.soloActivos) consulta = consulta.eq("activo", true);
    const texto = filtro?.busqueda?.trim().replace(/[%,()]/g, "");
    if (texto) consulta = consulta.or(`nombre.ilike.%${texto}%,codigo.ilike.%${texto}%`);
    return verificar<FilaProducto[]>(await consulta).map(aProducto);
  }

  async obtenerPorId(id: string): Promise<Producto | null> {
    const fila = verificar<FilaProducto | null>(await this.db.from("productos").select("*").eq("id", id).maybeSingle());
    return fila ? aProducto(fila) : null;
  }

  async crear(datos: DatosProducto): Promise<Producto> {
    return aProducto(verificar<FilaProducto>(await this.db.from("productos").insert(aFila(datos)).select().single()));
  }

  async actualizar(id: string, datos: DatosProducto): Promise<Producto> {
    return aProducto(verificar<FilaProducto>(await this.db.from("productos").update(aFila(datos)).eq("id", id).select().single()));
  }

  async cambiarEstado(id: string, activo: boolean): Promise<void> {
    verificar(await this.db.from("productos").update({ activo }).eq("id", id));
  }
}
