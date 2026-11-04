import {
  type Abono,
  type AbonoConDetalle,
  type DatosAbono,
  type DatosEquipo,
  type DatosMantenimiento,
  type DatosReporte,
  type Equipo,
  EQUIPOS_TIPICOS,
  type EstadoEquipo,
  estadoDeEquipo,
  type Mantenimiento,
  type PagoInicial,
  type Preventivo,
  proximoPreventivo,
  type ReporteFalla,
  saldoDe,
  validarAbono,
  validarEquipo,
  validarMantenimiento,
  validarReporte,
} from "@/domain/entities/Mantenimiento";
import type { MantenimientoRepository } from "@/domain/repositories/MantenimientoRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { type FechaISO, primerDiaDelMes, sumarDias, sumarMeses } from "@/domain/shared/fechas";
import { limpiarEspacios } from "@/domain/shared/reglas";
import { claveDeNombre } from "@/domain/shared/texto";

const centavos = (x: number) => Math.round(x * 100) / 100;

/* ── Tablero: cómo están las máquinas ───────────────────────────────── */

export interface EquipoEnTablero {
  equipo: Equipo;
  estado: EstadoEquipo;
  preventivo: Preventivo;
  ultimoServicio: FechaISO | null;
  reportes: ReporteFalla[];
}

export interface Tablero {
  hoy: FechaISO;
  equipos: EquipoEnTablero[];
  reportesAbiertos: ReporteFalla[];
  cuentas: { activos: number; funcionando: number; conFalla: number; fueraDeServicio: number; preventivosPorHacer: number; vencidos: number };
}

/**
 * El estado de cada máquina: si funciona, si tiene una falla reportada,
 * cuándo le toca preventivo y cuándo fue su último servicio. Lo ven todos
 * (sin costos): recepción lo usa para saber qué máquinas no se pueden usar.
 */
export class ObtenerTableroDeMantenimiento {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<Tablero> {
    const hoy = this.reloj.hoy();
    const [equipos, reportesAbiertos, preventivos, servicios] = await Promise.all([
      this.repo.listarEquipos(),
      this.repo.listarReportes({ abiertos: true }),
      this.repo.ultimosPreventivos(),
      this.repo.ultimosServicios(),
    ]);
    const lista = equipos.map((equipo): EquipoEnTablero => {
      const reportes = reportesAbiertos.filter((r) => r.equipoId === equipo.id);
      return {
        equipo,
        estado: estadoDeEquipo(equipo, reportes),
        preventivo: proximoPreventivo(equipo, preventivos.get(equipo.id) ?? null, this.reloj.local(equipo.creadoEn).fecha, hoy),
        ultimoServicio: servicios.get(equipo.id) ?? null,
        reportes,
      };
    });
    const activos = lista.filter((e) => e.equipo.activo);
    return {
      hoy,
      equipos: lista,
      reportesAbiertos: reportesAbiertos.filter((r) => activos.some((e) => e.equipo.id === r.equipoId)),
      cuentas: {
        activos: activos.length,
        funcionando: activos.filter((e) => e.estado === "funcionando").length,
        conFalla: activos.filter((e) => e.estado === "con_falla").length,
        fueraDeServicio: activos.filter((e) => e.estado === "fuera_de_servicio").length,
        preventivosPorHacer: activos.filter((e) => e.preventivo.estado === "vencido" || e.preventivo.estado === "pronto").length,
        vencidos: activos.filter((e) => e.preventivo.estado === "vencido").length,
      },
    };
  }
}

/* ── Dinero: lo gastado y lo que se debe (solo administración) ──────── */

export interface ResumenDeGastos {
  gastadoMes: number;
  gastadoMesPasado: number;
  porPagar: number;
  pendientes: number;
  /** Lo que ha costado cada equipo en los últimos 12 meses. */
  costoPorEquipo: Map<string, number>;
}

export class ObtenerResumenDeGastos {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<ResumenDeGastos> {
    const hoy = this.reloj.hoy();
    const mes = primerDiaDelMes(hoy);
    const mesPasado = sumarMeses(mes, -1);
    const [gastadoMes, gastadoMesPasado, conSaldo, costoPorEquipo] = await Promise.all([
      this.repo.sumarAbonosEntre(mes, hoy),
      this.repo.sumarAbonosEntre(mesPasado, sumarDias(mes, -1)),
      this.repo.listarMantenimientos({ conSaldo: true }),
      this.repo.costoPorEquipo(sumarMeses(hoy, -12)),
    ]);
    return {
      gastadoMes,
      gastadoMesPasado,
      porPagar: centavos(conSaldo.reduce((t, m) => t + saldoDe(m), 0)),
      pendientes: conSaldo.length,
      costoPorEquipo,
    };
  }
}

