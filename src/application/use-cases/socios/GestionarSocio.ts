import { type DatosNuevoSocio, type Socio, validarMotivoBaja, validarNuevoSocio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export class EditarSocio {
  constructor(private readonly socios: SocioRepository) {}

  async ejecutar(socioId: string, datos: DatosNuevoSocio): Promise<Socio> {
    const validos = validarNuevoSocio(datos);
    if (!(await this.socios.obtenerPorId(socioId))) throw new NoEncontrado("El socio");
    return this.socios.actualizar(socioId, validos);
  }
}

/**
 * Da de baja a un socio. No se borra nada: su historial de pagos y
 * membresías se conserva, deja de contar como activo y ya no recibe avisos.
 */
export class DarDeBajaSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string, motivo: string, detalle: string | null): Promise<void> {
    const motivoFinal = validarMotivoBaja(motivo, detalle);
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");
    if (!socio.activo) throw new ErrorDeDominio("Este socio ya estaba dado de baja.");
    await this.socios.darDeBaja(socioId, this.reloj.hoy(), motivoFinal);
  }
}

export class ReactivarSocio {
  constructor(private readonly socios: SocioRepository) {}

  async ejecutar(socioId: string): Promise<void> {
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");
    if (socio.activo) return;
    await this.socios.reactivar(socioId);
  }
}
