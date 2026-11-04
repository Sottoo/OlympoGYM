import type { Pago } from "@/domain/entities/Pago";
import { cumpleAniosEn, edadEn, type Socio } from "@/domain/entities/Socio";
import { type SituacionMembresia, type Suscripcion, situacionDeMembresia, suscripcionVigenteOUltima } from "@/domain/entities/Suscripcion";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import type { Reloj } from "@/domain/services/Reloj";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export interface DetalleSocio {
  socio: Socio;
  /** Enlace temporal para mostrar la foto (null = sin foto). */
  fotoUrl: string | null;
  /** Años cumplidos, si se registró su fecha de nacimiento. */
  edad: number | null;
  cumpleHoy: boolean;
  membresia: SituacionMembresia;
  planActual: string | null;
  /** Hoy solo pagó la visita del día (no tiene membresía). */
  deVisita: boolean;
  suscripciones: Suscripcion[];
  pagos: Pago[];
}

export class ObtenerDetalleSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly pagos: PagoRepository,
    private readonly fotos: AlmacenFotos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string): Promise<DetalleSocio> {
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");

    const [suscripciones, pagos, fotoUrl] = await Promise.all([
      this.suscripciones.listarPorSocio(socioId),
      this.pagos.listarPorSocio(socioId),
      socio.foto ? this.fotos.urlTemporal(socio.foto) : null,
    ]);
    const hoy = this.reloj.hoy();
    const ultima = suscripcionVigenteOUltima(suscripciones, hoy); // vienen ordenadas por fecha de fin, de la más reciente

    return {
      socio,
      fotoUrl,
      edad: socio.fechaNacimiento ? edadEn(socio.fechaNacimiento, hoy) : null,
      cumpleHoy: socio.fechaNacimiento ? cumpleAniosEn(socio.fechaNacimiento, hoy) : false,
      membresia: situacionDeMembresia(ultima, hoy),
      planActual: ultima?.planNombre ?? null,
      deVisita: ultima?.esVisita ?? false,
      suscripciones,
      pagos,
    };
  }
}