/* ── Ficha de un equipo ─────────────────────────────────────────────── */

export interface FichaDeEquipo extends EquipoEnTablero {
  mantenimientos: Mantenimiento[];
  reportesCerrados: ReporteFalla[];
  tieneHistorial: boolean;
  /** Lo gastado en toda su historia y en los últimos 12 meses. */
  costoTotal: number;
  costo12Meses: number;
}

export class ObtenerFichaDeEquipo {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(id: string): Promise<FichaDeEquipo> {
    const equipo = await this.repo.obtenerEquipo(id);
    if (!equipo) throw new NoEncontrado("El equipo");
    const hoy = this.reloj.hoy();
    const [mantenimientos, reportes] = await Promise.all([this.repo.listarMantenimientos({ equipoId: id }), this.repo.listarReportes({ equipoId: id })]);
    const abiertos = reportes.filter((r) => !r.atendidoEn);
    const ultimoPreventivo = mantenimientos.find((m) => m.tipo === "preventivo")?.fecha ?? null;
    const haceUnAnio = sumarMeses(hoy, -12);
    return {
      equipo,
      estado: estadoDeEquipo(equipo, abiertos),
      preventivo: proximoPreventivo(equipo, ultimoPreventivo, this.reloj.local(equipo.creadoEn).fecha, hoy),
      ultimoServicio: mantenimientos[0]?.fecha ?? null,
      reportes: abiertos,
      reportesCerrados: reportes.filter((r) => r.atendidoEn),
      mantenimientos,
      tieneHistorial: mantenimientos.length > 0 || reportes.length > 0,
      costoTotal: centavos(mantenimientos.reduce((t, m) => t + m.total, 0)),
      costo12Meses: centavos(mantenimientos.filter((m) => m.fecha >= haceUnAnio).reduce((t, m) => t + m.total, 0)),
    };
  }
}

/* ── Alta y cambios de equipos ──────────────────────────────────────── */

/** Dos máquinas con el mismo nombre se confunden al reportar fallas. */
function revisarNombreRepetido(existentes: Equipo[], nombre: string, excluirId?: string) {
  const otro = existentes.find((e) => e.id !== excluirId && claveDeNombre(e.nombre) === claveDeNombre(nombre));
  if (!otro) return;
  throw new ErrorDeDominio(
    otro.activo
      ? `Ya tienes un equipo llamado «${otro.nombre}». Ponle un número o la ubicación para distinguirlos (ej. «${otro.nombre} 2»).`
      : `«${otro.nombre}» ya existe, pero está dado de baja. Búscalo en la pestaña «Dados de baja» y reactívalo.`,
    "nombre",
  );
}

export class GuardarEquipo {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  private async crear(datos: DatosEquipo): Promise<Equipo> {
    const validos = validarEquipo(datos, this.reloj.hoy());
    revisarNombreRepetido(await this.repo.listarEquipos(), validos.nombre);
    return (await this.repo.crearEquipos([validos]))[0];
  }

  private async editar(id: string, datos: DatosEquipo): Promise<Equipo> {
    if (!(await this.repo.obtenerEquipo(id))) throw new NoEncontrado("El equipo");
    const validos = validarEquipo(datos, this.reloj.hoy());
    revisarNombreRepetido(await this.repo.listarEquipos(), validos.nombre, id);
    return this.repo.actualizarEquipo(id, validos);
  }

  /** Alta (sin `id`) o cambios (con `id`). */
  async ejecutar(entrada: { id?: string; datos: DatosEquipo }): Promise<Equipo> {
    return entrada.id ? this.editar(entrada.id, entrada.datos) : this.crear(entrada.datos);
  }
}

/**
 * El número más alto que ya lleva un tipo de equipo: «Caminadora 3» → 3;
 * «Caminadora» sola cuenta como la 1; si no hay ninguna, 0.
 */
export function ultimoNumero(nombresExistentes: string[], base: string): number {
  const clave = claveDeNombre(base);
  let maximo = 0;
  for (const n of nombresExistentes.map(claveDeNombre)) {
    if (n === clave) maximo = Math.max(maximo, 1);
    else if (n.startsWith(`${clave} `) && /^\d+$/.test(n.slice(clave.length + 1))) maximo = Math.max(maximo, Number(n.slice(clave.length + 1)));
  }
  return maximo;
}

/**
 * Alta de varios equipos típicos de una vez: "3 caminadoras" se vuelven
 * Caminadora 1, 2 y 3, con su frecuencia de preventivo sugerida. Si ya
 * existen "Caminadora 1" y "Caminadora 2", las nuevas siguen en la 3.
 */
