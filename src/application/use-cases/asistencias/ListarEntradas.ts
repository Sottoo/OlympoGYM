import { nombreCompleto } from "@/domain/entities/Socio";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { type FechaISO, sumarDias } from "@/domain/shared/fechas";

export interface EntradaListada {
  id: string;
  socioId: string;
  numero: number;
  nombre: string;
  registradaEn: string;
  hora: number;
  excepcion: string | null;
}

export interface Entradas {
  entradas: EntradaListada[];
  /** Entradas por hora del día (índice 0–23). */
  porHora: number[];
  /** Socios distintos que vinieron en el periodo. */
  sociosDistintos: number;
  excepciones: number;
}

/** Entradas de un periodo, con el nombre del socio y su hora local. */
export class ListarEntradas {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(desde: FechaISO, hasta: FechaISO = desde): Promise<Entradas> {
    const [asistencias, socios] = await Promise.all([this.asistencias.listarEntre(desde, hasta), this.socios.listar()]);
    const porId = new Map(socios.map((s) => [s.id, s]));
    const porHora = Array.from({ length: 24 }, () => 0);

    const entradas = asistencias.map((a) => {
      const socio = porId.get(a.socioId);
      const { hora } = this.reloj.local(a.registradaEn);
      porHora[hora]++;
      return {
        id: a.id,
        socioId: a.socioId,
        numero: socio?.numero ?? 0,
        nombre: socio ? nombreCompleto(socio) : "Socio eliminado",
        registradaEn: a.registradaEn,
        hora,
        excepcion: a.excepcion,
      };
    });

    return {
      entradas,
      porHora,
      sociosDistintos: new Set(entradas.map((e) => e.socioId)).size,
      excepciones: entradas.filter((e) => e.excepcion).length,
    };
  }
}

export interface EntradasDeHoy extends Entradas {
  fecha: FechaISO;
  horaActual: number;
  /** Entradas del mismo día de la semana pasada, hasta esta misma hora. */
  semanaPasadaALaMismaHora: number;
}

/** Lo que el mostrador muestra del día: entradas, horas y comparación justa con la semana pasada. */
export class ObtenerEntradasDeHoy {
  constructor(
    private readonly listar: ListarEntradas,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<EntradasDeHoy> {
    const hoy = this.reloj.hoy();
    const { hora: horaActual } = this.reloj.local(this.reloj.ahora());
    const [deHoy, semanaPasada] = await Promise.all([this.listar.ejecutar(hoy), this.listar.ejecutar(sumarDias(hoy, -7))]);
    return {
      ...deHoy,
      fecha: hoy,
      horaActual,
      semanaPasadaALaMismaHora: semanaPasada.entradas.filter((e) => e.hora <= horaActual).length,
    };
  }
}
