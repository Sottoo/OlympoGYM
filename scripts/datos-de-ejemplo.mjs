/**
 * Crea una base de datos NUEVA con datos de ejemplo para ver el programa "en uso".
 *
 *   node scripts/datos-de-ejemplo.mjs <carpeta de datos>
 *
 * La carpeta debe NO tener olimpo.db (el script se niega a escribir sobre una
 * base existente). Cuentas que crea:
 *   admin     / Olimpo2026     (administración)
 *   recepcion / Recepcion2026  (recepción)
 */
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRACIONES } from "../src/infrastructure/sqlite/esquema.ts";

const carpeta = process.argv[2];
if (!carpeta) {
  console.error("Uso: node scripts/datos-de-ejemplo.mjs <carpeta de datos>");
  process.exit(1);
}
const archivo = path.join(carpeta, "olimpo.db");
if (existsSync(archivo)) {
  console.error(`Ya existe ${archivo}. Muévela antes; este script no escribe sobre una base existente.`);
  process.exit(1);
}
mkdirSync(path.join(carpeta, "fotos"), { recursive: true });

/* ── Utilidades ───────────────────────────────────────────────────────── */
let semilla = 20261103;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const id = () => randomUUID();
const cifrar = (s) => {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString("hex")}$${scryptSync(s, sal, 64).toString("hex")}`;
};

const ZONA = "America/Mexico_City";
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dia = (n) => {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const sumarMeses = (fecha, meses) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  const diaDelMes = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(diaDelMes, ultimo));
  return d.toISOString().slice(0, 10);
};
const sumarDias = (fecha, n) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Instante ISO (UTC) de una fecha y hora de Ciudad de México (UTC-6). */
const instante = (fecha, hora, minuto = 0) => new Date(`${fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00-06:00`).toISOString();
const metodo = () => elegir(["efectivo", "efectivo", "efectivo", "transferencia", "tarjeta"]);

/* ── Base nueva con la estructura del programa ────────────────────────── */
const db = new DatabaseSync(archivo);
db.exec("pragma journal_mode = wal; pragma foreign_keys = on;");
MIGRACIONES.forEach((sql, i) => {
  db.exec(sql);
  db.exec(`pragma user_version = ${i + 1}`);
});

// La bitácora no se puede borrar; para no llenarla con miles de altas de
// ejemplo, se quita ese candado un momento y se vacía al final.
const candado = db.prepare("select sql from sqlite_master where name = 'bitacora_no_se_borra'").get().sql;
db.exec("drop trigger bitacora_no_se_borra");

const ins = (sql, ...p) => db.prepare(sql).run(...p);
db.exec("begin");
ins("update contexto set usuario = 'Administrador' where id = 1");

/* ── Cuentas ──────────────────────────────────────────────────────────── */
const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codigo = [...randomBytes(16)].map((b) => letras[b % letras.length]).join("").match(/.{4}/g).join("-");
ins("insert into personal (id, nombre, usuario, contrasena, rol, creado_en) values (?, 'Administrador', 'admin', ?, 'administrador', ?)", id(), cifrar("Olimpo2026"), instante(dia(-180), 9));
ins("insert into personal (id, nombre, usuario, contrasena, rol, creado_en) values (?, 'Laura Méndez', 'recepcion', ?, 'recepcion', ?)", id(), cifrar("Recepcion2026"), instante(dia(-170), 9));
ins("insert into ajustes (clave, valor) values ('codigo_recuperacion', ?)", cifrar(codigo.replace(/[^A-Z0-9]/g, "")));

/* ── Planes ───────────────────────────────────────────────────────────── */
const planes = {
  visita: { id: id(), nombre: "Visita", descripcion: "Acceso por un día", precio: 60, duracion: 1, unidad: "dias" },
  semana: { id: id(), nombre: "Semana", descripcion: "Siete días de acceso", precio: 200, duracion: 1, unidad: "semanas" },
  mes: { id: id(), nombre: "Mensualidad", descripcion: "Acceso completo, todos los horarios", precio: 500, duracion: 1, unidad: "meses" },
  estudiante: { id: id(), nombre: "Estudiante", descripcion: "Con credencial vigente", precio: 400, duracion: 1, unidad: "meses" },
  trimestre: { id: id(), nombre: "Trimestre", descripcion: "Tres meses con descuento", precio: 1350, duracion: 3, unidad: "meses" },
};
for (const p of Object.values(planes)) {
  ins("insert into planes (id, nombre, descripcion, precio, duracion, unidad, creado_en) values (?, ?, ?, ?, ?, ?, ?)", p.id, p.nombre, p.descripcion, p.precio, p.duracion, p.unidad, instante(dia(-180), 10));
}

/* ── Socios, membresías, pagos y asistencias ─────────────────────────── */
const nombres = [
  ["José Luis", "Hernández García"], ["María Fernanda", "López Martínez"], ["Carlos", "Ramírez Torres"], ["Ana Sofía", "González Pérez"],
  ["Miguel Ángel", "Sánchez Flores"], ["Daniela", "Rodríguez Cruz"], ["Jorge", "Morales Reyes"], ["Valeria", "Jiménez Ortiz"],
  ["Luis Fernando", "Castillo Vargas"], ["Andrea", "Ruiz Mendoza"], ["Ricardo", "Aguilar Romero"], ["Paola", "Gutiérrez Silva"],
  ["Alejandro", "Chávez Navarro"], ["Mariana", "Domínguez Ríos"], ["Eduardo", "Vázquez Herrera"], ["Karla", "Medina Castro"],
  ["Fernando", "Rojas Guerrero"], ["Ximena", "Salazar Luna"], ["Roberto", "Delgado Campos"], ["Fátima", "Estrada Vega"],
  ["Héctor", "Ortega Molina"], ["Gabriela", "Núñez Cabrera"], ["Diego", "Ibarra Fuentes"], ["Natalia", "Cortés Ávila"],
  ["Óscar", "Pacheco Lara"], ["Itzel", "Montes Sandoval"], ["Iván", "Miranda Bautista"], ["Regina", "Carrillo Soto"],
  ["Emiliano", "Velázquez Peña"], ["Lucía", "Ponce Acosta"], ["Arturo", "Rivas Zamora"], ["Camila", "Espinoza Trejo"],
  ["Sergio", "Valdez Juárez"], ["Renata", "Mejía Robles"], ["Raúl", "Figueroa Arellano"], ["Brenda", "Cervantes Ochoa"],
  ["Adrián", "Lozano Beltrán"], ["Montserrat", "Galván Rosales"], ["Hugo", "Escobar Villalobos"], ["Diana", "Solís Marín"],
  ["Pablo", "Carmona Duarte"], ["Alondra", "Tapia Garza"],
];
const notas = [null, null, null, null, "Lesión de rodilla, evitar sentadilla profunda", "Viene con su hermano", "Prefiere horario matutino", "Entrena para maratón"];

let socios = 0, membresias = 0, pagos = 0, entradas = 0;
nombres.forEach(([nombre, apellidos], i) => {
  const socioId = id();
  // Perfiles: la mayoría al corriente; algunos por vencer, vencidos o dados de baja.
  const perfil = i < 4 ? "por_vencer" : i < 9 ? "vencido" : i < 11 ? "baja" : "activo";
  const plan = i % 7 === 0 ? planes.trimestre : i % 5 === 0 ? planes.estudiante : planes.mes;
  // Se parte de cuándo termina su última membresía y se cuenta hacia atrás.
  const finObjetivo = perfil === "por_vencer" ? dia(entre(1, 6)) : perfil === "vencido" ? dia(-entre(3, 25)) : perfil === "baja" ? dia(-entre(31, 60)) : dia(entre(8, 27));
  const cuantas = plan === planes.trimestre ? entre(1, 2) : entre(1, 6);
  const alta = sumarMeses(sumarDias(finObjetivo, 1), -cuantas * plan.duracion);
  const periodos = Array.from({ length: cuantas }, (_, j) => [sumarMeses(alta, j * plan.duracion), sumarDias(sumarMeses(alta, (j + 1) * plan.duracion), -1)]);
  const nacimiento = `${entre(1975, 2007)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`;
  const telefono = `55 ${entre(1000, 9999)} ${entre(1000, 9999)}`;
  ins(
    `insert into socios (id, numero, nombre, apellidos, telefono, fecha_nacimiento, notas, activo, fecha_baja, motivo_baja, creado_en)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    socioId, i + 1, nombre, apellidos, telefono, nacimiento, elegir(notas),
    perfil === "baja" ? 0 : 1, perfil === "baja" ? dia(-entre(10, 30)) : null, perfil === "baja" ? elegir(["Se cambió de ciudad", "Motivos económicos"]) : null,
    instante(alta, entre(7, 20), entre(0, 59)),
  );
  socios++;

  for (const [ini, f] of periodos) {
    const susId = id();
    ins("insert into suscripciones (id, socio_id, plan_id, fecha_inicio, fecha_fin, creado_en) values (?, ?, ?, ?, ?, ?)", susId, socioId, plan.id, ini, f, instante(ini, entre(7, 20)));
    ins("insert into pagos (id, socio_id, suscripcion_id, monto, metodo, fecha, creado_en) values (?, ?, ?, ?, ?, ?, ?)", id(), socioId, susId, plan.precio, metodo(), ini, instante(ini, entre(7, 20)));
    membresias++;
    pagos++;
  }

  // Asistencias: mientras su membresía estaba vigente, 2 a 5 veces por semana.
  const frecuencia = entre(30, 75) / 100;
  const horaFavorita = elegir([6, 7, 8, 13, 18, 19, 20]);
  for (const [ini, f] of periodos) {
    for (let d = ini; d <= f && d <= HOY; d = sumarDias(d, 1)) {
      if (d < dia(-90) || azar() > frecuencia) continue;
      if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0 && azar() < 0.7) continue; // domingo
      ins("insert into asistencias (id, socio_id, fecha, registrada_en) values (?, ?, ?, ?)", id(), socioId, d, instante(d, Math.min(21, horaFavorita + entre(-1, 1)), entre(0, 59)));
      entradas++;
    }
  }
});