export class AltaRapidaDeEquipos {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(elegidos: { clave: string; cantidad: number; frecuenciaMeses: number | null }[]): Promise<number> {
    const hoy = this.reloj.hoy();
    const existentes = await this.repo.listarEquipos();
    const usados = new Set(existentes.map((e) => claveDeNombre(e.nombre)));
    const lote: DatosEquipo[] = [];
    for (const { clave, cantidad, frecuenciaMeses } of elegidos) {
      const tipo = EQUIPOS_TIPICOS.find((t) => t.clave === clave);
      if (!tipo || !Number.isInteger(cantidad) || cantidad < 1) continue;
      if (cantidad > 50) throw new ErrorDeDominio(`Son demasiadas «${tipo.nombre}»: máximo 50 de una vez.`);
      // La numeración sigue después de la más alta que ya exista (incluidas las dadas de baja).
      const ultimo = ultimoNumero([...usados], tipo.nombre);
      const conNumero = cantidad > 1 || ultimo > 0;
      for (let i = 0; i < cantidad; i++) {
        const nombre = conNumero ? `${tipo.nombre} ${ultimo + i + 1}` : tipo.nombre;
        usados.add(claveDeNombre(nombre));
        lote.push(
          validarEquipo(
            { nombre, area: tipo.area, marca: null, modelo: null, numeroSerie: null, fechaCompra: null, frecuenciaMeses, servicioBase: null, nota: null },
            hoy,
          ),
        );
      }
    }
    if (lote.length === 0) throw new ErrorDeDominio("Marca al menos un equipo y cuántos tienes.");
    await this.repo.crearEquipos(lote);
    return lote.length;
  }
}

export class CambiarEstadoEquipo {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string, activo: boolean): Promise<void> {
    if (!(await this.repo.obtenerEquipo(id))) throw new NoEncontrado("El equipo");
    await this.repo.cambiarEstadoEquipo(id, activo);
  }
}

export class EliminarEquipo {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string): Promise<string> {
    const equipo = await this.repo.obtenerEquipo(id);
    if (!equipo) throw new NoEncontrado("El equipo");
    if (await this.repo.tieneHistorial(id)) {
      throw new ErrorDeDominio("Este equipo ya tiene mantenimientos o reportes; eliminarlo borraría ese historial. Mejor dalo de baja.");
    }
    await this.repo.eliminarEquipo(id);
    return equipo.nombre;
  }
}

/* ── Registrar un mantenimiento ─────────────────────────────────────── */

export class RegistrarMantenimiento {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosMantenimiento, pago: PagoInicial, resuelve: string[] = []): Promise<string> {
    const hoy = this.reloj.hoy();
    const { datos: validos, total, abono } = validarMantenimiento(datos, pago, hoy);
    const equipo = await this.repo.obtenerEquipo(validos.equipoId);
    if (!equipo) throw new ErrorDeDominio("Elige una máquina de la lista.", "equipoId");
    if (!equipo.activo) throw new ErrorDeDominio(`«${equipo.nombre}» está dado de baja. Reactívalo para registrarle mantenimientos.`, "equipoId");
    // El pago al registrar se hizo el día del mantenimiento (así cuadra la caja de ese día).
    return this.repo.registrarMantenimiento({ ...validos, total }, abono && { ...abono, fecha: validos.fecha, nota: null }, resuelve);
  }
}

export class ObtenerMantenimiento {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string): Promise<Mantenimiento & { abonos: Abono[]; resolvio: ReporteFalla[] }> {
    const m = await this.repo.obtenerMantenimiento(id);
    if (!m) throw new NoEncontrado("El registro de mantenimiento");
    const reportes = await this.repo.listarReportes({ equipoId: m.equipoId });
    return { ...m, resolvio: reportes.filter((r) => r.mantenimientoId === id) };
  }
}

export class EliminarMantenimiento {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string): Promise<{ equipoId: string }> {
    const m = await this.repo.obtenerMantenimiento(id);
    if (!m) throw new NoEncontrado("El registro de mantenimiento");
    await this.repo.eliminarMantenimiento(id);
    return { equipoId: m.equipoId };
  }
}

export class RegistrarAbono {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosAbono): Promise<{ saldo: number }> {
    const m = await this.repo.obtenerMantenimiento(datos.mantenimientoId);
    if (!m) throw new NoEncontrado("El registro de mantenimiento");
    const validos = validarAbono(datos, saldoDe(m), m.fecha, this.reloj.hoy());
    await this.repo.registrarAbono(validos);
    return { saldo: centavos(saldoDe(m) - validos.monto) };
  }
}

