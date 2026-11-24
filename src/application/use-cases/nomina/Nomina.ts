import {
  type DatosEmpleado,
  type DatosPagoNomina,
  describirSemana,
  type Empleado,
  lunesDe,
  type PagoNomina,
  SEMANAS_ATRAS_PARA_PAGAR,
  semanaQueTocaPagar,
  validarEmpleado,
  validarPagoNomina,
  viernesDe,
} from "@/domain/entities/Nomina";
import type { NominaRepository } from "@/domain/repositories/NominaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { type FechaISO, primerDiaDelMes, sumarDias } from "@/domain/shared/fechas";

const centavos = (x: number) => Math.round(x * 100) / 100;

/* ── Empleados ─────────────────────────────────────────────────────── */

export class ListarEmpleados {
  constructor(private readonly repo: NominaRepository) {}
  ejecutar(): Promise<Empleado[]> {
    return this.repo.listarEmpleados();
  }
}

export class GuardarEmpleado {
  constructor(private readonly repo: NominaRepository) {}

  /** Sin `id` lo da de alta; con `id` cambia sus datos. Dos empleados activos no pueden llamarse igual. */
  async ejecutar(datos: DatosEmpleado, id?: string): Promise<Empleado> {
    const validos = validarEmpleado(datos);
    const mismo = (await this.repo.listarEmpleados()).find(
      (e) => e.activo && e.id !== id && e.nombre.localeCompare(validos.nombre, "es", { sensitivity: "base" }) === 0,
    );
    if (mismo) throw new ErrorDeDominio(`Ya hay un empleado activo llamado «${mismo.nombre}».`, "nombre");
    if (!id) return this.repo.crearEmpleado(validos);
    if (!(await this.repo.obtenerEmpleado(id))) throw new NoEncontrado("El empleado");
    return this.repo.actualizarEmpleado(id, validos);
  }
}

/** Activar o desactivar (ya no trabaja ahí): sus pagos se conservan y deja de aparecer en el aviso. */
export class CambiarEstadoEmpleado {
  constructor(private readonly repo: NominaRepository) {}
  async ejecutar(id: string, activo: boolean): Promise<void> {
    if (!(await this.repo.obtenerEmpleado(id))) throw new NoEncontrado("El empleado");
    await this.repo.cambiarEstadoEmpleado(id, activo);
  }
}

/* ── Pagos ─────────────────────────────────────────────────────────── */

/**
 * Registra el pago de la semana de un empleado. Se paga hoy (entra en el
 * corte de hoy; en efectivo, sale de la caja de hoy). Un pago por empleado y
 * semana; no se pagan semanas que no han empezado.
 */
export class RegistrarPagoNomina {
  constructor(
    private readonly repo: NominaRepository,
    private readonly reloj: Pick<Reloj, "hoy">,
  ) {}

  async ejecutar(datos: DatosPagoNomina): Promise<PagoNomina> {
    const hoy = this.reloj.hoy();
    const validos = validarPagoNomina(datos, hoy);
    const empleado = await this.repo.obtenerEmpleado(validos.empleadoId);
    if (!empleado) throw new NoEncontrado("El empleado");
    if (!empleado.activo) throw new ErrorDeDominio(`${empleado.nombre} está desactivado. Actívalo para pagarle.`, "empleadoId");
    return this.repo.registrarPago({ ...validos, fecha: hoy });
  }
}

/**
 * Anula un pago registrado por error. Solo el mismo día: el corte de un día
 * pasado ya se contó y no cambia (igual que los cobros).
 */
export class AnularPagoNomina {
  constructor(
    private readonly repo: NominaRepository,
    private readonly reloj: Pick<Reloj, "hoy">,
  ) {}

  async ejecutar(id: string): Promise<PagoNomina> {
    const pago = await this.repo.obtenerPago(id);
    if (!pago) throw new NoEncontrado("El pago");
    if (pago.fecha !== this.reloj.hoy()) throw new ErrorDeDominio("Solo se anula el mismo día que se pagó: el corte de ese día ya se contó.");
    await this.repo.eliminarPago(id);
    return pago;
  }
}

/* ── Consulta y aviso ──────────────────────────────────────────────── */

export interface SemanaDeNomina {
  /** El lunes de la semana. */
  semana: FechaISO;
  texto: string;
  pagos: PagoNomina[];
  total: number;
}

export interface AvisoDeNomina {
  semana: FechaISO;
  texto: string;
  /** Empleados activos a los que aún no se les paga esa semana. */
  faltan: Empleado[];
  activos: number;
}

