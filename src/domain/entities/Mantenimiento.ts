import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { diasEntre, esFechaValida, type FechaISO, sumarDias, sumarMeses } from "../shared/fechas";
import { LIMITES, limpiarEspacios, revisarDinero, revisarEntero } from "../shared/reglas";
import { METODOS_PAGO, type MetodoPago } from "./Pago";

/**
 * Mantenimiento de las máquinas del gimnasio.
 *
 *  · Equipo: cada máquina o instalación (Caminadora 1, Prensa, Regaderas…).
 *    Puede tener cada cuántos meses le toca servicio preventivo.
 *  · Mantenimiento: lo que se le hizo un día (preventivo o reparación), quién
 *    lo hizo y cuánto costó (mano de obra + refacciones).
 *  · Abono: lo que se le ha pagado al técnico por ese mantenimiento. Puede
 *    pagarse completo, dejar anticipo o quedar a deber. Lo pagado en efectivo
 *    sale de la caja de ese día.
 *  · Reporte de falla: recepción avisa que una máquina falla; queda abierto
 *    hasta que la administración lo arregla (o lo cierra).
 */

export type AreaEquipo = "cardio" | "fuerza" | "peso_libre" | "instalaciones" | "otro";

export const AREAS_EQUIPO: Record<AreaEquipo, string> = {
  cardio: "Cardio",
  fuerza: "Máquinas de fuerza",
  peso_libre: "Peso libre",
  instalaciones: "Instalaciones",
  otro: "Otro",
};

export interface Equipo {
  id: string;
  nombre: string;
  area: AreaEquipo;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  fechaCompra: FechaISO | null;
  /** Cada cuántos meses le toca preventivo (null: sin programa). */
  frecuenciaMeses: number | null;
  /** Último servicio conocido antes de usar el programa (para calcular el siguiente). */
  servicioBase: FechaISO | null;
  nota: string | null;
  activo: boolean;
  creadoEn: string;
}

export type DatosEquipo = Omit<Equipo, "id" | "activo" | "creadoEn">;

export type TipoMantenimiento = "preventivo" | "correctivo";

export const TIPOS_MANTENIMIENTO: Record<TipoMantenimiento, string> = {
  preventivo: "Preventivo",
  correctivo: "Reparación",
};

export interface Mantenimiento {
  id: string;
  equipoId: string;
  equipoNombre: string;
  /** La máquina se eliminó: su historial se conserva, pero ya no tiene ficha. */
  equipoEliminado: boolean;
  fecha: FechaISO;
  tipo: TipoMantenimiento;
  descripcion: string;
  /** Técnico o empresa que lo hizo. */
  proveedor: string | null;
  manoDeObra: number;
  refacciones: number;
  total: number;
  /** Suma de lo abonado. */
  pagado: number;
  nota: string | null;
  creadoEn: string;
}

export interface DatosMantenimiento {
  equipoId: string;
  fecha: FechaISO;
  tipo: TipoMantenimiento;
  descripcion: string;
  proveedor: string | null;
  manoDeObra: number;
  refacciones: number;
  nota: string | null;
}

export interface Abono {
  id: string;
  mantenimientoId: string;
  monto: number;
  metodo: MetodoPago;
  fecha: FechaISO;
  nota: string | null;
  creadoEn: string;
}

export type DatosAbono = Omit<Abono, "id" | "creadoEn">;

/** Un pago a técnico con lo necesario para el corte de caja y los reportes. */
export interface AbonoConDetalle extends Abono {
  equipoId: string;
  equipoNombre: string;
  descripcion: string;
  proveedor: string | null;
}

export interface ReporteFalla {
  id: string;
  equipoId: string;
  equipoNombre: string;
  descripcion: string;
  /** Si ya no se puede usar la máquina. */
  fueraDeServicio: boolean;
  reportadoPor: string | null;
  reportadoEn: string;
  atendidoEn: string | null;
  /** Mantenimiento que la arregló (si se cerró con uno). */
  mantenimientoId: string | null;
  /** Por qué se cerró sin mantenimiento ("ya funciona", "no era falla"…). */
  cierre: string | null;
}

