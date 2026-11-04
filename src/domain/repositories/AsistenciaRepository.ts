import type { Asistencia, DatosNuevaAsistencia } from "../entities/Asistencia";
import type { FechaISO } from "../shared/fechas";

export interface AsistenciaRepository {
  registrar(datos: DatosNuevaAsistencia): Promise<Asistencia>;
  obtenerPorId(id: string): Promise<Asistencia | null>;
  /** Entradas entre dos días (inclusive), de la más reciente a la más antigua. */
  listarEntre(desde: FechaISO, hasta: FechaISO): Promise<Asistencia[]>;
  ultimaDeSocio(socioId: string): Promise<Asistencia | null>;
  /** Días distintos (sin repetir) en que un socio vino, entre dos fechas. */
  diasDeSocio(socioId: string, desde: FechaISO, hasta: FechaISO): Promise<FechaISO[]>;
  /** Días distintos en que vino cada socio, entre dos fechas. */
  diasPorSocio(desde: FechaISO, hasta: FechaISO): Promise<Map<string, FechaISO[]>>;
  eliminar(id: string): Promise<void>;
}