/**
 * El aviso de nómina: desde el viernes, la semana que termina; de lunes a
 * jueves, todavía la semana pasada si quedó alguien sin pagar. Solo cuentan
 * los empleados activos que ya trabajaban esa semana. Null si no falta nadie.
 */
export function avisoDeNomina(hoy: FechaISO, empleados: Empleado[], pagosDeLaSemana: PagoNomina[]): AvisoDeNomina | null {
  const semana = semanaQueTocaPagar(hoy);
  // Quien se dio de alta después del viernes de esa semana no la trabajó.
  const activos = empleados.filter((e) => e.activo && e.creadoEn.slice(0, 10) <= viernesDe(semana));
  const pagados = new Set(pagosDeLaSemana.filter((p) => p.semana === semana).map((p) => p.empleadoId));
  const faltan = activos.filter((e) => !pagados.has(e.id));
  return faltan.length > 0 ? { semana, texto: describirSemana(semana), faltan, activos: activos.length } : null;
}

export class ConsultarNomina {
  constructor(
    private readonly repo: NominaRepository,
    private readonly reloj: Pick<Reloj, "hoy">,
  ) {}

  async ejecutar(): Promise<{
    hoy: FechaISO;
    empleados: Empleado[];
    semanas: SemanaDeNomina[];
    /** Semanas que se pueden pagar (de la actual hacia atrás), con la que toca primero. */
    semanasParaPagar: { semana: FechaISO; texto: string }[];
    semanaSugerida: FechaISO;
    totalDelMes: number;
    aviso: AvisoDeNomina | null;
  }> {
    const hoy = this.reloj.hoy();
    const lunesActual = lunesDe(hoy);
    const desde = sumarDias(lunesActual, -7 * SEMANAS_ATRAS_PARA_PAGAR);
    const [empleados, pagos, delMes] = await Promise.all([
      this.repo.listarEmpleados(),
      this.repo.pagosDeSemanas(desde, lunesActual),
      this.repo.pagosHechosEntre(primerDiaDelMes(hoy), hoy),
    ]);
    const porSemana = new Map<FechaISO, PagoNomina[]>();
    for (const p of pagos) porSemana.set(p.semana, [...(porSemana.get(p.semana) ?? []), p]);
    const semanas = [...porSemana.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([semana, ps]) => ({ semana, texto: describirSemana(semana), pagos: ps, total: centavos(ps.reduce((t, p) => t + p.monto, 0)) }));
    const semanasParaPagar = Array.from({ length: SEMANAS_ATRAS_PARA_PAGAR + 1 }, (_, i) => sumarDias(lunesActual, -7 * i)).map((semana) => ({
      semana,
      texto: describirSemana(semana),
    }));
    return {
      hoy,
      empleados,
      semanas,
      semanasParaPagar,
      semanaSugerida: semanaQueTocaPagar(hoy),
      totalDelMes: centavos(delMes.reduce((t, p) => t + p.monto, 0)),
      aviso: avisoDeNomina(hoy, empleados, pagos),
    };
  }
}

/** Para la pantalla de inicio: solo el aviso (si falta pagarle a alguien la semana que toca). */
export class ObtenerAvisoDeNomina {
  constructor(
    private readonly repo: NominaRepository,
    private readonly reloj: Pick<Reloj, "hoy">,
  ) {}

  async ejecutar(): Promise<AvisoDeNomina | null> {
    const hoy = this.reloj.hoy();
    const semana = semanaQueTocaPagar(hoy);
    const [empleados, pagos] = await Promise.all([this.repo.listarEmpleados(), this.repo.pagosDeSemanas(semana, semana)]);
    return avisoDeNomina(hoy, empleados, pagos);
  }
}

/** Para el corte de caja: lo que se pagó de nómina ese día (el efectivo sale de la caja de ese día). */
export class ObtenerNominaDelDia {
  constructor(
    private readonly repo: NominaRepository,
    private readonly reloj: Pick<Reloj, "hoy">,
  ) {}

  async ejecutar(fecha?: FechaISO): Promise<{ pagos: PagoNomina[]; efectivo: number; transferencia: number }> {
    const dia = fecha ?? this.reloj.hoy();
    const pagos = await this.repo.pagosHechosEntre(dia, dia);
    const suma = (m: string) => centavos(pagos.filter((p) => p.metodo === m).reduce((t, p) => t + p.monto, 0));
    return { pagos, efectivo: suma("efectivo"), transferencia: suma("transferencia") };
  }
}
