import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosNuevoSocio, Socio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { FechaISO } from "@/domain/shared/fechas";
import type { FilaSocio } from "../../supabase/tipos";
import { aSocio, verificar } from "./mapeos";

export class SupabaseSocioRepository implements SocioRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(filtro?: { busqueda?: string }): Promise<Socio[]> {
    let consulta = this.db.from("socios").select("*").order("nombre");
    const texto = filtro?.busqueda?.trim().replace(/[%,()]/g, "");
    if (texto) {
      consulta = consulta.or(`nombre.ilike.%${texto}%,apellidos.ilike.%${texto}%,telefono.ilike.%${texto}%`);
    }
    return verificar<FilaSocio[]>(await consulta).map(aSocio);
  }

  async obtenerPorId(id: string): Promise<Socio | null> {
    const fila = verificar<FilaSocio | null>(await this.db.from("socios").select("*").eq("id", id).maybeSingle());
    return fila ? aSocio(fila) : null;
  }

  async crear(datos: DatosNuevoSocio): Promise<Socio> {
    const fila = verificar<FilaSocio>(await this.db.from("socios").insert(aFila(datos)).select().single());
    return aSocio(fila);
  }

  async actualizar(id: string, datos: DatosNuevoSocio): Promise<Socio> {
    const fila = verificar<FilaSocio>(await this.db.from("socios").update(aFila(datos)).eq("id", id).select().single());
    return aSocio(fila);
  }

  async darDeBaja(id: string, fecha: FechaISO, motivo: string): Promise<void> {
    verificar(await this.db.from("socios").update({ activo: false, fecha_baja: fecha, motivo_baja: motivo }).eq("id", id));
  }

  async reactivar(id: string): Promise<void> {
    verificar(await this.db.from("socios").update({ activo: true, fecha_baja: null, motivo_baja: null }).eq("id", id));
  }

  async cambiarFoto(id: string, ruta: string | null): Promise<void> {
    verificar(await this.db.from("socios").update({ foto: ruta }).eq("id", id));
  }
}

const aFila = (d: DatosNuevoSocio) => ({
  nombre: d.nombre,
  apellidos: d.apellidos,
  telefono: d.telefono,
  fecha_nacimiento: d.fechaNacimiento,
  notas: d.notas,
});
