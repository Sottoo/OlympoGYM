import { nombreCompleto } from "@/domain/entities/Socio";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { sumarDias } from "@/domain/shared/fechas";

export interface Habitual {
  socioId: string;
  numero: number;
  nombre: string;
  /** Hora local a la que suele llegar, ej. "18:30". */
  horaUsual: string;
  /** Cuántas de las últimas semanas vino este mismo día a esta hora. */
  veces: number;
}

/**
 * Quiénes suelen llegar por estas horas: socios activos que, en las últimas
 * cuatro semanas, vinieron al menos dos veces este mismo día de la semana
 * dentro de la hora y media alrededor de ahora, y que hoy todavía no entran.
 * Sirve para tener listo su parche antes de que pregunten.
 */
export class ObtenerHabituales {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly socios: SocioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(limite = 6): Promise<Habitual[]> {
    const hoy = this.reloj.hoy();
    const ahora = this.reloj.local(this.reloj.ahora());
    const minutosAhora = ahora.hora * 60 + minutosDe(this.reloj.ahora());
    const semanas = [7, 14, 21, 28].map((d) => sumarDias(hoy, -d));

    const [pasadas, deHoy, socios] = await Promise.all([
      this.asistencias.listarEntre(sumarDias(hoy, -28), sumarDias(hoy, -7)),
      this.asistencias.listarEntre(hoy, hoy),
      this.socios.listar(),
    ]);
    const yaVinieron = new Set(deHoy.map((a) => a.socioId));
    const activos = new Map(socios.filter((s) => s.activo).map((s) => [s.id, s]));

    const porSocio = new Map<string, number[]>();
    for (const a of pasadas) {
      if (!semanas.includes(a.fecha) || yaVinieron.has(a.socioId) || !activos.has(a.socioId)) continue;
      const { hora } = this.reloj.local(a.registradaEn);
      const minutos = hora * 60 + minutosDe(a.registradaEn);
      // Llega entre media hora antes y una hora después de ahora.
      if (minutos < minutosAhora - 30 || minutos > minutosAhora + 60) continue;
      porSocio.set(a.socioId, [...(porSocio.get(a.socioId) ?? []), minutos]);
    }

    return [...porSocio.entries()]
      .filter(([, veces]) => veces.length >= 2)
      .map(([socioId, veces]) => {
        const socio = activos.get(socioId)!;
        const promedio = Math.round(veces.reduce((t, m) => t + m, 0) / veces.length / 5) * 5;
        return {
          socioId,
          numero: socio.numero,
          nombre: nombreCompleto(socio),
          horaUsual: `${String(Math.floor(promedio / 60)).padStart(2, "0")}:${String(promedio % 60).padStart(2, "0")}`,
          veces: veces.length,
        };
      })
      .sort((a, b) => a.horaUsual.localeCompare(b.horaUsual) || b.veces - a.veces)
      .slice(0, limite);
  }
}

/** Minutos (0–59) de un instante. Las zonas de México tienen desfase en horas completas. */
const minutosDe = (instante: string) => new Date(instante).getUTCMinutes();