export interface DatosReporte {
  equipoId: string;
  descripcion: string;
  fueraDeServicio: boolean;
}

/* ── Estado de cada máquina ─────────────────────────────────────────── */

export type EstadoEquipo = "funcionando" | "con_falla" | "fuera_de_servicio" | "de_baja";

export const ESTADOS_EQUIPO: Record<EstadoEquipo, string> = {
  funcionando: "Funcionando",
  con_falla: "Con falla",
  fuera_de_servicio: "Fuera de servicio",
  de_baja: "Dado de baja",
};

export function estadoDeEquipo(equipo: Pick<Equipo, "activo">, reportesAbiertos: Pick<ReporteFalla, "fueraDeServicio">[]): EstadoEquipo {
  if (!equipo.activo) return "de_baja";
  if (reportesAbiertos.some((r) => r.fueraDeServicio)) return "fuera_de_servicio";
  return reportesAbiertos.length > 0 ? "con_falla" : "funcionando";
}

/** Con cuántos días de anticipación se avisa que viene un preventivo. */
export const AVISO_PREVENTIVO_DIAS = 14;

export type Preventivo =
  | { estado: "sin_programa" }
  | { estado: "al_dia" | "pronto" | "vencido"; proximo: FechaISO; dias: number };

/**
 * Cuándo le toca el siguiente preventivo: el último preventivo registrado (o
 * el servicio previo que se anotó al darlo de alta, o su fecha de alta) más su
 * frecuencia. Las reparaciones no cuentan: arreglar algo no es darle servicio.
 */
export function proximoPreventivo(
  equipo: Pick<Equipo, "frecuenciaMeses" | "servicioBase" | "activo">,
  ultimoPreventivo: FechaISO | null,
  fechaDeAlta: FechaISO,
  hoy: FechaISO,
): Preventivo {
  if (!equipo.activo || !equipo.frecuenciaMeses) return { estado: "sin_programa" };
  const candidatos = [ultimoPreventivo, equipo.servicioBase].filter((f): f is FechaISO => Boolean(f));
  const base = candidatos.length ? candidatos.sort().at(-1)! : fechaDeAlta;
  const proximo = sumarMeses(base, equipo.frecuenciaMeses);
  const dias = diasEntre(hoy, proximo);
  return { estado: dias < 0 ? "vencido" : dias <= AVISO_PREVENTIVO_DIAS ? "pronto" : "al_dia", proximo, dias };
}

/** "cada mes", "cada 3 meses", "cada año". */
export function describirFrecuencia(meses: number | null): string {
  if (!meses) return "Sin programa";
  if (meses === 12) return "Cada año";
  if (meses === 1) return "Cada mes";
  return `Cada ${meses} meses`;
}

/* ── Estado del pago de un mantenimiento ────────────────────────────── */

export type EstadoPago = "sin_costo" | "pagado" | "parcial" | "por_pagar";

export const ESTADOS_PAGO: Record<EstadoPago, string> = {
  sin_costo: "Sin costo",
  pagado: "Pagado",
  parcial: "Con anticipo",
  por_pagar: "Por pagar",
};

const centavos = (x: number) => Math.round(x * 100) / 100;

export function saldoDe(m: Pick<Mantenimiento, "total" | "pagado">): number {
  return Math.max(0, centavos(m.total - m.pagado));
}

export function estadoDePago(m: Pick<Mantenimiento, "total" | "pagado">): EstadoPago {
  if (m.total <= 0) return "sin_costo";
  if (saldoDe(m) === 0) return "pagado";
  return m.pagado > 0 ? "parcial" : "por_pagar";
}

/* ── Validaciones ───────────────────────────────────────────────────── */

