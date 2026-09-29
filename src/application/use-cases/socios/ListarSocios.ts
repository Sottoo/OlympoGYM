import type { Socio } from "@/domain/entities/Socio";
import { type SituacionMembresia, situacionDeMembresia } from "@/domain/entities/Suscripcion";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { Reloj } from "@/domain/services/Reloj";

export interface SocioConMembresia {
  socio: Socio;
  membresia: SituacionMembresia;
  planNombre: string | null;
}

/** "activos" incluye a todos los que no se han dado de baja, sin importar su membresía. */
export const FILTROS_SOCIOS = ["activos", "vigente", "por_vencer", "vencida", "sin_plan", "bajas", "todos"] as const;
export type FiltroSocios = (typeof FILTROS_SOCIOS)[number];

export interface ListadoSocios {
  socios: SocioConMembresia[];
  conteos: Record<FiltroSocios, number>;
}

export class ListarSocios {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(opciones: { busqueda?: string; filtro?: FiltroSocios } = {}): Promise<ListadoSocios> {
    const filtro = opciones.filtro ?? "activos";
    const [socios, ultimas] = await Promise.all([
      this.socios.listar({ busqueda: opciones.busqueda }),
      this.suscripciones.listarUltimaDeCadaSocio(),
    ]);
    const porSocio = new Map(ultimas.map((s) => [s.socioId, s]));
    const hoy = this.reloj.hoy();

    const todos = socios.map((socio) => {
      const ultima = porSocio.get(socio.id) ?? null;
      return { socio, membresia: situacionDeMembresia(ultima, hoy), planNombre: ultima?.planNombre ?? null };
    });

    const conteos = Object.fromEntries(FILTROS_SOCIOS.map((f) => [f, 0])) as Record<FiltroSocios, number>;
    for (const fila of todos) {
      for (const f of FILTROS_SOCIOS) if (cumple(fila, f)) conteos[f]++;
    }

    return { socios: todos.filter((fila) => cumple(fila, filtro)), conteos };
  }
}

function cumple({ socio, membresia }: SocioConMembresia, filtro: FiltroSocios): boolean {
  switch (filtro) {
    case "todos":
      return true;
    case "bajas":
      return !socio.activo;
    case "activos":
      return socio.activo;
    default:
      return socio.activo && membresia.estado === filtro;
  }
}
