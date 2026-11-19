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
  /** Socios (activos o de baja) con ese celular de 10 dígitos. */
  buscarPorCelular(celular: string): Promise<Socio[]>;
  /** Borra un registro recién creado que aún no tiene pagos, membresías ni entradas. */
  eliminarSinHistorial(id: string): Promise<void>;
  /**
   * Borrado definitivo. Sin pagos, se borra todo. Con pagos, quedan solo como
   * "Socio eliminado" (sin nombre, celular, foto, notas ni huellas) para que
   * los cortes de esos días sigan cuadrando.
   */
  eliminarDefinitivo(id: string): Promise<"completo" | "anonimo">;
  /**
   * Une un socio registrado dos veces: membresías, pagos, entradas y huellas
   * del duplicado pasan al que se conserva, y el duplicado se borra. Devuelve
   * la foto que sobra (si las dos tenían) para borrar el archivo.
   */
  unir(conservarId: string, duplicadoId: string): Promise<{ fotoSobrante: string | null }>;
}
