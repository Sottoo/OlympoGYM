import "server-only";
import type { Asistencia, DatosNuevaAsistencia } from "@/domain/entities/Asistencia";
import type { DatosNuevoMovimiento, MovimientoInventario, TipoMovimiento } from "@/domain/entities/MovimientoInventario";
import type { DatosNuevoPago, MetodoPago, Pago, PagoDelDia } from "@/domain/entities/Pago";
import type { DatosNuevoPlan, Plan, UnidadDuracion } from "@/domain/entities/Plan";
import {
  type CategoriaProducto,
  type DatosProducto,
  describirCantidad,
  importeDe,
  precioPorUnidad,
  type Producto,
  type UnidadProducto,
} from "@/domain/entities/Producto";
import type { RegistroBitacora } from "@/domain/entities/RegistroBitacora";
import type { DatosNuevoSocio, Socio } from "@/domain/entities/Socio";
import type { DatosNuevaSuscripcion, Suscripcion } from "@/domain/entities/Suscripcion";
import type { DatosNuevaVenta, Venta } from "@/domain/entities/Venta";
import { normalizarCelular } from "@/domain/shared/reglas";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { BitacoraRepository, FiltroBitacora } from "@/domain/repositories/BitacoraRepository";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";
import { nuevoId, type Sesion } from "./baseDeDatos";

/* ── Filas tal como vienen de SQLite ─────────────────────────────────── */
interface FilaSocio {
  id: string; numero: number; nombre: string; apellidos: string; telefono: string; fecha_nacimiento: string | null;
  foto: string | null; notas: string | null; activo: number; fecha_baja: string | null; motivo_baja: string | null; creado_en: string;
}
interface FilaPlan { id: string; nombre: string; descripcion: string | null; precio: number; duracion: number; unidad: UnidadDuracion; activo: number }
interface FilaSuscripcion {
  id: string; socio_id: string; plan_id: string; plan_nombre: string | null; plan_unidad: string | null; plan_duracion: number | null;
  fecha_inicio: string; fecha_fin: string; creado_en: string;
}
interface FilaPago { id: string; socio_id: string; suscripcion_id: string | null; monto: number; metodo: MetodoPago; fecha: string; nota: string | null; creado_en: string }
interface FilaProducto {
  id: string; nombre: string; categoria: CategoriaProducto; codigo: string | null; precio_venta: number; costo: number | null;
  stock: number; stock_minimo: number; activo: number; creado_en: string;
  unidad: UnidadProducto | null; porcion_gramos: number | null; porcion_nombre: string | null; envase_gramos: number | null;
  foto: string | null;
}
interface FilaMovimiento {
  id: string; producto_id: string; tipo: TipoMovimiento; cantidad: number; venta_id: string | null; precio_unitario: number | null;
  nota: string | null; fecha: string; creado_en: string;
}
interface FilaVenta { id: string; fecha: string; metodo: MetodoPago; total: number; nota: string | null; creado_en: string }
interface FilaAsistencia { id: string; socio_id: string; fecha: string; registrada_en: string; excepcion: string | null }

