import {
  type DatosNuevoSocio,
  type Socio,
  TAMANO_MAXIMO_FOTO,
  TIPOS_FOTO,
  validarMotivoBaja,
  validarNuevoSocio,
} from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

export class EditarSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string, datos: DatosNuevoSocio): Promise<Socio> {
    const validos = validarNuevoSocio(datos, this.reloj.hoy());
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

/** Pone o reemplaza la foto del socio. La anterior se borra para no ocupar espacio. */
export class CambiarFotoSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(socioId: string, imagen: Uint8Array, tipo: string): Promise<void> {
    if (!(TIPOS_FOTO as readonly string[]).includes(tipo)) throw new ErrorDeDominio("La foto debe ser una imagen JPG, PNG o WebP.");
    if (imagen.byteLength > TAMANO_MAXIMO_FOTO) throw new ErrorDeDominio("La foto pesa demasiado; prueba con otra.");
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");
    const anterior = socio.foto; // se guarda antes: cambiarFoto puede modificar el mismo objeto

    const ruta = await this.fotos.guardar(socioId, imagen, tipo);
    await this.socios.cambiarFoto(socioId, ruta);
    if (anterior) await this.fotos.borrar(anterior).catch(() => undefined);
  }
}

export class QuitarFotoSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(socioId: string): Promise<void> {
    const anterior = (await this.socios.obtenerPorId(socioId))?.foto;
    if (!anterior) return;
    await this.socios.cambiarFoto(socioId, null);
    await this.fotos.borrar(anterior).catch(() => undefined);
  }
}
