import type { MovimientoInventario } from "@/domain/entities/MovimientoInventario";
import type { MetodoPago, Pago } from "@/domain/entities/Pago";
import { calcularFechaFin, type Plan } from "@/domain/entities/Plan";
import type { CategoriaProducto, Producto } from "@/domain/entities/Producto";
import type { Socio } from "@/domain/entities/Socio";
import type { Suscripcion } from "@/domain/entities/Suscripcion";
import type { Venta } from "@/domain/entities/Venta";
import { type FechaISO, hoyEn, sumarDias } from "@/domain/shared/fechas";
import { entorno } from "../../config/entorno";

/**
 * "Base de datos" en memoria para el MODO DEMO.
 * Se reinicia cada vez que se detiene el servidor de desarrollo.
 */
export interface AlmacenMemoria {
  socios: Socio[];
  planes: Plan[];
  suscripciones: Suscripcion[];
  pagos: Pago[];
  avisos: Set<string>;
  productos: Producto[];
  movimientos: MovimientoInventario[];
  ventas: Venta[];
}

const global = globalThis as unknown as { __almacenOlimpo?: AlmacenMemoria };

export function obtenerAlmacen(): AlmacenMemoria {
  global.__almacenOlimpo ??= crearDatosDeEjemplo(hoyEn(entorno.zonaHoraria));
  return global.__almacenOlimpo;
}

export const nuevoId = () => crypto.randomUUID();
export const ahora = () => new Date().toISOString();

function crearDatosDeEjemplo(hoy: FechaISO): AlmacenMemoria {
  const planes: Plan[] = [
    { id: nuevoId(), nombre: "Visita semanal", descripcion: "Acceso libre durante 7 días", precio: 180, duracion: 1, unidad: "semanas", activo: true },
    { id: nuevoId(), nombre: "Mensual", descripcion: "Acceso ilimitado a pesas y cardio", precio: 550, duracion: 1, unidad: "meses", activo: true },
    { id: nuevoId(), nombre: "Trimestral", descripcion: "Tres meses con precio preferente", precio: 1450, duracion: 3, unidad: "meses", activo: true },
    { id: nuevoId(), nombre: "Anual", descripcion: "Doce meses, el mejor precio por mes", precio: 5200, duracion: 12, unidad: "meses", activo: true },
  ];
  const [, mensual, trimestral, anual] = planes;

  // [nombre, apellidos, correo, celular, días para vencer (null = sin plan), plan, baja?]
  const personas: [string, string, string | null, string | null, number | null, Plan, { dias: number; motivo: string }?][] = [
    ["Mariana", "López Herrera", "mariana.lopez@ejemplo.com", "5512345678", 1, mensual],
    ["Jorge", "Ramírez Soto", "jorge.ramirez@ejemplo.com", "5587654321", 3, mensual],
    ["Daniela", "Cruz Méndez", null, "3311223344", 6, trimestral],
    ["Luis Fernando", "Ortega Ruiz", "luisf.ortega@ejemplo.com", "8122334455", 19, mensual],
    ["Andrea", "Villalobos Paz", "andrea.vp@ejemplo.com", "5599887766", 64, trimestral],
    ["Héctor", "Salinas Rivera", "hector.salinas@ejemplo.com", "5533445566", 241, anual],
    ["Valeria", "Montes Ibarra", "valeria.montes@ejemplo.com", "5576543210", 12, mensual],
    ["Ricardo", "Núñez Aguilar", "ricardo.nunez@ejemplo.com", "5544332211", -4, mensual],
    ["Sofía", "Guerrero Lara", null, "4421122334", -13, mensual],
    ["Emilio", "Treviño Castro", "emilio.trevino@ejemplo.com", "5566778899", null, mensual],
    ["Paola", "Esquivel Rangel", "paola.esquivel@ejemplo.com", "5522113344", -40, mensual, { dias: 35, motivo: "Cambio de domicilio o de trabajo" }],
    ["Arturo", "Beltrán Ochoa", null, "5588990011", -70, trimestral, { dias: 60, motivo: "Motivos económicos" }],
  ];

  const socios: Socio[] = [];
  const suscripciones: Suscripcion[] = [];
  const pagos: Pago[] = [];

  for (const [nombre, apellidos, email, telefono, diasParaVencer, plan, baja] of personas) {
    const socio: Socio = {
      id: nuevoId(),
      nombre,
      apellidos,
      email,
      telefono,
      notas: null,
      activo: !baja,
      fechaBaja: baja ? sumarDias(hoy, -baja.dias) : null,
      motivoBaja: baja?.motivo ?? null,
      creadoEn: ahora(),
    };
    socios.push(socio);
    if (diasParaVencer === null) continue;

    // Buscamos la fecha de inicio que hace que el plan termine en la fecha deseada.
    const fechaFinDeseada = sumarDias(hoy, diasParaVencer);
    let fechaInicio = sumarDias(fechaFinDeseada, -400);
    while (calcularFechaFin(fechaInicio, plan) < fechaFinDeseada) fechaInicio = sumarDias(fechaInicio, 1);
    socio.creadoEn = `${fechaInicio}T16:00:00.000Z`;

    const suscripcion: Suscripcion = {
      id: nuevoId(),
      socioId: socio.id,
      planId: plan.id,
      planNombre: plan.nombre,
      fechaInicio,
      fechaFin: calcularFechaFin(fechaInicio, plan),
      creadoEn: ahora(),
    };
    suscripciones.push(suscripcion);
    pagos.push({
      id: nuevoId(),
      socioId: socio.id,
      suscripcionId: suscripcion.id,
      monto: plan.precio,
      metodo: telefono?.startsWith("55") ? "efectivo" : "transferencia",
      fecha: fechaInicio,
      nota: null,
      creadoEn: ahora(),
    });
  }

  const { productos, movimientos, ventas } = inventarioDeEjemplo(hoy);
  return { socios, planes, suscripciones, pagos, avisos: new Set(), productos, movimientos, ventas };
}