export const LIMITES_MANTENIMIENTO = {
  nombreEquipo: 50,
  marca: 40,
  serie: 40,
  descripcion: 300,
  proveedor: 60,
  reporte: 200,
  frecuenciaMaxima: 24,
  /** Hasta cuántos años atrás se puede registrar un mantenimiento. */
  aniosAtras: 5,
} as const;

const opcional = (texto: string | null | undefined) => (texto ? limpiarEspacios(texto) || null : null);

function revisarLargo(texto: string | null, maximo: number, que: string, campo: string) {
  if (texto && texto.length > maximo) throw new ErrorDeDominio(`${que} puede tener hasta ${maximo} caracteres.`, campo);
}

function revisarFechaPasada(fecha: string | null, hoy: FechaISO, que: string, campo: string, desde?: FechaISO) {
  if (!fecha) return;
  if (!esFechaValida(fecha)) throw new ErrorDeDominio(`${que} no es válida. Escríbela como dd/mm/aaaa.`, campo);
  if (fecha > hoy) throw new ErrorDeDominio(`${que} no puede ser en el futuro.`, campo);
  if (desde && fecha < desde) throw new ErrorDeDominio(`${que} es demasiado antigua.`, campo);
}

export function validarEquipo(datos: DatosEquipo, hoy: FechaISO): DatosEquipo {
  const nombre = limpiarEspacios(datos.nombre ?? "");
  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del equipo (ej. Caminadora 1).", "nombre");
  revisarLargo(nombre, LIMITES_MANTENIMIENTO.nombreEquipo, "El nombre", "nombre");
  if (!/[\p{L}]/u.test(nombre)) throw new ErrorDeDominio("El nombre debe llevar letras (ej. Caminadora 1).", "nombre");
  if (!Object.hasOwn(AREAS_EQUIPO, datos.area)) throw new ErrorDeDominio("Elige el área del equipo.", "area");
  const marca = opcional(datos.marca);
  const modelo = opcional(datos.modelo);
  const numeroSerie = opcional(datos.numeroSerie);
  revisarLargo(marca, LIMITES_MANTENIMIENTO.marca, "La marca", "marca");
  revisarLargo(modelo, LIMITES_MANTENIMIENTO.marca, "El modelo", "modelo");
  revisarLargo(numeroSerie, LIMITES_MANTENIMIENTO.serie, "El número de serie", "numeroSerie");
  revisarFechaPasada(datos.fechaCompra, hoy, "La fecha de compra", "fechaCompra", "1980-01-01");
  revisarFechaPasada(datos.servicioBase, hoy, "La fecha del último servicio", "servicioBase", "1980-01-01");
  if (datos.frecuenciaMeses !== null) {
    const error = revisarEntero(datos.frecuenciaMeses, { min: 1, max: LIMITES_MANTENIMIENTO.frecuenciaMaxima, que: "La frecuencia" });
    if (error) throw new ErrorDeDominio(error, "frecuenciaMeses");
  }
  const nota = opcional(datos.nota);
  revisarLargo(nota, LIMITES.nota, "La nota", "nota");
  return {
    nombre,
    area: datos.area,
    marca,
    modelo,
    numeroSerie,
    fechaCompra: datos.fechaCompra || null,
    frecuenciaMeses: datos.frecuenciaMeses,
    servicioBase: datos.servicioBase || null,
    nota,
  };
}

/** Cómo quedó el pago al registrar el mantenimiento. */
export type PagoInicial = { tipo: "completo" | "anticipo"; monto: number; metodo: MetodoPago } | { tipo: "a_deber" };