const aSocio = (f: FilaSocio): Socio => ({
  id: f.id, numero: f.numero, nombre: f.nombre, apellidos: f.apellidos, telefono: f.telefono, fechaNacimiento: f.fecha_nacimiento,
  foto: f.foto, notas: f.notas, activo: Boolean(f.activo), fechaBaja: f.fecha_baja, motivoBaja: f.motivo_baja, creadoEn: f.creado_en,
});
const aPlan = (f: FilaPlan): Plan => ({
  id: f.id, nombre: f.nombre, descripcion: f.descripcion, precio: f.precio, duracion: f.duracion, unidad: f.unidad, activo: Boolean(f.activo),
});
const aSuscripcion = (f: FilaSuscripcion): Suscripcion => ({
  id: f.id, socioId: f.socio_id, planId: f.plan_id, planNombre: f.plan_nombre ?? "Plan", fechaInicio: f.fecha_inicio, fechaFin: f.fecha_fin, creadoEn: f.creado_en,
  esVisita: f.plan_unidad === "dias" && f.plan_duracion === 1,
});
const aPago = (f: FilaPago): Pago => ({
  id: f.id, socioId: f.socio_id, suscripcionId: f.suscripcion_id, monto: f.monto, metodo: f.metodo, fecha: f.fecha, nota: f.nota, creadoEn: f.creado_en,
});
const aProducto = (f: FilaProducto): Producto => ({
  id: f.id, nombre: f.nombre, categoria: f.categoria, codigo: f.codigo, precioVenta: f.precio_venta, costo: f.costo,
  stock: f.stock, stockMinimo: f.stock_minimo, activo: Boolean(f.activo), creadoEn: f.creado_en,
  unidad: f.unidad ?? "pieza", porcionGramos: f.porcion_gramos, porcionNombre: f.porcion_nombre, envaseGramos: f.envase_gramos,
  foto: f.foto ?? null,
});
const aMovimiento = (f: FilaMovimiento): MovimientoInventario => ({
  id: f.id, productoId: f.producto_id, tipo: f.tipo, cantidad: f.cantidad, ventaId: f.venta_id, precioUnitario: f.precio_unitario,
  nota: f.nota, fecha: f.fecha, creadoEn: f.creado_en,
});
const aAsistencia = (f: FilaAsistencia): Asistencia => ({
  id: f.id, socioId: f.socio_id, fecha: f.fecha, registradaEn: f.registrada_en, excepcion: f.excepcion,
});

/**
 * Búsqueda que no distingue mayúsculas ni acentos ("jose" encuentra a
 * "José", "pena" a "Peña"). SQLite solo ignora mayúsculas sin acento, así
 * que la comparación se hace aquí; son pocos miles de registros a lo más.
 */
const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const coincide = (busqueda: string, ...campos: (string | null)[]) => {
  const b = normalizar(busqueda);
  return campos.some((c) => c !== null && normalizar(c).includes(b));
};
const porNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

/* ── Socios ──────────────────────────────────────────────────────────── */
export class SqliteSocioRepository implements SocioRepository {
  constructor(private readonly s: Sesion) {}

  async listar(filtro?: { busqueda?: string }): Promise<Socio[]> {
    const texto = filtro?.busqueda?.trim();
    const todos = this.s
      .todas<FilaSocio>("select * from socios")
      .map(aSocio)
      .sort((a, b) => porNombre(`${a.nombre} ${a.apellidos}`, `${b.nombre} ${b.apellidos}`));
    if (!texto) return todos;
    const numero = /^\d{1,6}$/.test(texto) ? Number(texto) : -1;
    const digitos = texto.replace(/\D/g, "");
    return todos.filter(
      (s) =>
        s.numero === numero ||
        coincide(texto, s.nombre, s.apellidos, `${s.nombre} ${s.apellidos}`) ||
        (digitos.length >= 3 && (s.telefono ?? "").replace(/\D/g, "").includes(digitos)),
    );
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaSocio>("select * from socios where id = ?", id);
    return f ? aSocio(f) : null;
  }

  async crear(d: DatosNuevoSocio): Promise<Socio> {
    const id = nuevoId();
    this.s.escribir(() =>
      this.s.ejecutar(
        `insert into socios (id, numero, nombre, apellidos, telefono, fecha_nacimiento, notas)
         values (?, (select coalesce(max(numero), 0) + 1 from socios), ?, ?, ?, ?, ?)`,
        id, d.nombre, d.apellidos, d.telefono ?? "", d.fechaNacimiento, d.notas,
      ),
    );
    return (await this.obtenerPorId(id))!;
  }

  async actualizar(id: string, d: DatosNuevoSocio): Promise<Socio> {
    this.s.escribir(() =>
      this.s.ejecutar(
        "update socios set nombre = ?, apellidos = ?, telefono = ?, fecha_nacimiento = ?, notas = ? where id = ?",
        d.nombre, d.apellidos, d.telefono ?? "", d.fechaNacimiento, d.notas, id,
      ),
    );
    const socio = await this.obtenerPorId(id);
    if (!socio) throw new NoEncontrado("El socio");
    return socio;
  }