// Visitantes de un día (los últimos 2 de la lista).
for (let i = 0; i < 6; i++) {
  const socioId = id();
  const fecha = dia(-entre(0, 20));
  ins("insert into socios (id, numero, nombre, apellidos, telefono, creado_en) values (?, ?, ?, ?, ?, ?)", socioId, nombres.length + i + 1, elegir(["Tomás", "Elena", "Rubén", "Sara", "Mauricio", "Julia"]), elegir(["Ramos Vidal", "Ponce Lira", "Ochoa Bravo"]), "", instante(fecha, 18));
  const susId = id();
  ins("insert into suscripciones (id, socio_id, plan_id, fecha_inicio, fecha_fin, creado_en) values (?, ?, ?, ?, ?, ?)", susId, socioId, planes.visita.id, fecha, fecha, instante(fecha, 18));
  ins("insert into pagos (id, socio_id, suscripcion_id, monto, metodo, fecha, creado_en) values (?, ?, ?, ?, ?, ?, ?)", id(), socioId, susId, 60, "efectivo", fecha, instante(fecha, 18));
  ins("insert into asistencias (id, socio_id, fecha, registrada_en) values (?, ?, ?, ?)", id(), socioId, fecha, instante(fecha, 18, 5));
  socios++; membresias++; pagos++; entradas++;
}

