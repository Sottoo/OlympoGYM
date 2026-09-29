import { type DatosNuevoSocio, type Socio, validarNuevoSocio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";

export class RegistrarSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosNuevoSocio): Promise<Socio> {
    return this.socios.crear(validarNuevoSocio(datos, this.reloj.hoy()));
  }
}