  async darDeBaja(id: string, fecha: FechaISO, motivo: string) {
    this.s.escribir(() => this.s.ejecutar("update socios set activo = 0, fecha_baja = ?, motivo_baja = ? where id = ?", fecha, motivo, id));
  }

  async reactivar(id: string) {
    this.s.escribir(() => this.s.ejecutar("update socios set activo = 1, fecha_baja = null, motivo_baja = null where id = ?", id));
  }

  async cambiarFoto(id: string, ruta: string | null) {
    this.s.escribir(() => this.s.ejecutar("update socios set foto = ? where id = ?", ruta, id));
  }

  async buscarPorCelular(celular: string): Promise<Socio[]> {
    const final = celular.slice(-4);
    return this.s
      .todas<FilaSocio>("select * from socios where telefono like ?", `%${final}`)
      .map(aSocio)
      .filter((s) => normalizarCelular(s.telefono) === celular);
  }

  async eliminarSinHistorial(id: string) {
    this.s.escribir(() =>
      this.s.ejecutar(
        `delete from socios where id = ?
           and not exists (select 1 from suscripciones where socio_id = socios.id)
           and not exists (select 1 from pagos where socio_id = socios.id)
           and not exists (select 1 from asistencias where socio_id = socios.id)`,
        id,
      ),
    );
  }
}

/* ── Planes ──────────────────────────────────────────────────────────── */
export class SqlitePlanRepository implements PlanRepository {
  constructor(private readonly s: Sesion) {}

  async listar(filtro?: { soloActivos?: boolean }) {
    return this.s
      .todas<FilaPlan>(`select * from planes ${filtro?.soloActivos ? "where activo = 1" : ""} order by precio`)
      .map(aPlan);
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaPlan>("select * from planes where id = ?", id);
    return f ? aPlan(f) : null;
  }

  async crear(d: DatosNuevoPlan) {
    const id = nuevoId();
    this.s.escribir(() =>
      this.s.ejecutar("insert into planes (id, nombre, descripcion, precio, duracion, unidad) values (?, ?, ?, ?, ?, ?)", id, d.nombre, d.descripcion, d.precio, d.duracion, d.unidad),
    );
    return (await this.obtenerPorId(id))!;
  }

  async cambiarEstado(id: string, activo: boolean) {
    this.s.escribir(() => this.s.ejecutar("update planes set activo = ? where id = ?", activo ? 1 : 0, id));
  }
}

/* ── Membresías ─────────────────────────────────────────────── */
const SUSCRIPCION_CON_PLAN =
  "select s.*, p.nombre as plan_nombre, p.unidad as plan_unidad, p.duracion as plan_duracion from suscripciones s join planes p on p.id = s.plan_id";

export class SqliteSuscripcionRepository implements SuscripcionRepository {
  constructor(private readonly s: Sesion) {}

  async crear(d: DatosNuevaSuscripcion) {
    const id = nuevoId();
    this.s.escribir(() =>
      this.s.ejecutar("insert into suscripciones (id, socio_id, plan_id, fecha_inicio, fecha_fin) values (?, ?, ?, ?, ?)", id, d.socioId, d.planId, d.fechaInicio, d.fechaFin),
    );
    return aSuscripcion(this.s.una<FilaSuscripcion>(`${SUSCRIPCION_CON_PLAN} where s.id = ?`, id)!);
  }

  async listarPorSocio(socioId: string) {
    return this.s
      .todas<FilaSuscripcion>(`${SUSCRIPCION_CON_PLAN} where s.socio_id = ? order by s.fecha_fin desc, s.creado_en desc`, socioId)
      .map(aSuscripcion);
  }

