/** Forma de las filas tal como vienen de la base de datos (snake_case). */
export interface FilaSocio {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  foto: string | null;
  notas: string | null;
  activo: boolean;
  fecha_baja: string | null;
  motivo_baja: string | null;
  creado_en: string;
}

export interface FilaPlan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  duracion: number;
  unidad: "dias" | "semanas" | "meses";
  activo: boolean;
}

export interface FilaSuscripcion {
  id: string;
  socio_id: string;
  plan_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  creado_en: string;
  plan_nombre?: string;
  planes?: { nombre: string } | null;
}

export interface FilaPago {
  id: string;
  socio_id: string;
  suscripcion_id: string | null;
  monto: number | string;
  metodo: "efectivo" | "transferencia" | "tarjeta";
  fecha: string;
  nota: string | null;
  creado_en: string;
}

export interface FilaProducto {
  id: string;
  nombre: string;
  categoria: "suplementos" | "bebidas" | "snacks" | "accesorios" | "ropa" | "otros";
  codigo: string | null;
  precio_venta: number | string;
  costo: number | string | null;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  creado_en: string;
}

export interface FilaMovimiento {
  id: string;
  producto_id: string;
  tipo: "entrada" | "venta" | "merma" | "ajuste";
  cantidad: number;
  venta_id: string | null;
  precio_unitario: number | string | null;
  nota: string | null;
  fecha: string;
  creado_en: string;
}

export interface FilaVenta {
  id: string;
  fecha: string;
  metodo: "efectivo" | "transferencia" | "tarjeta";
  total: number | string;
  nota: string | null;
  creado_en: string;
  movimientos_inventario?: {
    producto_id: string;
    cantidad: number;
    precio_unitario: number | string | null;
    productos: { nombre: string } | null;
  }[];
}
