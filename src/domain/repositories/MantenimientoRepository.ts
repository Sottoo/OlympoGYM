import type {
  Abono,
  AbonoConDetalle,
  DatosAbono,
  DatosEquipo,
  DatosMantenimiento,
  DatosReporte,
  Equipo,
  Mantenimiento,
  ReporteFalla,
} from "../entities/Mantenimiento";
import type { FechaISO } from "../shared/fechas";

export interface FiltroMantenimientos {
  equipoId?: string;
  desde?: FechaISO;
  hasta?: FechaISO;
  /** Solo los que todavía tienen saldo por pagar. */
  conSaldo?: boolean;
}

export interface MantenimientoRepository {
  /* Equipos */
  listarEquipos(): Promise<Equipo[]>;
  obtenerEquipo(id: string): Promise<Equipo | null>;
  /** Alta de uno o varios equipos en una sola operación. */
  crearEquipos(lote: DatosEquipo[]): Promise<Equipo[]>;
  actualizarEquipo(id: string, datos: DatosEquipo): Promise<Equipo>;
  cambiarEstadoEquipo(id: string, activo: boolean): Promise<void>;
  tieneHistorial(id: string): Promise<boolean>;
  /**
   * Elimina la máquina para siempre. Sin historial se borra por completo; con
   * mantenimientos o reportes deja de aparecer, pero sus gastos se conservan.
   */
  eliminarEquipo(id: string): Promise<"completo" | "conservado">;

  /* Mantenimientos y pagos */
  listarMantenimientos(filtro?: FiltroMantenimientos): Promise<Mantenimiento[]>;
  obtenerMantenimiento(id: string): Promise<(Mantenimiento & { abonos: Abono[] }) | null>;
  /**
   * Guarda el mantenimiento con su pago inicial (si hubo) y cierra los
   * reportes de falla que resuelve, todo junto o nada.
   */
  registrarMantenimiento(datos: DatosMantenimiento & { total: number }, abono: Omit<DatosAbono, "mantenimientoId"> | null, resuelve: string[]): Promise<string>;
  /** Borra el registro y sus pagos; los reportes que había cerrado vuelven a quedar abiertos. */
  eliminarMantenimiento(id: string): Promise<void>;
  registrarAbono(datos: DatosAbono): Promise<string>;
  obtenerAbono(id: string): Promise<Abono | null>;
  eliminarAbono(id: string): Promise<void>;
  /** Pagos hechos entre dos fechas (inclusive), con su equipo y técnico. */
  listarAbonosEntre(desde: FechaISO, hasta: FechaISO): Promise<AbonoConDetalle[]>;
  sumarAbonosEntre(desde: FechaISO, hasta: FechaISO): Promise<number>;
  /** Fecha del último preventivo de cada equipo. */
  ultimosPreventivos(): Promise<Map<string, FechaISO>>;
  /** Fecha del último mantenimiento (de cualquier tipo) de cada equipo. */
  ultimosServicios(): Promise<Map<string, FechaISO>>;
  /** Lo que ha costado cada equipo desde una fecha (por fecha del mantenimiento). */
  costoPorEquipo(desde: FechaISO): Promise<Map<string, number>>;
  /** Técnicos y empresas que ya se han usado, para sugerirlos. */
  proveedores(): Promise<string[]>;

  /* Reportes de falla */
  crearReporte(datos: DatosReporte): Promise<string>;
  listarReportes(filtro?: { abiertos?: boolean; equipoId?: string }): Promise<ReporteFalla[]>;
  obtenerReporte(id: string): Promise<ReporteFalla | null>;
  cerrarReporte(id: string, cierre: string): Promise<void>;
  /** La falla empeoró: el reporte abierto pasa a «fuera de servicio». */
  marcarFueraDeServicio(id: string): Promise<void>;
}
