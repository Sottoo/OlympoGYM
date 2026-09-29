import type { DatosNuevoSocio, Socio } from "../entities/Socio";
import type { FechaISO } from "../shared/fechas";

/** Contrato de persistencia de socios. La infraestructura decide cómo se guarda. */
export interface SocioRepository {
  listar(filtro?: { busqueda?: string }): Promise<Socio[]>;
  obtenerPorId(id: string): Promise<Socio | null>;
  crear(datos: DatosNuevoSocio): Promise<Socio>;
  actualizar(id: string, datos: DatosNuevoSocio): Promise<Socio>;
  darDeBaja(id: string, fecha: FechaISO, motivo: string): Promise<void>;
  reactivar(id: string): Promise<void>;
  cambiarFoto(id: string, ruta: string | null): Promise<void>;
}
