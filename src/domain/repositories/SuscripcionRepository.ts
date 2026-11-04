import type { DatosNuevoPago } from "../entities/Pago";
import type { DatosNuevaSuscripcion, Suscripcion } from "../entities/Suscripcion";

export interface SuscripcionRepository {
  crear(datos: DatosNuevaSuscripcion): Promise<Suscripcion>;
  listarPorSocio(socioId: string): Promise<Suscripcion[]>;
  /**
   * La membresía con la fecha de fin más lejana de cada socio. No cuenta las
   * visitas de un día: no son membresías ni "vencen".
   */
  listarUltimaDeCadaSocio(): Promise<Suscripcion[]>;
  /** La última suscripción del socio, visitas incluidas (una visita pagada hoy lo deja pasar hoy). */
  obtenerUltimaDeSocio(socioId: string): Promise<Suscripcion | null>;
  obtenerPorId(id: string): Promise<Suscripcion | null>;
  /** Guarda la membresía y su pago juntos: o quedan los dos o ninguno. */
  crearConPago(datos: DatosNuevaSuscripcion, pago: Omit<DatosNuevoPago, "suscripcionId">): Promise<Suscripcion>;
  /** Anula una visita cobrada por error: borra la suscripción, su pago y (si se indica) la entrada, juntos. */
  anularConSuPago(id: string, asistenciaId?: string): Promise<void>;
}
