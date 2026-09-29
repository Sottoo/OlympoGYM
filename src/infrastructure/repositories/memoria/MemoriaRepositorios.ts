import type { DatosNuevoMovimiento, MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import type { DatosNuevoPago, Pago } from "@/domain/entities/Pago";
import type { DatosNuevoPlan, Plan } from "@/domain/entities/Plan";
import type { DatosProducto, Producto } from "@/domain/entities/Producto";
import type { DatosNuevoSocio, Socio } from "@/domain/entities/Socio";
import type { DatosNuevaSuscripcion, Suscripcion } from "@/domain/entities/Suscripcion";
import type { DatosNuevaVenta, Venta } from "@/domain/entities/Venta";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";
import { type AlmacenMemoria, ahora, nuevoId } from "./AlmacenMemoria";

/*
 * Implementaciones en memoria de los mismos contratos que usa Supabase.
 * Gracias a la arquitectura limpia, los casos de uso no notan la diferencia.
 */

const recientePrimero = (a: Suscripcion, b: Suscripcion) =>
  b.fechaFin.localeCompare(a.fechaFin) || b.creadoEn.localeCompare(a.creadoEn);

const coincide = (texto: string | undefined, valores: (string | null)[]) => {
  const buscado = texto?.trim().toLowerCase();
  return !buscado || valores.some((v) => v?.toLowerCase().includes(buscado));
};

export class MemoriaSocioRepository implements SocioRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async listar(filtro?: { busqueda?: string }): Promise<Socio[]> {
    return this.db.socios
      .filter((s) => coincide(filtro?.busqueda, [s.nombre, s.apellidos, `${s.nombre} ${s.apellidos}`, s.email, s.telefono]))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async obtenerPorId(id: string) {
    return this.db.socios.find((s) => s.id === id) ?? null;
  }

  async crear(datos: DatosNuevoSocio): Promise<Socio> {
    this.verificarCorreoUnico(datos.email);
    const socio: Socio = { ...datos, id: nuevoId(), activo: true, fechaBaja: null, motivoBaja: null, creadoEn: ahora() };
    this.db.socios.push(socio);
    return socio;
  }

  async actualizar(id: string, datos: DatosNuevoSocio): Promise<Socio> {
    this.verificarCorreoUnico(datos.email, id);
    const socio = this.db.socios.find((s) => s.id === id);
    if (!socio) throw new NoEncontrado("El socio");
    Object.assign(socio, datos);
    return socio;
  }

  async darDeBaja(id: string, fecha: FechaISO, motivo: string) {
    const socio = this.db.socios.find((s) => s.id === id);
    if (socio) Object.assign(socio, { activo: false, fechaBaja: fecha, motivoBaja: motivo });
  }

  async reactivar(id: string) {
    const socio = this.db.socios.find((s) => s.id === id);
    if (socio) Object.assign(socio, { activo: true, fechaBaja: null, motivoBaja: null });
  }

  /** Igual que el índice único de la base de datos real. */
  private verificarCorreoUnico(email: string | null, excepto?: string) {
    if (email && this.db.socios.some((s) => s.id !== excepto && s.email === email)) {
      throw new ErrorDeDominio("Ya hay otro socio registrado con ese correo.");
    }
  }
}

export class MemoriaPlanRepository implements PlanRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async listar(filtro?: { soloActivos?: boolean }): Promise<Plan[]> {
    return this.db.planes.filter((p) => !filtro?.soloActivos || p.activo).sort((a, b) => a.precio - b.precio);
  }

  async obtenerPorId(id: string) {
    return this.db.planes.find((p) => p.id === id) ?? null;
  }

  async crear(datos: DatosNuevoPlan): Promise<Plan> {
    const plan: Plan = { ...datos, id: nuevoId(), activo: true };
    this.db.planes.push(plan);
    return plan;
  }

  async cambiarEstado(id: string, activo: boolean) {
    const plan = this.db.planes.find((p) => p.id === id);
    if (plan) plan.activo = activo;
  }
}

export class MemoriaSuscripcionRepository implements SuscripcionRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async crear(datos: DatosNuevaSuscripcion): Promise<Suscripcion> {
    const plan = this.db.planes.find((p) => p.id === datos.planId);
    const suscripcion: Suscripcion = { ...datos, id: nuevoId(), planNombre: plan?.nombre ?? "Plan", creadoEn: ahora() };
    this.db.suscripciones.push(suscripcion);
    return suscripcion;
  }

  async listarPorSocio(socioId: string) {
    return this.db.suscripciones.filter((s) => s.socioId === socioId).sort(recientePrimero);
  }

  async listarUltimaDeCadaSocio() {
    const ultimas = new Map<string, Suscripcion>();
    for (const s of [...this.db.suscripciones].sort(recientePrimero)) {
      if (!ultimas.has(s.socioId)) ultimas.set(s.socioId, s);
    }
    return [...ultimas.values()];
  }

  async obtenerUltimaDeSocio(socioId: string) {
    return (await this.listarPorSocio(socioId))[0] ?? null;
  }

  async listarAvisosEnviados(suscripcionIds: string[]) {
    return [...this.db.avisos]
      .map((clave) => clave.split(":"))
      .filter(([id]) => suscripcionIds.includes(id))
      .map(([suscripcionId, dias]) => ({ suscripcionId, diasAntes: Number(dias) }));
  }

  async registrarAvisoEnviado(suscripcionId: string, diasAntes: number) {
    this.db.avisos.add(`${suscripcionId}:${diasAntes}`);
  }
}