export function validarMantenimiento(datos: DatosMantenimiento, pago: PagoInicial, hoy: FechaISO) {
  if (!datos.equipoId) throw new ErrorDeDominio("Elige la máquina.", "equipoId");
  if (!Object.hasOwn(TIPOS_MANTENIMIENTO, datos.tipo)) throw new ErrorDeDominio("Elige si fue preventivo o reparación.", "tipo");
  if (!datos.fecha) throw new ErrorDeDominio("Escribe la fecha en que se hizo.", "fecha");
  revisarFechaPasada(datos.fecha, hoy, "La fecha", "fecha", sumarDias(hoy, -365 * LIMITES_MANTENIMIENTO.aniosAtras));
  const descripcion = limpiarEspacios(datos.descripcion ?? "");
  if (descripcion.length < 3) throw new ErrorDeDominio("Escribe qué se le hizo (ej. cambio de banda y lubricación).", "descripcion");
  revisarLargo(descripcion, LIMITES_MANTENIMIENTO.descripcion, "La descripción", "descripcion");
  const proveedor = opcional(datos.proveedor);
  revisarLargo(proveedor, LIMITES_MANTENIMIENTO.proveedor, "El nombre del técnico", "proveedor");
  for (const [campo, valor, que] of [
    ["manoDeObra", datos.manoDeObra, "La mano de obra"],
    ["refacciones", datos.refacciones, "Las refacciones"],
  ] as const) {
    const error = revisarDinero(valor, { que });
    if (error) throw new ErrorDeDominio(error, campo);
  }
  const manoDeObra = centavos(datos.manoDeObra);
  const refacciones = centavos(datos.refacciones);
  const total = centavos(manoDeObra + refacciones);
  const nota = opcional(datos.nota);
  revisarLargo(nota, LIMITES.nota, "La nota", "nota");

  let abono: { monto: number; metodo: MetodoPago } | null = null;
  if (total > 0 && pago.tipo !== "a_deber") {
    if (!Object.hasOwn(METODOS_PAGO, pago.metodo)) throw new ErrorDeDominio("Elige cómo se pagó: efectivo o transferencia.", "metodo");
    if (pago.tipo === "completo") abono = { monto: total, metodo: pago.metodo };
    else {
      const error = revisarDinero(pago.monto, { minExclusivo: true, que: "El anticipo" });
      if (error) throw new ErrorDeDominio(error, "anticipo");
      if (centavos(pago.monto) >= total) throw new ErrorDeDominio("El anticipo debe ser menor al total; si se pagó todo, elige «Pagado completo».", "anticipo");
      abono = { monto: centavos(pago.monto), metodo: pago.metodo };
    }
  }
  // A quien se le debe hay que poder ubicarlo.
  if (total > 0 && (!abono || abono.monto < total) && !proveedor) {
    throw new ErrorDeDominio("Escribe a quién se le debe (técnico o empresa) para saber a quién pagarle.", "proveedor");
  }
  return { datos: { ...datos, descripcion, proveedor, manoDeObra, refacciones, nota }, total, abono };
}

export function validarAbono(datos: DatosAbono, saldo: number, fechaMantenimiento: FechaISO, hoy: FechaISO): DatosAbono {
  if (saldo <= 0) throw new ErrorDeDominio("Este mantenimiento ya está pagado.");
  const error = revisarDinero(datos.monto, { minExclusivo: true, que: "El pago" });
  if (error) throw new ErrorDeDominio(error, "monto");
  const monto = centavos(datos.monto);
  if (monto > saldo) throw new ErrorDeDominio(`Solo se deben $${saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}; no se puede pagar más.`, "monto");
  if (!Object.hasOwn(METODOS_PAGO, datos.metodo)) throw new ErrorDeDominio("Elige cómo se pagó: efectivo o transferencia.", "metodo");
  if (!datos.fecha) throw new ErrorDeDominio("Escribe la fecha del pago.", "fecha");
  revisarFechaPasada(datos.fecha, hoy, "La fecha del pago", "fecha");
  if (datos.fecha < fechaMantenimiento) throw new ErrorDeDominio("El pago no puede ser antes del mantenimiento.", "fecha");
  const nota = opcional(datos.nota);
  revisarLargo(nota, LIMITES.nota, "La nota", "nota");
  return { ...datos, monto, nota };
}