export class EliminarAbono {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string): Promise<{ mantenimientoId: string }> {
    const abono = await this.repo.obtenerAbono(id);
    if (!abono) throw new NoEncontrado("El pago");
    await this.repo.eliminarAbono(id);
    return { mantenimientoId: abono.mantenimientoId };
  }
}

/* ── Historial y cuentas por pagar ──────────────────────────────────── */

export class ListarHistorialDeMantenimiento {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(desde: FechaISO, hasta: FechaISO) {
    const [mantenimientos, abonos] = await Promise.all([this.repo.listarMantenimientos({ desde, hasta }), this.repo.listarAbonosEntre(desde, hasta)]);
    return {
      mantenimientos,
      /** Lo que costaron los trabajos de este periodo. */
      costo: centavos(mantenimientos.reduce((t, m) => t + m.total, 0)),
      /** Lo que de verdad salió de dinero en el periodo (aunque sea de trabajos anteriores). */
      pagado: centavos(abonos.reduce((t, a) => t + a.monto, 0)),
      preventivos: mantenimientos.filter((m) => m.tipo === "preventivo").length,
      reparaciones: mantenimientos.filter((m) => m.tipo === "correctivo").length,
    };
  }
}

export interface DeudaConProveedor {
  proveedor: string;
  total: number;
  mantenimientos: Mantenimiento[];
}

/** Lo que se le debe a cada técnico o empresa, con lo más viejo primero. */
export class ObtenerPorPagar {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(): Promise<{ total: number; deudas: DeudaConProveedor[] }> {
    const pendientes = await this.repo.listarMantenimientos({ conSaldo: true });
    const grupos = new Map<string, DeudaConProveedor>();
    for (const m of pendientes) {
      const nombre = m.proveedor ?? "Sin técnico anotado";
      const clave = claveDeNombre(nombre);
      const g = grupos.get(clave) ?? { proveedor: nombre, total: 0, mantenimientos: [] };
      g.total = centavos(g.total + saldoDe(m));
      g.mantenimientos.push(m);
      grupos.set(clave, g);
    }
    const deudas = [...grupos.values()]
      .map((g) => ({ ...g, mantenimientos: g.mantenimientos.sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
      .sort((a, b) => b.total - a.total);
    return { total: centavos(deudas.reduce((t, d) => t + d.total, 0)), deudas };
  }
}

export class ListarProveedores {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar() {
    return this.repo.proveedores();
  }
}

/** Pagos de mantenimiento de un día, para el corte de caja. */
export class ObtenerSalidasDelDia {
  constructor(
    private readonly repo: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(fecha?: FechaISO): Promise<{ pagos: AbonoConDetalle[]; efectivo: number; transferencia: number }> {
    const dia = fecha ?? this.reloj.hoy();
    const pagos = await this.repo.listarAbonosEntre(dia, dia);
    const suma = (metodo: string) => centavos(pagos.filter((p) => p.metodo === metodo).reduce((t, p) => t + p.monto, 0));
    return { pagos, efectivo: suma("efectivo"), transferencia: suma("transferencia") };
  }
}

/* ── Reportes de falla ──────────────────────────────────────────────── */

export class ReportarFalla {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(datos: DatosReporte): Promise<string> {
    const validos = validarReporte(datos);
    const abiertos = await this.repo.listarReportes({ abiertos: true, equipoId: validos.equipoId });
    const igual = abiertos.find((r) => claveDeNombre(r.descripcion) === claveDeNombre(validos.descripcion));
    if (igual) throw new ErrorDeDominio("Esa falla ya está reportada; la administración ya la tiene en su lista.", "descripcion");
    return this.repo.crearReporte(validos);
  }
}

export class CerrarReporte {
  constructor(private readonly repo: MantenimientoRepository) {}

  async ejecutar(id: string, motivo: string): Promise<{ equipoId: string }> {
    const reporte = await this.repo.obtenerReporte(id);
    if (!reporte) throw new NoEncontrado("El reporte");
    if (reporte.atendidoEn) throw new ErrorDeDominio("Este reporte ya estaba cerrado.");
    const cierre = limpiarEspacios(motivo ?? "");
    if (cierre.length < 3) throw new ErrorDeDominio("Escribe por qué se cierra (ej. ya funciona, se ajustó un tornillo).", "cierre");
    if (cierre.length > 120) throw new ErrorDeDominio("El motivo puede tener hasta 120 caracteres.", "cierre");
    await this.repo.cerrarReporte(id, cierre);
    return { equipoId: reporte.equipoId };
  }
}