export class MemoriaPagoRepository implements PagoRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async crear(datos: DatosNuevoPago): Promise<Pago> {
    const pago: Pago = { ...datos, id: nuevoId(), creadoEn: ahora() };
    this.db.pagos.push(pago);
    return pago;
  }

  async listarPorSocio(socioId: string) {
    return this.db.pagos.filter((p) => p.socioId === socioId).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.db.pagos.filter((p) => p.fecha >= desde && p.fecha <= hasta).reduce((t, p) => t + p.monto, 0);
  }
}

export class MemoriaProductoRepository implements ProductoRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async listar(filtro?: { busqueda?: string; soloActivos?: boolean }): Promise<Producto[]> {
    return this.db.productos
      .filter((p) => (!filtro?.soloActivos || p.activo) && coincide(filtro?.busqueda, [p.nombre, p.codigo]))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async obtenerPorId(id: string) {
    return this.db.productos.find((p) => p.id === id) ?? null;
  }

  async crear(datos: DatosProducto): Promise<Producto> {
    this.verificarCodigoUnico(datos.codigo);
    const producto: Producto = { ...datos, id: nuevoId(), stock: 0, activo: true, creadoEn: ahora() };
    this.db.productos.push(producto);
    return producto;
  }

  async actualizar(id: string, datos: DatosProducto): Promise<Producto> {
    this.verificarCodigoUnico(datos.codigo, id);
    const producto = this.db.productos.find((p) => p.id === id);
    if (!producto) throw new NoEncontrado("El producto");
    Object.assign(producto, datos);
    return producto;
  }

  async cambiarEstado(id: string, activo: boolean) {
    const producto = this.db.productos.find((p) => p.id === id);
    if (producto) producto.activo = activo;
  }

  private verificarCodigoUnico(codigo: string | null, excepto?: string) {
    const buscado = codigo?.toLowerCase();
    if (buscado && this.db.productos.some((p) => p.id !== excepto && p.codigo?.toLowerCase() === buscado)) {
      throw new ErrorDeDominio("Ya hay otro producto con ese código.");
    }
  }
}

export class MemoriaInventarioRepository implements InventarioRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async registrarMovimiento(datos: DatosNuevoMovimiento): Promise<MovimientoInventario> {
    const producto = this.db.productos.find((p) => p.id === datos.productoId);
    if (!producto) throw new NoEncontrado("El producto");
    if (producto.stock + datos.cantidad < 0) throw new ErrorDeDominio(`No hay suficiente stock de ${producto.nombre}.`);

    producto.stock += datos.cantidad;
    const movimiento: MovimientoInventario = { ...datos, id: nuevoId(), ventaId: null, precioUnitario: null, creadoEn: ahora() };
    this.db.movimientos.push(movimiento);
    return movimiento;
  }

  async listarPorProducto(productoId: string, limite = 50) {
    return this.db.movimientos
      .filter((m) => m.productoId === productoId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, limite);
  }
}

export class MemoriaVentaRepository implements VentaRepository {
  constructor(private readonly db: AlmacenMemoria) {}

  async registrar(datos: DatosNuevaVenta): Promise<Venta> {
    // Primero se valida todo; así, si algo falla, no se modifica ningún stock.
    const partidas = datos.partidas.map(({ productoId, cantidad }) => {
      const producto = this.db.productos.find((p) => p.id === productoId);
      if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe.");
      if (!producto.activo) throw new ErrorDeDominio(`${producto.nombre} está desactivado.`);
      if (producto.stock < cantidad) throw new ErrorDeDominio(`No hay suficiente stock de ${producto.nombre} (quedan ${producto.stock}).`);
      return { producto, cantidad };
    });

    const venta: Venta = { id: nuevoId(), fecha: datos.fecha, metodo: datos.metodo, nota: datos.nota, total: 0, partidas: [], creadoEn: ahora() };
    for (const { producto, cantidad } of partidas) {
      producto.stock -= cantidad;
      venta.total += cantidad * producto.precioVenta;
      venta.partidas.push({ productoId: producto.id, productoNombre: producto.nombre, cantidad, precioUnitario: producto.precioVenta });
      this.db.movimientos.push({
        id: nuevoId(),
        productoId: producto.id,
        tipo: "venta",
        cantidad: -cantidad,
        ventaId: venta.id,
        precioUnitario: producto.precioVenta,
        nota: null,
        fecha: datos.fecha,
        creadoEn: venta.creadoEn,
      });
    }
    this.db.ventas.push(venta);
    return venta;
  }

  async listarEntre(desde: FechaISO, hasta: FechaISO) {
    return this.db.ventas
      .filter((v) => v.fecha >= desde && v.fecha <= hasta)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));
  }

  async sumarEntre(desde: FechaISO, hasta: FechaISO) {
    return (await this.listarEntre(desde, hasta)).reduce((t, v) => t + v.total, 0);
  }
}
