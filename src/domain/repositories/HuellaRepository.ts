import type { Dedo, Huella, PlantillaDeSocio } from "../entities/Huella";

/** Contrato de persistencia de huellas. La infraestructura decide cómo se guarda. */
export interface HuellaRepository {
  listarDeSocio(socioId: string): Promise<Huella[]>;
  /** Todas las plantillas guardadas, para identificar a quien pone el dedo. */
  plantillas(): Promise<PlantillaDeSocio[]>;
  /** Guarda la huella de ese dedo; si el socio ya tenía ese dedo registrado, la reemplaza. */
  guardar(datos: { socioId: string; dedo: Dedo; plantilla: Uint8Array }): Promise<Huella>;
  obtenerPorId(id: string): Promise<Huella | null>;
  eliminar(id: string): Promise<void>;
}
