import type { MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import type { Pago } from "@/domain/entities/Pago";
import type { Plan } from "@/domain/entities/Plan";
import type { Producto } from "@/domain/entities/Producto";
import type { Socio } from "@/domain/entities/Socio";
import type { Suscripcion } from "@/domain/entities/Suscripcion";
import type { Venta } from "@/domain/entities/Venta";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import type {
  FilaMovimiento,
  FilaPago,
  FilaPlan,
  FilaProducto,
  FilaSocio,
  FilaSuscripcion,
  FilaVenta,
} from "../../supabase/tipos";

export const aSocio = (f: FilaSocio): Socio => ({
  id: f.id,
  nombre: f.nombre,
  apellidos: f.apellidos,
  telefono: f.telefono,
  fechaNacimiento: f.fecha_nacimiento,
  foto: f.foto,
  notas: f.notas,
  activo: f.activo,
  fechaBaja: f.fecha_baja,
  motivoBaja: f.motivo_baja,
  creadoEn: f.creado_en,
});

export const aPlan = (f: FilaPlan): Plan => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion,
  precio: Number(f.precio),
  duracion: f.duracion,
  unidad: f.unidad,
  activo: f.activo,
});

export const aSuscripcion = (f: FilaSuscripcion): Suscripcion => ({
  id: f.id,
  socioId: f.socio_id,
  planId: f.plan_id,
  planNombre: f.plan_nombre ?? f.planes?.nombre ?? "Plan",
  fechaInicio: f.fecha_inicio,
  fechaFin: f.fecha_fin,
  creadoEn: f.creado_en,
});

export const aPago = (f: FilaPago): Pago => ({
  id: f.id,
  socioId: f.socio_id,
  suscripcionId: f.suscripcion_id,
  monto: Number(f.monto),
  metodo: f.metodo,
  fecha: f.fecha,
  nota: f.nota,
  creadoEn: f.creado_en,
});

export const aProducto = (f: FilaProducto): Producto => ({
  id: f.id,
  nombre: f.nombre,
  categoria: f.categoria,
  codigo: f.codigo,
  precioVenta: Number(f.precio_venta),
  costo: f.costo === null ? null : Number(f.costo),
  stock: f.stock,
  stockMinimo: f.stock_minimo,
  activo: f.activo,
  creadoEn: f.creado_en,
});

export const aMovimiento = (f: FilaMovimiento): MovimientoInventario => ({
  id: f.id,
  productoId: f.producto_id,
  tipo: f.tipo,
  cantidad: f.cantidad,
  ventaId: f.venta_id,
  precioUnitario: f.precio_unitario === null ? null : Number(f.precio_unitario),
  nota: f.nota,
  fecha: f.fecha,
  creadoEn: f.creado_en,
});

export const aVenta = (f: FilaVenta): Venta => ({
  id: f.id,
  fecha: f.fecha,
  metodo: f.metodo,
  total: Number(f.total),
  nota: f.nota,
  creadoEn: f.creado_en,
  partidas: (f.movimientos_inventario ?? []).map((m) => ({
    productoId: m.producto_id,
    productoNombre: m.productos?.nombre ?? "Producto",
    cantidad: -m.cantidad,
    precioUnitario: Number(m.precio_unitario ?? 0),
  })),
});

/**
 * Convierte errores de Supabase en errores legibles.
 * - 23505 (valor duplicado) y los códigos GY… que lanzan nuestras funciones
 *   SQL son reglas de negocio: se muestran tal cual a la persona.
 */
export function verificar<T>(resultado: { data: T | null; error: { message: string; code?: string } | null }): T {
  const { error } = resultado;
  if (error) {
    if (error.code === "23505") throw new ErrorDeDominio("Ya existe un registro con esos datos (por ejemplo, el mismo código de producto).");
    if (error.code?.startsWith("GY")) throw new ErrorDeDominio(error.message);
    throw new Error(`Error de base de datos: ${error.message}`);
  }
  return resultado.data as T;
}
