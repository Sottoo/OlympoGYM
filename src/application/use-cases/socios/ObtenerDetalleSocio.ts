import type { Pago } from "@/domain/entities/Pago";
import type { Socio } from "@/domain/entities/Socio";
import { type SituacionMembresia, type Suscripcion, situacionDeMembresia } from "@/domain/entities/Suscripcion";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export interface DetalleSocio {
  socio: Socio;
  membresia: SituacionMembresia;
  planActual: string | null;
  suscripciones: Suscripcion[];
  pagos: Pago[];
}

export class ObtenerDetalleSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly pagos: PagoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string): Promise<DetalleSocio> {
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");

    const [suscripciones, pagos] = await Promise.all([
      this.suscripciones.listarPorSocio(socioId),
      this.pagos.listarPorSocio(socioId),
    ]);
    const ultima = suscripciones[0] ?? null; // vienen ordenadas por fecha de fin, de la más reciente

    return {
      socio,
      membresia: situacionDeMembresia(ultima, this.reloj.hoy()),
      planActual: ultima?.planNombre ?? null,
      suscripciones,
      pagos,
    };
  }
}