function inventarioDeEjemplo(hoy: FechaISO) {
  // [nombre, categoría, código, precio, costo, stock que debe quedar, stock mínimo]
  const catalogo: [string, CategoriaProducto, string | null, number, number | null, number, number][] = [
    ["Proteína whey 2 lb, vainilla", "suplementos", "7501000111", 899, 620, 7, 3],
    ["Proteína whey 2 lb, chocolate", "suplementos", "7501000112", 899, 620, 2, 3],
    ["Creatina monohidratada 300 g", "suplementos", "7501000120", 549, 360, 9, 4],
    ["Pre-entreno 30 porciones", "suplementos", "7501000130", 650, 430, 0, 2],
    ["BCAA 250 g", "suplementos", null, 480, 300, 5, 2],
    ["Agua natural 1 L", "bebidas", "7502000010", 20, 9, 38, 24],
    ["Bebida isotónica 600 ml", "bebidas", "7502000020", 28, 15, 11, 12],
    ["Bebida energética 473 ml", "bebidas", "7502000030", 38, 22, 16, 10],
    ["Barra de proteína", "snacks", "7503000010", 45, 26, 6, 10],
    ["Shaker 600 ml", "accesorios", null, 150, 70, 12, 4],
    ["Guantes de entrenamiento", "accesorios", null, 320, 180, 5, 2],
    ["Toalla deportiva", "accesorios", null, 120, 55, 8, 3],
    ["Playera Olimpo GYM", "ropa", null, 280, 130, 14, 5],
  ];

  const productos: Producto[] = catalogo.map(([nombre, categoria, codigo, precioVenta, costo, , stockMinimo]) => ({
    id: nuevoId(),
    nombre,
    categoria,
    codigo,
    precioVenta,
    costo,
    stock: 0,
    stockMinimo,
    activo: true,
    creadoEn: ahora(),
  }));
  const p = (i: number) => productos[i];

  // [días atrás, método, [índice del producto, cantidad][]]
  const historial: [number, MetodoPago, [number, number][]][] = [
    [14, "efectivo", [[0, 1], [9, 1]]],
    [12, "tarjeta", [[2, 1]]],
    [10, "efectivo", [[5, 4], [6, 2]]],
    [9, "transferencia", [[1, 2]]],
    [7, "efectivo", [[8, 3], [5, 2]]],
    [6, "tarjeta", [[3, 2], [10, 1]]],
    [5, "efectivo", [[6, 3], [7, 2]]],
    [3, "efectivo", [[5, 6]]],
    [2, "tarjeta", [[4, 1], [8, 2]]],
    [1, "efectivo", [[12, 1], [5, 3]]],
    [0, "efectivo", [[5, 2], [6, 1]]],
    [0, "tarjeta", [[0, 1], [9, 1]]],
    [0, "efectivo", [[8, 1], [7, 1]]],
  ];

  const vendidas = new Map<number, number>();
  for (const [, , partidas] of historial) for (const [i, n] of partidas) vendidas.set(i, (vendidas.get(i) ?? 0) + n);

  const movimientos: MovimientoInventario[] = [];
  const ventas: Venta[] = [];

  // Entrada inicial: lo que queda hoy más todo lo que se vendió.
  catalogo.forEach(([, , , , , stockFinal], i) => {
    const cantidad = stockFinal + (vendidas.get(i) ?? 0);
    if (cantidad === 0) return;
    p(i).stock = cantidad;
    movimientos.push(movimiento(p(i).id, "entrada", cantidad, sumarDias(hoy, -20), { nota: "Inventario inicial" }));
  });

  historial.forEach(([diasAtras, metodo, partidas], n) => {
    const fecha = sumarDias(hoy, -diasAtras);
    // Hora de ejemplo entre 7:00 y 13:59 (hora del centro de México).
    const hora = `${String(7 + ((n * 5) % 7)).padStart(2, "0")}:${String((n * 17) % 60).padStart(2, "0")}`;
    const creadoEn = new Date(`${fecha}T${hora}:00-06:00`).toISOString();
    const venta: Venta = { id: nuevoId(), fecha, metodo, total: 0, nota: null, partidas: [], creadoEn };
    for (const [i, cantidad] of partidas) {
      const producto = p(i);
      producto.stock -= cantidad;
      venta.partidas.push({ productoId: producto.id, productoNombre: producto.nombre, cantidad, precioUnitario: producto.precioVenta });
      venta.total += cantidad * producto.precioVenta;
      movimientos.push(movimiento(producto.id, "venta", -cantidad, fecha, { ventaId: venta.id, precioUnitario: producto.precioVenta }));
    }
    ventas.push(venta);
  });

  return { productos, movimientos, ventas };
}

function movimiento(
  productoId: string,
  tipo: MovimientoInventario["tipo"],
  cantidad: number,
  fecha: FechaISO,
  extra: Partial<Pick<MovimientoInventario, "nota" | "ventaId" | "precioUnitario">> = {},
): MovimientoInventario {
  return { id: nuevoId(), productoId, tipo, cantidad, fecha, ventaId: null, precioUnitario: null, nota: null, creadoEn: ahora(), ...extra };
}