  /** La membresía con el vencimiento más lejano de cada socio. */
  async listarUltimaDeCadaSocio() {
    return this.s
      .todas<FilaSuscripcion>(
        `select * from (
           select s.*, p.nombre as plan_nombre, p.unidad as plan_unidad, p.duracion as plan_duracion,
                  row_number() over (partition by s.socio_id order by s.fecha_fin desc, s.creado_en desc) as orden
             from suscripciones s join planes p on p.id = s.plan_id
            where not (p.unidad = 'dias' and p.duracion = 1) -- las visitas de un día no son membresías
         ) where orden = 1`,
      )
      .map(aSuscripcion);
  }

  async obtenerUltimaDeSocio(socioId: string) {
    const f = this.s.una<FilaSuscripcion>(`${SUSCRIPCION_CON_PLAN} where s.socio_id = ? order by s.fecha_fin desc, s.creado_en desc limit 1`, socioId);
    return f ? aSuscripcion(f) : null;
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaSuscripcion>(`${SUSCRIPCION_CON_PLAN} where s.id = ?`, id);
    return f ? aSuscripcion(f) : null;
  }

  async crearConPago(d: DatosNuevaSuscripcion, pago: Omit<DatosNuevoPago, "suscripcionId">) {
    const id = nuevoId();
    this.s.escribir(() => {
      this.s.ejecutar("insert into suscripciones (id, socio_id, plan_id, fecha_inicio, fecha_fin) values (?, ?, ?, ?, ?)", id, d.socioId, d.planId, d.fechaInicio, d.fechaFin);
      this.s.ejecutar(
        "insert into pagos (id, socio_id, suscripcion_id, monto, metodo, fecha, nota) values (?, ?, ?, ?, ?, ?, ?)",
        nuevoId(), pago.socioId, id, pago.monto, pago.metodo, pago.fecha, pago.nota,
      );
    });
    return aSuscripcion(this.s.una<FilaSuscripcion>(`${SUSCRIPCION_CON_PLAN} where s.id = ?`, id)!);
  }

  async anularConSuPago(id: string, asistenciaId?: string) {
    this.s.escribir(() => {
      if (asistenciaId) this.s.ejecutar("delete from asistencias where id = ?", asistenciaId);
      this.s.ejecutar("delete from pagos where suscripcion_id = ?", id);
      this.s.ejecutar("delete from suscripciones where id = ?", id);
    });
  }
}

/* ── Pagos ───────────────────────────────────────────────────────────── */
export class SqlitePagoRepository implements PagoRepository {
  constructor(private readonly s: Sesion) {}

  async crear(d: DatosNuevoPago) {
    const id = nuevoId();
    this.s.escribir(() =>
      this.s.ejecutar(
        "insert into pagos (id, socio_id, suscripcion_id, monto, metodo, fecha, nota) values (?, ?, ?, ?, ?, ?, ?)",
        id, d.socioId, d.suscripcionId, d.monto, d.metodo, d.fecha, d.nota,
      ),
    );
    return aPago(this.s.una<FilaPago>("select * from pagos where id = ?", id)!);
  }

  async listarPorSocio(socioId: string) {
    return this.s.todas<FilaPago>("select * from pagos where socio_id = ? order by fecha desc, creado_en desc", socioId).map(aPago);
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.s.una<{ total: number }>("select coalesce(sum(monto), 0) as total from pagos where fecha between ? and ?", desde, hasta)!.total;
  }

  async listarDelDia(dia: FechaISO): Promise<PagoDelDia[]> {
    return this.s
      .todas<FilaPago & { socio_nombre: string; plan_nombre: string | null }>(
        `select p.*, so.nombre || ' ' || so.apellidos as socio_nombre, pl.nombre as plan_nombre
           from pagos p
           join socios so on so.id = p.socio_id
           left join suscripciones su on su.id = p.suscripcion_id
           left join planes pl on pl.id = su.plan_id
          where p.fecha = ?
          order by p.creado_en desc`,
        dia,
      )
      .map((f) => ({ ...aPago(f), socioNombre: f.socio_nombre, planNombre: f.plan_nombre }));
  }
}

/* ── Productos e inventario ──────────────────────────────────────────── */

/**
 * Pasos síncronos que se pueden juntar en una sola transacción (alta de
 * productos + entradas de mercancía): si algo falla, no se guarda nada.
 */
