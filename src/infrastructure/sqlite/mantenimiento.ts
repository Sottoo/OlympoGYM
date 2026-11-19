import "server-only";
import type {
  Abono,
  AbonoConDetalle,
  AreaEquipo,
  DatosAbono,
  DatosEquipo,
  DatosMantenimiento,
  DatosReporte,
  Equipo,
  Mantenimiento,
  ReporteFalla,
  TipoMantenimiento,
} from "@/domain/entities/Mantenimiento";
import type { MetodoPago } from "@/domain/entities/Pago";
import type { FiltroMantenimientos, MantenimientoRepository } from "@/domain/repositories/MantenimientoRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";
import { nuevoId, type Sesion } from "./baseDeDatos";

interface FilaEquipo {
  id: string; nombre: string; area: AreaEquipo; marca: string | null; modelo: string | null; numero_serie: string | null;
  fecha_compra: string | null; frecuencia_meses: number | null; servicio_base: string | null; nota: string | null; activo: number; creado_en: string;
}
interface FilaMantenimiento {
  id: string; equipo_id: string; equipo_nombre: string; equipo_eliminado: number; fecha: string; tipo: TipoMantenimiento; descripcion: string; proveedor: string | null;
  mano_de_obra: number; refacciones: number; total: number; pagado: number; nota: string | null; creado_en: string;
}
interface FilaAbono { id: string; mantenimiento_id: string; monto: number; metodo: MetodoPago; fecha: string; nota: string | null; creado_en: string }
interface FilaReporte {
  id: string; equipo_id: string; equipo_nombre: string; descripcion: string; fuera_de_servicio: number; reportado_por: string | null;
  reportado_en: string; atendido_en: string | null; mantenimiento_id: string | null; cierre: string | null;
}

const aEquipo = (f: FilaEquipo): Equipo => ({
  id: f.id, nombre: f.nombre, area: f.area, marca: f.marca, modelo: f.modelo, numeroSerie: f.numero_serie, fechaCompra: f.fecha_compra,
  frecuenciaMeses: f.frecuencia_meses, servicioBase: f.servicio_base, nota: f.nota, activo: Boolean(f.activo), creadoEn: f.creado_en,
});
const aMantenimiento = (f: FilaMantenimiento): Mantenimiento => ({
  id: f.id, equipoId: f.equipo_id, equipoNombre: f.equipo_nombre, equipoEliminado: Boolean(f.equipo_eliminado), fecha: f.fecha, tipo: f.tipo, descripcion: f.descripcion, proveedor: f.proveedor,
  manoDeObra: f.mano_de_obra, refacciones: f.refacciones, total: f.total, pagado: Math.round((f.pagado ?? 0) * 100) / 100, nota: f.nota, creadoEn: f.creado_en,
});
const aAbono = (f: FilaAbono): Abono => ({ id: f.id, mantenimientoId: f.mantenimiento_id, monto: f.monto, metodo: f.metodo, fecha: f.fecha, nota: f.nota, creadoEn: f.creado_en });
const aReporte = (f: FilaReporte): ReporteFalla => ({
  id: f.id, equipoId: f.equipo_id, equipoNombre: f.equipo_nombre, descripcion: f.descripcion, fueraDeServicio: Boolean(f.fuera_de_servicio),
  reportadoPor: f.reportado_por, reportadoEn: f.reportado_en, atendidoEn: f.atendido_en, mantenimientoId: f.mantenimiento_id, cierre: f.cierre,
});

/** Mantenimientos con el nombre de su equipo y lo pagado hasta hoy. */
const SELECT_MANTENIMIENTOS = `
  select m.*, e.nombre as equipo_nombre, e.eliminado_en is not null as equipo_eliminado,
         coalesce((select sum(a.monto) from abonos_mantenimiento a where a.mantenimiento_id = m.id), 0) as pagado
    from mantenimientos m
    join equipos e on e.id = m.equipo_id`;

const SELECT_REPORTES = `select r.*, e.nombre as equipo_nombre from reportes_falla r join equipos e on e.id = r.equipo_id`;

