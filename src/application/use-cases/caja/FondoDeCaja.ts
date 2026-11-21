import { type FondoDeCaja, validarFondo } from "@/domain/entities/FondoDeCaja";
import type { FondoDeCajaRepository } from "@/domain/repositories/FondoDeCajaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { SinPermiso } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";

/*
 * Fondo de caja: con cuánto cambio empieza la caja cada día. Lo anota
 * recepción al abrir; se suma al efectivo cobrado para saber cuánto debe
 * haber en el cajón al cerrar.
 */

export interface SituacionDelFondo {
  /** El fondo anotado ese día (null si todavía no se anota). */
  monto: number | null;
  /** Para proponerlo si aún no se anota: el del último día que se anotó. */
  sugerido: number | null;
}

export class ObtenerFondoDeCaja {
  constructor(
    private readonly fondos: FondoDeCajaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(fecha?: FechaISO): Promise<SituacionDelFondo> {
    const dia = fecha ?? this.reloj.hoy();
    const [delDia, anterior] = await Promise.all([this.fondos.delDia(dia), this.fondos.ultimoAntesDe(dia)]);
    return { monto: delDia?.monto ?? null, sugerido: anterior?.monto ?? null };
  }
}

/**
 * Anota (o corrige) el fondo de HOY. Los días pasados no se cambian: su corte ya se cerró.
 * Anotarlo al abrir lo hace cualquiera; CORREGIRLO una vez anotado pide el permiso de
 * corregir cobros: con esa cifra se cuadra la caja, y bajarla taparía un faltante.
 */
export class GuardarFondoDeCaja {
  constructor(
    private readonly fondos: FondoDeCajaRepository,
    private readonly reloj: Reloj,
    private readonly puedeCorregir = true,
  ) {}

  async ejecutar(monto: number): Promise<FondoDeCaja> {
    const hoy = this.reloj.hoy();
    const valido = validarFondo(monto);
    const anotado = await this.fondos.delDia(hoy);
    if (anotado && anotado.monto === valido) return anotado;
    if (anotado && !this.puedeCorregir) throw new SinPermiso("corregir el fondo de caja ya anotado");
    return this.fondos.guardar(hoy, valido);
  }
}
