import { type DatosNuevoSocio, type Socio, validarNuevoSocio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";

export class RegistrarSocio {
  constructor(private readonly socios: SocioRepository) {}

  async ejecutar(datos: DatosNuevoSocio): Promise<Socio> {
    return this.socios.crear(validarNuevoSocio(datos));
  }
}