export function validarReporte(datos: DatosReporte): DatosReporte {
  if (!datos.equipoId) throw new ErrorDeDominio("Elige la máquina que falla.", "equipoId");
  const descripcion = limpiarEspacios(datos.descripcion ?? "");
  if (descripcion.length < 3) throw new ErrorDeDominio("Describe qué le pasa (ej. la banda se atora).", "descripcion");
  revisarLargo(descripcion, LIMITES_MANTENIMIENTO.reporte, "La descripción", "descripcion");
  return { ...datos, descripcion, fueraDeServicio: Boolean(datos.fueraDeServicio) };
}

/* ── Equipos típicos de un gimnasio, para darlos de alta rápido ──────── */

export interface EquipoDeCatalogo {
  clave: string;
  nombre: string;
  area: AreaEquipo;
  /** Frecuencia de preventivo que suele recomendarse (en meses). */
  frecuenciaMeses: number;
}

export const EQUIPOS_TIPICOS: EquipoDeCatalogo[] = [
  { clave: "caminadora", nombre: "Caminadora", area: "cardio", frecuenciaMeses: 3 },
  { clave: "eliptica", nombre: "Elíptica", area: "cardio", frecuenciaMeses: 3 },
  { clave: "bici", nombre: "Bicicleta fija", area: "cardio", frecuenciaMeses: 6 },
  { clave: "spinning", nombre: "Bicicleta de spinning", area: "cardio", frecuenciaMeses: 3 },
  { clave: "escaladora", nombre: "Escaladora", area: "cardio", frecuenciaMeses: 3 },
  { clave: "remo", nombre: "Remadora", area: "cardio", frecuenciaMeses: 6 },
  { clave: "multiestacion", nombre: "Multiestación", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "prensa", nombre: "Prensa de piernas", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "smith", nombre: "Máquina Smith", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "poleas", nombre: "Cruce de poleas", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "jalon", nombre: "Jalón al pecho", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "extension", nombre: "Extensión de piernas", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "femoral", nombre: "Curl femoral", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "hack", nombre: "Sentadilla hack", area: "fuerza", frecuenciaMeses: 6 },
  { clave: "banco", nombre: "Banco plano", area: "peso_libre", frecuenciaMeses: 12 },
  { clave: "rack", nombre: "Rack de sentadillas", area: "peso_libre", frecuenciaMeses: 12 },
  { clave: "mancuernero", nombre: "Mancuernero", area: "peso_libre", frecuenciaMeses: 12 },
  { clave: "barras", nombre: "Barras olímpicas", area: "peso_libre", frecuenciaMeses: 6 },
  { clave: "discos", nombre: "Discos de peso", area: "peso_libre", frecuenciaMeses: 12 },
  { clave: "kettlebells", nombre: "Kettlebells", area: "peso_libre", frecuenciaMeses: 12 },
  { clave: "saco", nombre: "Saco de boxeo", area: "peso_libre", frecuenciaMeses: 6 },
  { clave: "aire", nombre: "Aire acondicionado", area: "instalaciones", frecuenciaMeses: 6 },
  { clave: "regaderas", nombre: "Regaderas y calentador", area: "instalaciones", frecuenciaMeses: 6 },
  { clave: "sonido", nombre: "Equipo de sonido", area: "instalaciones", frecuenciaMeses: 12 },
  { clave: "ventiladores", nombre: "Ventiladores", area: "instalaciones", frecuenciaMeses: 6 },
  { clave: "bebedero", nombre: "Bebedero", area: "instalaciones", frecuenciaMeses: 3 },
  { clave: "casilleros", nombre: "Casilleros", area: "instalaciones", frecuenciaMeses: 12 },
  { clave: "iluminacion", nombre: "Iluminación", area: "instalaciones", frecuenciaMeses: 12 },
  { clave: "bascula", nombre: "Báscula", area: "otro", frecuenciaMeses: 12 },
];
