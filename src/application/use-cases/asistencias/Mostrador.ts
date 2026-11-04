import {
  type Asistencia,
  contarRacha,
  MINUTOS_ENTRE_ENTRADAS,
  MINUTOS_PARA_DESHACER,
  minutosDesde,
} from "@/domain/entities/Asistencia";
import { cumpleAniosEn, nombreCompleto, type Socio } from "@/domain/entities/Socio";
import { type SituacionMembresia, situacionDeMembresia, suscripcionVigenteOUltima } from "@/domain/entities/Suscripcion";
import { esPlanDeVisita } from "@/domain/entities/Plan";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { MetodoPago } from "@/domain/entities/Pago";
import type { AsignarPlan } from "../suscripciones/AsignarPlan";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

/*
 * El mostrador es el proceso central de recepción:
 *   1. Identificar al socio (nombre, celular, número o credencial escaneada).
 *   2. Verificar si puede pasar (membresía vigente, no dado de baja).
 *   3. Registrar la entrada — o, si no tiene membresía, renovarla o cobrarle
 *      la visita del día. Nadie pasa sin pagar.
 *   4. Deshacer, solo por unos minutos, si se registró por error.
 */

/** Qué decide recepción al ver al socio. */
export type Veredicto =
  | { tipo: "puede_pasar" }
  | { tipo: "ya_entro"; hace: number; registradaEn: string }
  | { tipo: "sin_membresia" }
  | { tipo: "baja" };

export interface FichaDeEntrada {
  socio: Socio;
  nombre: string;
  membresia: SituacionMembresia;
  planNombre: string | null;
  fotoUrl: string | null;
  ultimaEntrada: string | null;
  veredicto: Veredicto;
  /** Días del mes (1–31) en que vino: los sellos de su pasaporte. */
  sellosDelMes: number[];
  /** Días seguidos que lleva viniendo. */
  racha: number;
  /** Días distintos que ha venido desde que es socio (sin contar hoy si aún no entra). */
  visitas: number;
  /** Hoy es su cumpleaños. */
  cumpleHoy: boolean;
  /** El plan de un día con el que se le cobra la visita si no tiene membresía (null si no hay uno). */
  visita: PlanDeVisita | null;
}

export interface PlanDeVisita {
  planId: string;
  nombre: string;
  precio: number;
}

/** El plan con el que se cobra una visita suelta: el activo de 1 día más barato. */
export async function buscarPlanDeVisita(planes: PlanRepository): Promise<PlanDeVisita | null> {
  const deUnDia = (await planes.listar({ soloActivos: true })).filter((p) => p.activo && esPlanDeVisita(p)).sort((a, b) => a.precio - b.precio);
  return deUnDia[0] ? { planId: deUnDia[0].id, nombre: deUnDia[0].nombre, precio: deUnDia[0].precio } : null;
}

export interface Candidato {
  socioId: string;
  numero: number;
  nombre: string;
  telefono: string | null;
  membresia: SituacionMembresia;
  activo: boolean;
}

/** Busca al socio mientras recepción escribe. Un número exacto (credencial) va primero. */
export class BuscarSocioEnMostrador {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(texto: string): Promise<Candidato[]> {
    const buscado = texto.trim();
    if (buscado.length < 2 && !/^\d+$/.test(buscado)) return [];

    const [encontrados, ultimas] = await Promise.all([
      this.socios.listar({ busqueda: buscado }),
      this.suscripciones.listarUltimaDeCadaSocio(),
    ]);
    const porSocio = new Map(ultimas.map((s) => [s.socioId, s]));
    const hoy = this.reloj.hoy();
    const numero = /^\d+$/.test(buscado) ? Number(buscado) : null;

    return encontrados
      .map((socio) => ({
        socioId: socio.id,
        numero: socio.numero,
        nombre: nombreCompleto(socio),
        telefono: socio.telefono,
        membresia: situacionDeMembresia(porSocio.get(socio.id) ?? null, hoy),
        activo: socio.activo,
      }))
      .sort((a, b) => Number(b.numero === numero) - Number(a.numero === numero) || Number(b.activo) - Number(a.activo))
      .slice(0, 8);
  }
}

/** Todo lo que recepción necesita ver para decidir si el socio pasa. */
export class ConsultarFichaDeEntrada {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly asistencias: AsistenciaRepository,
    private readonly fotos: AlmacenFotos,
    private readonly planes: PlanRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string): Promise<FichaDeEntrada> {
    const socio = await this.socios.obtenerPorId(socioId);
    if (!socio) throw new NoEncontrado("El socio");

    const hoy = this.reloj.hoy();
    const [suscripciones, ultimaEntrada, fotoUrl, dias, visita] = await Promise.all([
      this.suscripciones.listarPorSocio(socioId),
      this.asistencias.ultimaDeSocio(socioId),
      socio.foto ? this.fotos.urlTemporal(socio.foto) : null,
      this.asistencias.diasDeSocio(socioId, "2000-01-01", hoy),
      buscarPlanDeVisita(this.planes),
    ]);
    const ultima = suscripcionVigenteOUltima(suscripciones, hoy);
    const membresia = situacionDeMembresia(ultima, hoy);
    const mes = hoy.slice(0, 7);

    return {
      socio,
      nombre: nombreCompleto(socio),
      membresia,
      planNombre: ultima?.planNombre ?? null,
      fotoUrl,
      ultimaEntrada: ultimaEntrada?.registradaEn ?? null,
      veredicto: decidir(socio, membresia, ultimaEntrada, this.reloj.ahora()),
      sellosDelMes: dias.filter((d) => d.startsWith(mes)).map((d) => Number(d.slice(8, 10))),
      racha: contarRacha(dias, hoy),
      visitas: dias.length,
      cumpleHoy: socio.fechaNacimiento ? cumpleAniosEn(socio.fechaNacimiento, hoy) : false,
      visita,
    };
  }
}

