import { contarRacha } from "@/domain/entities/Asistencia";
import { nombreCompleto } from "@/domain/entities/Socio";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { type FechaISO, primerDiaDelMes, sumarDias } from "@/domain/shared/fechas";

/*
 * Sellos y rachas: cada día que un socio viene es un "sello" en su pasaporte
 * del mes. La racha son los días seguidos que lleva viniendo. Todo sale de
 * las asistencias que ya se registran; no hay datos nuevos que capturar.
 */

/** Hasta cuántos días atrás se miran las asistencias para calcular una racha. */
const DIAS_PARA_RACHA = 90;

export interface SellosDelMes {
  /** Primer día del mes que se muestra. */
  mes: FechaISO;
  /** Días del mes (1–31) en que vino. */
  dias: number[];
  /** Días seguidos que lleva viniendo. */
  racha: number;
}

export class ObtenerSellosDeSocio {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string, mes?: FechaISO): Promise<SellosDelMes> {
    const hoy = this.reloj.hoy();
    const inicio = primerDiaDelMes(mes ?? hoy);
    const desde = inicio < sumarDias(hoy, -DIAS_PARA_RACHA) ? inicio : sumarDias(hoy, -DIAS_PARA_RACHA);
    const dias = await this.asistencias.diasDeSocio(socioId, desde, hoy);
    return {
      mes: inicio,
      dias: dias.filter((d) => d.startsWith(inicio.slice(0, 7))).map((d) => Number(d.slice(8, 10))),
      racha: contarRacha(dias, hoy),
    };
  }
}

export interface Racha {
  socioId: string;
  nombre: string;
  plan?: string;
  dias: number;
}

/** Los socios con la racha viva más larga. */
export class ObtenerRachas {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(limite = 3, minimo = 2): Promise<Racha[]> {
    const hoy = this.reloj.hoy();
    const [porSocio, socios] = await Promise.all([this.asistencias.diasPorSocio(sumarDias(hoy, -DIAS_PARA_RACHA), hoy), this.socios.listar()]);
    const porId = new Map(socios.map((s) => [s.id, s]));
    return [...porSocio.entries()]
      .map(([socioId, dias]) => ({ socioId, dias: contarRacha(dias, hoy), socio: porId.get(socioId) }))
      .filter((r) => r.socio?.activo && r.dias >= minimo)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, limite)
      .map((r) => ({ socioId: r.socioId, nombre: nombreCompleto(r.socio!), dias: r.dias }));
  }
}
