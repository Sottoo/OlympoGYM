import type { DatosNuevaSuscripcion, Suscripcion } from "../entities/Suscripcion";

export interface SuscripcionRepository {
  crear(datos: DatosNuevaSuscripcion): Promise<Suscripcion>;
  listarPorSocio(socioId: string): Promise<Suscripcion[]>;
  /** La suscripción con la fecha de fin más lejana de cada socio. */
  listarUltimaDeCadaSocio(): Promise<Suscripcion[]>;
  obtenerUltimaDeSocio(socioId: string): Promise<Suscripcion | null>;
  /** Para cada suscripción, las etapas de aviso (días antes) que ya se mandaron. */
  listarAvisosEnviados(suscripcionIds: string[]): Promise<{ suscripcionId: string; diasAntes: number }[]>;
  registrarAvisoEnviado(suscripcionId: string, diasAntes: number, canal: string): Promise<void>;
}
