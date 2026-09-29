import { nombreCompleto } from "@/domain/entities/Socio";
import { DIAS_DE_AVISO, type EtapaDeAviso, etapaDeAviso } from "@/domain/entities/Suscripcion";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { diasEntre } from "@/domain/shared/fechas";

export interface AvisoPendiente {
  suscripcionId: string;
  socioId: string;
  nombre: string;
  telefono: string;
  planNombre: string;
  fechaFin: string;
  diasRestantes: number;
  etapa: EtapaDeAviso;
}

/**
 * Lista de recordatorios por WhatsApp que toca mandar hoy.
 *
 * - Solo cuenta la última membresía de cada socio: si ya renovó, no aparece.
 * - Un aviso ya mandado no vuelve a salir; el de la siguiente etapa sí.
 * - Los socios dados de baja no reciben avisos.
 */
export class ObtenerAvisosPendientes {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<AvisoPendiente[]> {
    const hoy = this.reloj.hoy();
    const [socios, ultimas] = await Promise.all([this.socios.listar(), this.suscripciones.listarUltimaDeCadaSocio()]);
    const activos = new Map(socios.filter((s) => s.activo && s.telefono).map((s) => [s.id, s]));

    const candidatos = ultimas.flatMap((suscripcion) => {
      const socio = activos.get(suscripcion.socioId);
      const diasRestantes = diasEntre(hoy, suscripcion.fechaFin);
      const etapa = etapaDeAviso(diasRestantes);
      if (!socio?.telefono || etapa === null) return [];
      return [
        {
          suscripcionId: suscripcion.id,
          socioId: socio.id,
          nombre: nombreCompleto(socio),
          telefono: socio.telefono,
          planNombre: suscripcion.planNombre,
          fechaFin: suscripcion.fechaFin,
          diasRestantes,
          etapa,
        },
      ];
    });
    if (candidatos.length === 0) return [];

    const enviados = await this.suscripciones.listarAvisosEnviados(candidatos.map((c) => c.suscripcionId));
    // Si ya se mandó el de esta etapa (o uno más cercano al vencimiento), no se repite.
    const yaAvisado = (c: AvisoPendiente) =>
      enviados.some((e) => e.suscripcionId === c.suscripcionId && e.diasAntes <= c.etapa);

    return candidatos.filter((c) => !yaAvisado(c)).sort((a, b) => a.diasRestantes - b.diasRestantes);
  }
}

/** Se llama al abrir WhatsApp con el mensaje: el aviso deja de aparecer como pendiente. */
export class MarcarAvisoEnviado {
  constructor(private readonly suscripciones: SuscripcionRepository) {}

  async ejecutar(suscripcionId: string, etapa: number): Promise<void> {
    if (!(DIAS_DE_AVISO as readonly number[]).includes(etapa)) throw new ErrorDeDominio("Etapa de aviso no válida.");
    await this.suscripciones.registrarAvisoEnviado(suscripcionId, etapa, "whatsapp");
  }
}