function decidir(socio: Socio, membresia: SituacionMembresia, ultima: Asistencia | null, ahora: string): Veredicto {
  if (!socio.activo) return { tipo: "baja" };
  if (ultima) {
    const hace = minutosDesde(ultima.registradaEn, ahora);
    if (hace < MINUTOS_ENTRE_ENTRADAS) return { tipo: "ya_entro", hace: Math.round(hace), registradaEn: ultima.registradaEn };
  }
  if (membresia.estado === "vigente" || membresia.estado === "por_vencer") return { tipo: "puede_pasar" };
  return { tipo: "sin_membresia" };
}

/**
 * Registra la entrada de un socio con membresía vigente. Sin membresía no
 * pasa: se cobra la visita del día (CobrarVisita) o se renueva.
 */
export class RegistrarEntrada {
  constructor(
    private readonly consultar: ConsultarFichaDeEntrada,
    private readonly asistencias: AsistenciaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(socioId: string): Promise<Asistencia> {
    const { veredicto, nombre } = await this.consultar.ejecutar(socioId);

    switch (veredicto.tipo) {
      case "baja":
        throw new ErrorDeDominio(`${nombre} está dado de baja. La administración puede reactivarlo desde su ficha.`);
      case "ya_entro":
        throw new ErrorDeDominio(`La entrada de ${nombre} ya se registró ${veredicto.hace < 1 ? "hace un momento" : `hace ${veredicto.hace} min`}.`);
      case "sin_membresia":
        // Nadie pasa sin pagar: se cobra la visita del día o se renueva la membresía.
        throw new ErrorDeDominio(`${nombre} no tiene membresía vigente. Cobra la visita del día o renueva su membresía.`);
      case "puede_pasar":
        return this.asistencias.registrar({ socioId, fecha: this.reloj.hoy(), excepcion: null });
    }
  }
}

/**
 * Socio sin membresía vigente que quiere entrenar hoy: se le cobra la visita
 * (el plan de un día) y se registra su entrada, todo en un solo paso.
 */
export class CobrarVisita {
  constructor(
    private readonly consultar: ConsultarFichaDeEntrada,
    private readonly asignarPlan: AsignarPlan,
    private readonly registrarEntrada: RegistrarEntrada,
    private readonly suscripciones: SuscripcionRepository,
  ) {}

  async ejecutar(socioId: string, metodoPago: MetodoPago): Promise<{ asistencia: Asistencia; visita: PlanDeVisita; suscripcionId: string }> {
    const { veredicto, nombre, visita } = await this.consultar.ejecutar(socioId);
    if (veredicto.tipo !== "sin_membresia") throw new ErrorDeDominio(`${nombre} no necesita pagar visita: ${veredicto.tipo === "puede_pasar" ? "su membresía está vigente" : "revisa su ficha"}.`);
    if (!visita) throw new ErrorDeDominio("No hay un plan de visita (1 día). La administración puede crearlo en Planes.");
    const suscripcion = await this.asignarPlan.ejecutar({ socioId, planId: visita.planId, metodoPago });
    try {
      return { asistencia: await this.registrarEntrada.ejecutar(socioId), visita, suscripcionId: suscripcion.id };
    } catch (error) {
      // Si la entrada no se pudo registrar, no se queda cobrada la visita.
      await this.suscripciones.anularConSuPago(suscripcion.id);
      throw error;
    }
  }
}

/**
 * Corrige una entrada registrada por error, solo durante los primeros minutos.
 * Si con ella se cobró una visita, la visita y su pago se anulan también
 * (solo una visita de hoy del mismo socio: no sirve para borrar otros cobros).
 */
export class DeshacerEntrada {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly planes: PlanRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(asistenciaId: string, visitaId?: string): Promise<void> {
    const asistencia = await this.asistencias.obtenerPorId(asistenciaId);
    if (!asistencia) throw new NoEncontrado("La entrada");
    if (minutosDesde(asistencia.registradaEn, this.reloj.ahora()) > MINUTOS_PARA_DESHACER) {
      throw new ErrorDeDominio(`Solo se puede deshacer una entrada durante los primeros ${MINUTOS_PARA_DESHACER} minutos.`);
    }
    if (visitaId) {
      const visita = await this.suscripciones.obtenerPorId(visitaId);
      const plan = visita && (await this.planes.obtenerPorId(visita.planId));
      const esVisitaDeHoy = visita && plan && visita.socioId === asistencia.socioId && visita.fechaInicio === this.reloj.hoy() && esPlanDeVisita(plan);
      if (!esVisitaDeHoy) throw new ErrorDeDominio("Ese cobro no es la visita de hoy de este socio.");
      // La entrada, la visita y su pago se borran en una sola operación.
      return this.suscripciones.anularConSuPago(visitaId, asistenciaId);
    }
    await this.asistencias.eliminar(asistenciaId);
  }
}