export class SqliteMantenimientoRepository implements MantenimientoRepository {
  constructor(private readonly s: Sesion) {}

  /* ── Equipos ── */

  async listarEquipos() {
    return this.s
      .todas<FilaEquipo>("select * from equipos where eliminado_en is null")
      .map(aEquipo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" }));
  }

  async obtenerEquipo(id: string) {
    const f = this.s.una<FilaEquipo>("select * from equipos where id = ? and eliminado_en is null", id);
    return f ? aEquipo(f) : null;
  }

  async crearEquipos(lote: DatosEquipo[]) {
    const ids = this.s.escribir(() =>
      lote.map((d) => {
        const id = nuevoId();
        this.s.ejecutar(
          `insert into equipos (id, nombre, area, marca, modelo, numero_serie, fecha_compra, frecuencia_meses, servicio_base, nota)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, d.nombre, d.area, d.marca, d.modelo, d.numeroSerie, d.fechaCompra, d.frecuenciaMeses, d.servicioBase, d.nota,
        );
        return id;
      }),
    );
    return ids.map((id) => aEquipo(this.s.una<FilaEquipo>("select * from equipos where id = ?", id)!));
  }

  async actualizarEquipo(id: string, d: DatosEquipo) {
    this.s.escribir(() =>
      this.s.ejecutar(
        `update equipos set nombre = ?, area = ?, marca = ?, modelo = ?, numero_serie = ?, fecha_compra = ?, frecuencia_meses = ?,
                servicio_base = ?, nota = ? where id = ?`,
        d.nombre, d.area, d.marca, d.modelo, d.numeroSerie, d.fechaCompra, d.frecuenciaMeses, d.servicioBase, d.nota, id,
      ),
    );
    const equipo = await this.obtenerEquipo(id);
    if (!equipo) throw new NoEncontrado("El equipo");
    return equipo;
  }

  async cambiarEstadoEquipo(id: string, activo: boolean) {
    this.s.escribir(() => this.s.ejecutar("update equipos set activo = ? where id = ?", activo ? 1 : 0, id));
  }

  async tieneHistorial(id: string) {
    return Boolean(
      this.s.una(
        "select 1 as si where exists (select 1 from mantenimientos where equipo_id = ?) or exists (select 1 from reportes_falla where equipo_id = ?)",
        id, id,
      ),
    );
  }

  async eliminarEquipo(id: string) {
    return this.s.escribir((): "completo" | "conservado" => {
      const conHistorial =
        this.s.una("select 1 as si from mantenimientos where equipo_id = ? limit 1", id) || this.s.una("select 1 as si from reportes_falla where equipo_id = ? limit 1", id);
      if (!conHistorial) {
        this.s.ejecutar("delete from equipos where id = ?", id);
        return "completo";
      }
      // Con historial: deja de existir para el programa, pero lo gastado en ella se conserva.
      this.s.ejecutar(
        "update reportes_falla set atendido_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), cierre = 'Se eliminó la máquina' where equipo_id = ? and atendido_en is null",
        id,
      );
      this.s.ejecutar("update equipos set activo = 0, eliminado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?", id);
      return "conservado";
    });
  }

  /* ── Mantenimientos ── */

  async listarMantenimientos(filtro: FiltroMantenimientos = {}) {
    const condiciones: string[] = [];
    const parametros: string[] = [];
    if (filtro.equipoId) {
      condiciones.push("m.equipo_id = ?");
      parametros.push(filtro.equipoId);
    }
    if (filtro.desde) {
      condiciones.push("m.fecha >= ?");
      parametros.push(filtro.desde);
    }
    if (filtro.hasta) {
      condiciones.push("m.fecha <= ?");
      parametros.push(filtro.hasta);
    }
    const donde = condiciones.length ? `where ${condiciones.join(" and ")}` : "";
    const lista = this.s
      .todas<FilaMantenimiento>(`${SELECT_MANTENIMIENTOS} ${donde} order by m.fecha desc, m.creado_en desc`, ...parametros)
      .map(aMantenimiento);
    return filtro.conSaldo ? lista.filter((m) => m.total - m.pagado > 0.004) : lista;
  }

  async obtenerMantenimiento(id: string) {
    const f = this.s.una<FilaMantenimiento>(`${SELECT_MANTENIMIENTOS} where m.id = ?`, id);
    if (!f) return null;
    const abonos = this.s
      .todas<FilaAbono>("select * from abonos_mantenimiento where mantenimiento_id = ? order by fecha, creado_en", id)
      .map(aAbono);
    return { ...aMantenimiento(f), abonos };
  }

  async registrarMantenimiento(d: DatosMantenimiento & { total: number }, abono: Omit<DatosAbono, "mantenimientoId"> | null, resuelve: string[]) {
    const id = nuevoId();
    this.s.escribir(() => {
      const equipo = this.s.una<FilaEquipo>("select * from equipos where id = ? and eliminado_en is null", d.equipoId);
      if (!equipo) throw new ErrorDeDominio("La máquina ya no existe. Vuelve a abrir la pantalla.", "equipoId");
      this.s.ejecutar(
        `insert into mantenimientos (id, equipo_id, fecha, tipo, descripcion, proveedor, mano_de_obra, refacciones, total, nota)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, d.equipoId, d.fecha, d.tipo, d.descripcion, d.proveedor, d.manoDeObra, d.refacciones, d.total, d.nota,
      );
      if (abono) {
        this.s.ejecutar(
          "insert into abonos_mantenimiento (id, mantenimiento_id, monto, metodo, fecha, nota) values (?, ?, ?, ?, ?, ?)",
          nuevoId(), id, abono.monto, abono.metodo, abono.fecha, abono.nota,
        );
      }
      for (const reporteId of resuelve) {
        this.s.ejecutar(
          "update reportes_falla set atendido_en = ?, mantenimiento_id = ? where id = ? and equipo_id = ? and atendido_en is null",
          new Date().toISOString(), id, reporteId, d.equipoId,
        );
      }
    });
    return id;
  }

  async eliminarMantenimiento(id: string) {
    this.s.escribir(() => {
      // Si con este registro se había arreglado una falla, la falla vuelve a quedar abierta.
      this.s.ejecutar("update reportes_falla set atendido_en = null, mantenimiento_id = null where mantenimiento_id = ?", id);
      this.s.ejecutar("delete from abonos_mantenimiento where mantenimiento_id = ?", id);
      this.s.ejecutar("delete from mantenimientos where id = ?", id);
    });
  }

  async registrarAbono(d: DatosAbono) {
    const id = nuevoId();
    this.s.escribir(() => {
      // Se revisa el saldo dentro de la misma transacción: dos pagos a la vez no pueden pasarse del total.
      const fila = this.s.una<{ total: number; pagado: number }>(
        "select m.total, coalesce((select sum(monto) from abonos_mantenimiento where mantenimiento_id = m.id), 0) as pagado from mantenimientos m where m.id = ?",
        d.mantenimientoId,
      );
      if (!fila) throw new ErrorDeDominio("El mantenimiento ya no existe.");
      if (Math.round((fila.pagado + d.monto) * 100) > Math.round(fila.total * 100)) throw new ErrorDeDominio("Ese pago es mayor a lo que se debe.", "monto");
      this.s.ejecutar(
        "insert into abonos_mantenimiento (id, mantenimiento_id, monto, metodo, fecha, nota) values (?, ?, ?, ?, ?, ?)",
        id, d.mantenimientoId, d.monto, d.metodo, d.fecha, d.nota,
      );
    });
    return id;
  }

  async obtenerAbono(id: string) {
    const f = this.s.una<FilaAbono>("select * from abonos_mantenimiento where id = ?", id);
    return f ? aAbono(f) : null;
  }

  async eliminarAbono(id: string) {
    this.s.escribir(() => this.s.ejecutar("delete from abonos_mantenimiento where id = ?", id));
  }

  async listarAbonosEntre(desde: FechaISO, hasta: FechaISO) {
    return this.s
      .todas<FilaAbono & { equipo_id: string; equipo_nombre: string; descripcion: string; proveedor: string | null }>(
        `select a.*, m.equipo_id, e.nombre as equipo_nombre, m.descripcion, m.proveedor
           from abonos_mantenimiento a
           join mantenimientos m on m.id = a.mantenimiento_id
           join equipos e on e.id = m.equipo_id
          where a.fecha between ? and ?
          order by a.fecha, a.creado_en`,
        desde, hasta,
      )
      .map((f): AbonoConDetalle => ({ ...aAbono(f), equipoId: f.equipo_id, equipoNombre: f.equipo_nombre, descripcion: f.descripcion, proveedor: f.proveedor }));
  }

  async sumarAbonosEntre(desde: FechaISO, hasta: FechaISO) {
    const f = this.s.una<{ total: number | null }>("select sum(monto) as total from abonos_mantenimiento where fecha between ? and ?", desde, hasta);
    return Math.round((f?.total ?? 0) * 100) / 100;
  }

  async ultimosPreventivos() {
    const filas = this.s.todas<{ equipo_id: string; fecha: string }>(
      "select equipo_id, max(fecha) as fecha from mantenimientos where tipo = 'preventivo' group by equipo_id",
    );
    return new Map(filas.map((f) => [f.equipo_id, f.fecha]));
  }

  async ultimosServicios() {
    const filas = this.s.todas<{ equipo_id: string; fecha: string }>("select equipo_id, max(fecha) as fecha from mantenimientos group by equipo_id");
    return new Map(filas.map((f) => [f.equipo_id, f.fecha]));
  }

  async costoPorEquipo(desde: FechaISO) {
    const filas = this.s.todas<{ equipo_id: string; total: number }>(
      "select equipo_id, sum(total) as total from mantenimientos where fecha >= ? group by equipo_id",
      desde,
    );
    return new Map(filas.map((f) => [f.equipo_id, Math.round(f.total * 100) / 100]));
  }

  async proveedores() {
    return this.s
      .todas<{ proveedor: string }>(
        "select proveedor from mantenimientos where proveedor is not null group by lower(proveedor) order by max(fecha) desc limit 30",
      )
      .map((f) => f.proveedor);
  }

  /* ── Reportes de falla ── */

  async crearReporte(d: DatosReporte) {
    const id = nuevoId();
    this.s.escribir(() => {
      const equipo = this.s.una<FilaEquipo>("select * from equipos where id = ? and eliminado_en is null", d.equipoId);
      if (!equipo || !equipo.activo) throw new ErrorDeDominio("Esa máquina ya no está en la lista. Vuelve a abrir la pantalla.", "equipoId");
      this.s.ejecutar(
        "insert into reportes_falla (id, equipo_id, descripcion, fuera_de_servicio, reportado_por) values (?, ?, ?, ?, ?)",
        id, d.equipoId, d.descripcion, d.fueraDeServicio ? 1 : 0, this.s.usuario,
      );
    });
    return id;
  }

  async listarReportes(filtro: { abiertos?: boolean; equipoId?: string } = {}) {
    const condiciones: string[] = [];
    const parametros: string[] = [];
    if (filtro.abiertos) condiciones.push("r.atendido_en is null");
    if (filtro.equipoId) {
      condiciones.push("r.equipo_id = ?");
      parametros.push(filtro.equipoId);
    }
    const donde = condiciones.length ? `where ${condiciones.join(" and ")}` : "";
    return this.s.todas<FilaReporte>(`${SELECT_REPORTES} ${donde} order by r.reportado_en desc`, ...parametros).map(aReporte);
  }

  async obtenerReporte(id: string) {
    const f = this.s.una<FilaReporte>(`${SELECT_REPORTES} where r.id = ?`, id);
    return f ? aReporte(f) : null;
  }

  async cerrarReporte(id: string, cierre: string) {
    this.s.escribir(() =>
      this.s.ejecutar("update reportes_falla set atendido_en = ?, cierre = ? where id = ? and atendido_en is null", new Date().toISOString(), cierre, id),
    );
  }

  async marcarFueraDeServicio(id: string) {
    this.s.escribir(() => this.s.ejecutar("update reportes_falla set fuera_de_servicio = 1 where id = ? and atendido_en is null", id));
  }
}