function insertarProductos(s: Sesion, lote: { datos: DatosProducto; inicial: number; nota?: string }[], fecha: FechaISO): string[] {
  return lote.map(({ datos: d, inicial, nota }) => {
    const id = nuevoId();
    s.ejecutar(
      `insert into productos (id, nombre, categoria, codigo, precio_venta, costo, stock_minimo, unidad, porcion_gramos, porcion_nombre, envase_gramos)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, d.nombre, d.categoria, d.codigo, d.precioVenta, d.costo, d.stockMinimo, d.unidad, d.porcionGramos, d.porcionNombre, d.envaseGramos,
    );
    if (inicial > 0) {
      s.ejecutar("update productos set stock = ? where id = ?", inicial, id);
      s.ejecutar(
        "insert into movimientos_inventario (id, producto_id, tipo, cantidad, nota, fecha) values (?, ?, 'entrada', ?, ?, ?)",
        nuevoId(), id, inicial, nota ?? "Inventario inicial", fecha,
      );
    }
    return id;
  });
}

function aplicarMovimientos(s: Sesion, lote: DatosNuevoMovimiento[]) {
  for (const d of lote) {
    if (!["entrada", "merma", "ajuste"].includes(d.tipo)) throw new ErrorDeDominio("Tipo de movimiento no válido.");
    const producto = s.una<FilaProducto>("select * from productos where id = ?", d.productoId);
    if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe.");
    if (producto.stock + d.cantidad < 0) throw new ErrorDeDominio(`No hay suficiente existencia de ${producto.nombre}.`);
    s.ejecutar("update productos set stock = stock + ? where id = ?", d.cantidad, d.productoId);
    s.ejecutar(
      "insert into movimientos_inventario (id, producto_id, tipo, cantidad, nota, fecha) values (?, ?, ?, ?, ?, ?)",
      nuevoId(), d.productoId, d.tipo, d.cantidad, d.nota, d.fecha,
    );
  }
}
export class SqliteProductoRepository implements ProductoRepository {
  constructor(private readonly s: Sesion) {}

  async listar(filtro?: { busqueda?: string; soloActivos?: boolean }) {
    const texto = filtro?.busqueda?.trim();
    return this.s
      .todas<FilaProducto>(`select * from productos ${filtro?.soloActivos ? "where activo = 1" : ""}`)
      .map(aProducto)
      .filter((p) => !texto || coincide(texto, p.nombre, p.codigo))
      .sort((a, b) => porNombre(a.nombre, b.nombre));
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaProducto>("select * from productos where id = ?", id);
    return f ? aProducto(f) : null;
  }

  async crear(d: DatosProducto, inicial?: { cantidad: number; fecha: FechaISO }) {
    return (await this.crearVarios([{ datos: d, inicial: inicial?.cantidad ?? 0 }], inicial?.fecha ?? ""))[0];
  }

  async crearVarios(lote: { datos: DatosProducto; inicial: number; nota?: string }[], fecha: FechaISO) {
    const ids = this.s.escribir(() => insertarProductos(this.s, lote, fecha));
    return ids.map((id) => aProducto(this.s.una<FilaProducto>("select * from productos where id = ?", id)!));
  }

  async obtenerPorCodigo(codigo: string) {
    const f = this.s.una<FilaProducto>("select * from productos where lower(codigo) = lower(?)", codigo.trim());
    return f ? aProducto(f) : null;
  }

  async actualizar(id: string, d: DatosProducto) {
    this.s.escribir(() =>
      this.s.ejecutar(
        `update productos set nombre = ?, categoria = ?, codigo = ?, precio_venta = ?, costo = ?, stock_minimo = ?,
                unidad = ?, porcion_gramos = ?, porcion_nombre = ?, envase_gramos = ? where id = ?`,
        d.nombre, d.categoria, d.codigo, d.precioVenta, d.costo, d.stockMinimo, d.unidad, d.porcionGramos, d.porcionNombre, d.envaseGramos, id,
      ),
    );
    const producto = await this.obtenerPorId(id);
    if (!producto) throw new NoEncontrado("El producto");
    return producto;
  }

  async cambiarEstado(id: string, activo: boolean) {
    this.s.escribir(() => this.s.ejecutar("update productos set activo = ? where id = ?", activo ? 1 : 0, id));
  }

  async cambiarFoto(id: string, ruta: string | null) {
    this.s.escribir(() => this.s.ejecutar("update productos set foto = ? where id = ?", ruta, id));
  }

  async tieneVentas(id: string) {
    return Boolean(this.s.una("select 1 as si from movimientos_inventario where producto_id = ? and tipo = 'venta' limit 1", id));
  }

  async eliminar(id: string) {
    this.s.escribir(() => {
      if (this.s.una("select 1 as si from movimientos_inventario where producto_id = ? and tipo = 'venta' limit 1", id)) {
        throw new ErrorDeDominio("Este producto ya tiene ventas; no se puede eliminar.");
      }
      this.s.ejecutar("delete from movimientos_inventario where producto_id = ?", id);
      this.s.ejecutar("delete from productos where id = ?", id);
    });
  }
}

export class SqliteInventarioRepository implements InventarioRepository {
  constructor(private readonly s: Sesion) {}

  /** Cambia el stock y guarda el movimiento en una sola transacción. El stock nunca queda negativo. */
  async registrarMovimiento(d: DatosNuevoMovimiento) {
    if (!["entrada", "merma", "ajuste"].includes(d.tipo)) throw new ErrorDeDominio("Tipo de movimiento no válido.");
    const id = nuevoId();
    this.s.escribir(() => {
      const producto = this.s.una<FilaProducto>("select * from productos where id = ?", d.productoId);
      if (!producto) throw new ErrorDeDominio("El producto no existe o fue eliminado.");
      if (producto.stock + d.cantidad < 0) throw new ErrorDeDominio(`No hay suficiente stock de ${producto.nombre}.`);
      this.s.ejecutar("update productos set stock = stock + ? where id = ?", d.cantidad, d.productoId);
      this.s.ejecutar(
        "insert into movimientos_inventario (id, producto_id, tipo, cantidad, nota, fecha) values (?, ?, ?, ?, ?, ?)",
        id, d.productoId, d.tipo, d.cantidad, d.nota, d.fecha,
      );
    });
    return aMovimiento(this.s.una<FilaMovimiento>("select * from movimientos_inventario where id = ?", id)!);
  }

  /** Varios movimientos (entradas, ajustes) en una sola operación: o se guardan todos o ninguno. */
  async registrarLote(lote: DatosNuevoMovimiento[]) {
    this.s.escribir(() => aplicarMovimientos(this.s, lote));
  }

  /** Llegada de mercancía: altas de productos nuevos y entradas de los existentes, juntas. */
  async recibir(nuevos: { datos: DatosProducto; inicial: number; nota?: string }[], entradas: DatosNuevoMovimiento[], fecha: FechaISO) {
    this.s.escribir(() => {
      insertarProductos(this.s, nuevos, fecha);
      aplicarMovimientos(this.s, entradas);
    });
  }

  /** Lo vendido de cada producto entre dos fechas (piezas o gramos) y en cuántos días distintos. */
  async ventasPorProducto(desde: FechaISO, hasta: FechaISO) {
    return this.s.todas<{ productoId: string; cantidad: number; dias: number; primera: string }>(
      `select producto_id as productoId, sum(-cantidad) as cantidad, count(distinct fecha) as dias, min(fecha) as primera
         from movimientos_inventario where tipo = 'venta' and fecha between ? and ? group by producto_id`,
      desde, hasta,
    );
  }

  /** Cada venta con su instante, para saber qué se vende a qué hora. */
  async ventasConHora(desde: FechaISO) {
    return this.s.todas<{ productoId: string; instante: string; cantidad: number }>(
      `select producto_id as productoId, creado_en as instante, -cantidad as cantidad
         from movimientos_inventario where tipo = 'venta' and fecha >= ?`,
      desde,
    );
  }

  async listarPorProducto(productoId: string, limite = 50) {
    return this.s
      .todas<FilaMovimiento>("select * from movimientos_inventario where producto_id = ? order by fecha desc, creado_en desc limit ?", productoId, limite)
      .map(aMovimiento);
  }
}

/* ── Ventas ──────────────────────────────────────────────────────────── */
export class SqliteVentaRepository implements VentaRepository {
  constructor(private readonly s: Sesion) {}

  /**
   * Guarda la venta y descuenta el stock de cada producto con el precio
   * vigente. Si un producto no alcanza, no se guarda nada.
   */
  async registrar(d: DatosNuevaVenta) {
    if (d.partidas.length === 0) throw new ErrorDeDominio("Agrega al menos un producto a la venta.");
    const ventaId = nuevoId();
    this.s.escribir(() => {
      this.s.ejecutar("insert into ventas (id, fecha, metodo, total, nota) values (?, ?, ?, 0, ?)", ventaId, d.fecha, d.metodo, d.nota);
      let total = 0;
      for (const partida of d.partidas) {
        if (!Number.isInteger(partida.cantidad) || partida.cantidad <= 0) throw new ErrorDeDominio("Las cantidades deben ser mayores a cero.");
        const p = this.s.una<FilaProducto>("select * from productos where id = ?", partida.productoId);
        if (!p) throw new ErrorDeDominio("Uno de los productos ya no existe.");
        if (!p.activo) throw new ErrorDeDominio(`${p.nombre} está desactivado.`);
        const producto = aProducto(p);
        if (p.stock < partida.cantidad) {
          throw new ErrorDeDominio(`No hay suficiente existencia de ${p.nombre} (quedan ${describirCantidad(producto, p.stock)}).`);
        }
        // A granel el precio es por porción: se guarda el precio por gramo.
        const precioUnitario = precioPorUnidad(producto);
        this.s.ejecutar("update productos set stock = stock - ? where id = ?", partida.cantidad, p.id);
        this.s.ejecutar(
          "insert into movimientos_inventario (id, producto_id, tipo, cantidad, venta_id, precio_unitario, fecha) values (?, ?, 'venta', ?, ?, ?, ?)",
          nuevoId(), p.id, -partida.cantidad, ventaId, precioUnitario, d.fecha,
        );
        total += importeDe(producto, partida.cantidad);
      }
      this.s.ejecutar("update ventas set total = ? where id = ?", Math.round(total * 100) / 100, ventaId);
    });
    return this.conPartidas([this.s.una<FilaVenta>("select * from ventas where id = ?", ventaId)!])[0];
  }

  async listarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.conPartidas(this.s.todas<FilaVenta>("select * from ventas where fecha between ? and ? order by fecha desc, creado_en desc", desde, hasta));
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.s.una<{ total: number }>("select coalesce(sum(total), 0) as total from ventas where fecha between ? and ?", desde, hasta)!.total;
  }

  private conPartidas(ventas: FilaVenta[]): Venta[] {
    if (ventas.length === 0) return [];
    const partidas = this.s.todas<{
      venta_id: string; producto_id: string; nombre: string; cantidad: number; precio_unitario: number;
      unidad: UnidadProducto | null; porcion_gramos: number | null; porcion_nombre: string | null;
    }>(
      `select m.venta_id, m.producto_id, p.nombre, m.cantidad, m.precio_unitario, p.unidad, p.porcion_gramos, p.porcion_nombre
         from movimientos_inventario m join productos p on p.id = m.producto_id
        where m.venta_id in (${ventas.map(() => "?").join(",")})`,
      ...ventas.map((v) => v.id),
    );
    return ventas.map((v) => ({
      id: v.id,
      fecha: v.fecha,
      metodo: v.metodo,
      total: v.total,
      nota: v.nota,
      creadoEn: v.creado_en,
      partidas: partidas
        .filter((p) => p.venta_id === v.id)
        .map((p) => ({
          productoId: p.producto_id,
          productoNombre: p.nombre,
          cantidad: -p.cantidad,
          precioUnitario: p.precio_unitario ?? 0,
          unidad: p.unidad ?? "pieza",
          porcionGramos: p.porcion_gramos,
          porcionNombre: p.porcion_nombre,
        })),
    }));
  }
}

/* ── Asistencias ─────────────────────────────────────────────────────── */
export class SqliteAsistenciaRepository implements AsistenciaRepository {
  constructor(private readonly s: Sesion) {}

  async registrar(d: DatosNuevaAsistencia) {
    const id = nuevoId();
    this.s.escribir(() => this.s.ejecutar("insert into asistencias (id, socio_id, fecha, excepcion) values (?, ?, ?, ?)", id, d.socioId, d.fecha, d.excepcion));
    return aAsistencia(this.s.una<FilaAsistencia>("select * from asistencias where id = ?", id)!);
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaAsistencia>("select * from asistencias where id = ?", id);
    return f ? aAsistencia(f) : null;
  }

  async listarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.s.todas<FilaAsistencia>("select * from asistencias where fecha between ? and ? order by registrada_en desc", desde, hasta).map(aAsistencia);
  }

  async ultimaDeSocio(socioId: string) {
    const f = this.s.una<FilaAsistencia>("select * from asistencias where socio_id = ? order by registrada_en desc limit 1", socioId);
    return f ? aAsistencia(f) : null;
  }

  async eliminar(id: string) {
    this.s.escribir(() => this.s.ejecutar("delete from asistencias where id = ?", id));
  }

  async diasDeSocio(socioId: string, desde: FechaISO, hasta: FechaISO) {
    return this.s
      .todas<{ fecha: string }>("select distinct fecha from asistencias where socio_id = ? and fecha between ? and ? order by fecha", socioId, desde, hasta)
      .map((f) => f.fecha);
  }

  async diasPorSocio(desde: FechaISO, hasta: FechaISO) {
    const filas = this.s.todas<{ socio_id: string; fecha: string }>(
      "select distinct socio_id, fecha from asistencias where fecha between ? and ? order by fecha",
      desde,
      hasta,
    );
    const mapa = new Map<string, FechaISO[]>();
    for (const f of filas) mapa.set(f.socio_id, [...(mapa.get(f.socio_id) ?? []), f.fecha]);
    return mapa;
  }
}

/* ── Bitácora ────────────────────────────────────────────────────────── */
export class SqliteBitacoraRepository implements BitacoraRepository {
  constructor(private readonly s: Sesion) {}

  async listar({ tablas, desde, pagina, porPagina }: FiltroBitacora) {
    const condiciones: string[] = [];
    const parametros: (string | number)[] = [];
    if (tablas?.length) {
      condiciones.push(`tabla in (${tablas.map(() => "?").join(", ")})`);
      parametros.push(...tablas);
    }
    if (desde) {
      condiciones.push("ocurrido_en >= ?");
      parametros.push(desde);
    }
    const donde = condiciones.length ? `where ${condiciones.join(" and ")}` : "";
    // Se pide una fila de más para saber si hay otra página.
    const filas = this.s.todas<{
      id: number; ocurrido_en: string; usuario_nombre: string | null; tabla: RegistroBitacora["tabla"];
      operacion: RegistroBitacora["operacion"]; registro_id: string | null; antes: string | null; despues: string | null;
    }>(`select * from bitacora ${donde} order by ocurrido_en desc, id desc limit ? offset ?`, ...parametros, porPagina + 1, (pagina - 1) * porPagina);

    const leer = (texto: string | null) => {
      if (!texto) return null;
      const fila = JSON.parse(texto) as Record<string, unknown>;
      if ("activo" in fila && fila.activo !== null) fila.activo = Boolean(fila.activo);
      return fila;
    };
    return {
      hayMas: filas.length > porPagina,
      registros: filas.slice(0, porPagina).map((f) => ({
        id: String(f.id),
        ocurridoEn: f.ocurrido_en,
        usuario: f.usuario_nombre,
        tabla: f.tabla,
        operacion: f.operacion,
        registroId: f.registro_id,
        antes: leer(f.antes),
        despues: leer(f.despues),
      })),
    };
  }
}
