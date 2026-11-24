import { type DatosNuevoSocio, type Socio, validarMotivoBaja, validarNuevoSocio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import { fechaDePago } from "@/domain/entities/Suscripcion";
import { formatearFecha } from "@/shared/formato";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { revisarFoto } from "@/domain/shared/imagen";
import { asegurarCelularLibre } from "./celular";

export class EditarSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string, datos: DatosNuevoSocio): Promise<Socio> {
    const validos = validarNuevoSocio(datos, this.reloj.hoy());
    if (!(await this.socios.obtenerPorId(socioId))) throw new NoEncontrado("El socio");
    await asegurarCelularLibre(this.socios, validos.telefono, socioId);
    return this.socios.actualizar(socioId, validos);
  }
}

/**
 * Da de baja a un socio. No se borra nada: su historial de pagos y
 * membresías se conserva y deja de contar como activo.
 *
 * No se puede mientras tenga una membresía vigente (o ya pagada para
 * después): la baja no congela los días, que siguen corriendo, así que darlo
 * de baja solo le quitaría lo que ya pagó. Se da de baja cuando venza.
 */
export class DarDeBajaSocio {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string, motivo: string, detalle: string | null): Promise<void> {
    const motivoFinal = validarMotivoBaja(motivo, detalle);
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");
    if (!socio.activo) throw new ErrorDeDominio("Este socio ya estaba dado de baja.");
    const vigente = (await this.suscripciones.listarPorSocio(socioId)).find((s) => !s.esVisita && s.fechaFin >= this.reloj.hoy());
    if (vigente) {
      throw new ErrorDeDominio(
        `${socio.nombre} tiene su membresía vigente (vence el ${formatearFecha(fechaDePago(vigente))}). Sus días siguen corriendo aunque no venga: se podrá dar de baja cuando venza.`,
      );
    }
    await this.socios.darDeBaja(socioId, this.reloj.hoy(), motivoFinal);
  }
}

/**
 * Borra a un socio para siempre. Si nunca pagó, desaparece por completo. Si
 * ya pagó, sus datos personales se borran (nombre, celular, foto, notas y
 * huellas) pero sus pagos se quedan en los cortes como «Socio eliminado»,
 * para que la caja de esos días siga cuadrando. No se puede deshacer.
 */
export class EliminarSocioDefinitivo {
  constructor(
    private readonly socios: SocioRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  async ejecutar(socioId: string, confirmacion: string): Promise<{ nombre: string; resultado: "completo" | "anonimo" }> {
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");
    // Se escribe la palabra ELIMINAR: así nadie lo borra por un clic accidental.
    if (confirmacion.trim().toUpperCase() !== "ELIMINAR") {
      throw new ErrorDeDominio("Para confirmar, escribe la palabra ELIMINAR.", "confirmacion");
    }
    const resultado = await this.socios.eliminarDefinitivo(socio.id);
    if (socio.foto) await this.fotos.borrar(socio.foto).catch(() => undefined);
    return { nombre: `${socio.nombre} ${socio.apellidos}`, resultado };
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
    revisarFoto(imagen, tipo);
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