/* ── Productos, compras y ventas ──────────────────────────────────────── */
const productos = [
  { nombre: "Agua natural 1 L", categoria: "bebidas", codigo: "7501055300", precio: 18, costo: 9, minimo: 24, compra: 96, ritmo: 4 },
  { nombre: "Electrolit 625 ml", categoria: "bebidas", codigo: "7501125100", precio: 35, costo: 22, minimo: 12, compra: 48, ritmo: 2 },
  { nombre: "Bebida isotónica 1 L", categoria: "bebidas", codigo: "7501031311", precio: 32, costo: 19, minimo: 12, compra: 36, ritmo: 1.2 },
  { nombre: "Barra de proteína", categoria: "snacks", codigo: "0850104008", precio: 45, costo: 27, minimo: 10, compra: 40, ritmo: 1.5 },
  { nombre: "Cacahuates japoneses", categoria: "snacks", codigo: null, precio: 20, costo: 10, minimo: 10, compra: 30, ritmo: 0.6 },
  { nombre: "Pre-entreno (sobre)", categoria: "suplementos", codigo: null, precio: 30, costo: 15, minimo: 10, compra: 30, ritmo: 0.7 },
  { nombre: "Shaker 600 ml", categoria: "accesorios", codigo: "SHK-600", precio: 120, costo: 55, minimo: 4, compra: 12, ritmo: 0.15 },
  { nombre: "Guantes de entrenamiento", categoria: "accesorios", codigo: "GNT-M", precio: 250, costo: 130, minimo: 3, compra: 8, ritmo: 0.08 },
  { nombre: "Toalla Olimpo", categoria: "ropa", codigo: "TOA-01", precio: 150, costo: 70, minimo: 4, compra: 15, ritmo: 0.12 },
  { nombre: "Playera Olimpo", categoria: "ropa", codigo: "PLY-M", precio: 220, costo: 95, minimo: 5, compra: 12, ritmo: 0.2 },
  { nombre: "Candado para locker", categoria: "otros", codigo: null, precio: 90, costo: 45, minimo: 3, compra: 10, ritmo: 0.05 },
  { nombre: "Proteína whey chocolate", categoria: "suplementos", codigo: "WHEY-CH", precio: 35, costo: 1400, minimo: 900, granel: { porcion: 30, nombre: "scoop", envase: 2270 }, compra: 2, ritmo: 2.2 },
  { nombre: "Creatina monohidratada", categoria: "suplementos", codigo: "CREA-300", precio: 15, costo: 520, minimo: 100, granel: { porcion: 5, nombre: "servicio", envase: 300 }, compra: 2, ritmo: 1.6 },
];
const ventasPorDia = new Map();
let totalVentas = 0;
for (const p of productos) {
  p.id = id();
  const g = p.granel;
  ins(
    `insert into productos (id, nombre, categoria, codigo, precio_venta, costo, stock_minimo, unidad, porcion_gramos, porcion_nombre, envase_gramos, creado_en)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id, p.nombre, p.categoria, p.codigo, p.precio, p.costo, p.minimo, g ? "gramo" : "pieza", g?.porcion ?? null, g?.nombre ?? null, g?.envase ?? null, instante(dia(-90), 10),
  );
  const unidadCompra = g ? g.envase : 1;
  const porVenta = g ? g.porcion : 1;
  let stock = 0;
  const entrada = (fecha, piezas, nota) => {
    const cantidad = piezas * unidadCompra;
    stock += cantidad;
    ins("insert into movimientos_inventario (id, producto_id, tipo, cantidad, nota, fecha, creado_en) values (?, ?, 'entrada', ?, ?, ?, ?)", id(), p.id, cantidad, nota, fecha, instante(fecha, 9));
  };
  entrada(dia(-90), p.compra, "Inventario inicial");
  for (let d = -89; d <= 0; d++) {
    const fecha = dia(d);
    // Resurtido cuando baja del mínimo (salvo los últimos días: así se ven productos por surtir).
    if (stock < p.minimo + porVenta * 3 && d < -6) entrada(fecha, p.compra, "Compra al proveedor");
    let vendidas = Math.floor(p.ritmo) + (azar() < p.ritmo % 1 ? 1 : 0);
    if (azar() < 0.3) vendidas += entre(-1, 1);
    for (let k = 0; k < vendidas; k++) {
      const cantidad = porVenta * (g ? entre(1, 2) : 1);
      if (stock < cantidad) break;
      stock -= cantidad;
      const lista = ventasPorDia.get(fecha) ?? [];
      lista.push({ p, cantidad });
      ventasPorDia.set(fecha, lista);
    }
  }
  ins("update productos set stock = ? where id = ?", stock, p.id);
}
// Agrupa las partidas de cada día en tickets de 1 a 3 productos.
for (const [fecha, partidas] of ventasPorDia) {
  partidas.sort(() => azar() - 0.5);
  while (partidas.length) {
    const ticket = partidas.splice(0, entre(1, 3));
    const ventaId = id();
    const total = Math.round(ticket.reduce((s, { p, cantidad }) => s + cantidad * (p.granel ? p.precio / p.granel.porcion : p.precio), 0) * 100) / 100;
    const creado = instante(fecha, entre(7, 21), entre(0, 59));
    ins("insert into ventas (id, fecha, metodo, total, creado_en) values (?, ?, ?, ?, ?)", ventaId, fecha, metodo(), total, creado);
    for (const { p, cantidad } of ticket) {
      ins(
        "insert into movimientos_inventario (id, producto_id, tipo, cantidad, venta_id, precio_unitario, fecha, creado_en) values (?, ?, 'venta', ?, ?, ?, ?, ?)",
        id(), p.id, -cantidad, ventaId, p.granel ? p.precio / p.granel.porcion : p.precio, fecha, creado,
      );
    }
    totalVentas++;
  }
}
// Una merma para que se vea en el historial.
const agua = productos[0];
ins("insert into movimientos_inventario (id, producto_id, tipo, cantidad, nota, fecha, creado_en) values (?, ?, 'merma', -2, 'Botellas dañadas', ?, ?)", id(), agua.id, dia(-12), instante(dia(-12), 11));
ins("update productos set stock = max(0, stock - 2) where id = ?", agua.id);

/* ── Equipos y mantenimiento ──────────────────────────────────────────── */
const equipos = [
  ["Caminadora 1", "cardio", "Life Fitness", "T5", 3], ["Caminadora 2", "cardio", "Life Fitness", "T5", 3], ["Bicicleta fija", "cardio", "Matrix", "U30", 6],
  ["Elíptica", "cardio", "Precor", "EFX 635", 6], ["Prensa de pierna", "fuerza", "Hammer Strength", "Linear", 6], ["Poleas cruzadas", "fuerza", "Body-Solid", "GDCC210", 4],
  ["Rack de sentadilla", "peso_libre", "Rogue", "R-3", 12], ["Juego de mancuernas 2–40 kg", "peso_libre", null, null, 12], ["Aire acondicionado", "instalaciones", "Mirage", "Magnum 24", 6],
].map(([nombre, area, marca, modelo, frecuencia]) => {
  const equipoId = id();
  ins(
    "insert into equipos (id, nombre, area, marca, modelo, fecha_compra, frecuencia_meses, servicio_base, creado_en) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    // servicio_base: fecha del último servicio hecho antes de usar el programa.
    equipoId, nombre, area, marca, modelo, dia(-entre(200, 900)), frecuencia, azar() < 0.6 ? dia(-entre(20, 200)) : null, instante(dia(-120), 10),
  );
  return { id: equipoId, nombre, frecuencia };
});
const servicio = (equipo, fecha, tipo, descripcion, manoDeObra, refacciones, pagado) => {
  const mId = id();
  const total = manoDeObra + refacciones;
  ins(
    "insert into mantenimientos (id, equipo_id, fecha, tipo, descripcion, proveedor, mano_de_obra, refacciones, total, creado_en) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    mId, equipo.id, fecha, tipo, descripcion, "Servifit Técnicos", manoDeObra, refacciones, total, instante(fecha, 12),
  );
  if (pagado > 0) ins("insert into abonos_mantenimiento (id, mantenimiento_id, monto, metodo, fecha, creado_en) values (?, ?, ?, ?, ?, ?)", id(), mId, pagado, "transferencia", fecha, instante(fecha, 12));
  return mId;
};
servicio(equipos[0], dia(-75), "preventivo", "Lubricación de banda y calibración", 650, 0, 650);
servicio(equipos[1], dia(-100), "preventivo", "Lubricación de banda y calibración", 650, 0, 650); // ya le toca
servicio(equipos[4], dia(-40), "correctivo", "Cambio de rodamientos del carro", 900, 1450, 1200); // con saldo pendiente
servicio(equipos[8], dia(-20), "preventivo", "Limpieza de filtros y carga de gas", 1200, 800, 2000);
servicio(equipos[5], dia(-60), "correctivo", "Cambio de cable de acero", 500, 680, 1180);
ins(
  "insert into reportes_falla (id, equipo_id, descripcion, fuera_de_servicio, reportado_por, reportado_en) values (?, ?, ?, 1, 'Laura Méndez', ?)",
  id(), equipos[3].id, "Hace ruido metálico al pedalear y se traba la resistencia", instante(dia(-2), 19),
);
ins(
  "insert into reportes_falla (id, equipo_id, descripcion, fuera_de_servicio, reportado_por, reportado_en) values (?, ?, ?, 0, 'Laura Méndez', ?)",
  id(), equipos[2].id, "La pantalla no enciende, pero la bici funciona", instante(dia(-5), 8),
);

/* ── Cierre: bitácora vacía y su candado de vuelta ────────────────────── */
ins("update contexto set usuario = null where id = 1");
db.exec("delete from bitacora");
db.exec(candado);
db.exec("commit");
db.exec("pragma wal_checkpoint(truncate)");
db.close();

console.log(`Base de ejemplo creada en ${archivo}
  ${socios} socios · ${membresias} membresías · ${pagos} pagos · ${entradas} entradas
  ${productos.length} productos · ${totalVentas} ventas · ${equipos.length} equipos

  Administración:  usuario admin      contraseña Olimpo2026
  Recepción:       usuario recepcion  contraseña Recepcion2026
  Código de recuperación: ${codigo}`);
