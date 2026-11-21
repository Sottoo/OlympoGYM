/**
 * Mensajes de WhatsApp para los socios.
 *
 * El programa no manda nada solo: arma el mensaje y quien atiende lo envía
 * desde WhatsApp. Los mensajes son cortos (un encabezado y dos o tres
 * líneas) y dicen solo lo necesario: qué pasa con su membresía, cuándo y
 * qué hacer. La redacción cambia de un socio a otro y de un día a otro para
 * que no suene a plantilla, y si viene al caso agrega un detalle personal
 * (su racha, su cumpleaños).
 *
 * Además del texto, `tarjetaDelMensaje` resume lo mismo para la imagen que
 * se puede pegar en el chat (ver TarjetaWhatsApp).
 *
 * Formato de WhatsApp: *negritas* y _cursivas_.
 */

export type SituacionDelSocio = "vigente" | "por_vencer" | "vencida" | "sin_plan";

export interface ContextoMensaje {
  /** Para variar la redacción entre socios sin que cambie cada vez que se abre. */
  socioId: string;
  /** Solo el primer nombre: así se dirige uno a una persona. */
  nombre: string;
  /** Nombre y apellidos, para la imagen. */
  nombreCompleto?: string;
  gimnasio: string;
  /** Fecha de hoy (AAAA-MM-DD) y hora (0-23) en la zona del gimnasio. */
  hoy: string;
  hora: number;
  situacion: SituacionDelSocio;
  /** Días para el día que le toca pagar (0 = hoy, negativo = días de atraso). */
  diasParaPagar: number | null;
  /** El día que le toca volver a pagar: es la fecha que se le dice como «vence» (pagó el 21 → vence el 21). */
  fechaDePago: string | null;
  plan: string | null;
  /** Lo que el gimnasio sabe del socio (opcional): le da el toque personal. */
  visitasDelMes?: number;
  racha?: number;
  desdeAnio?: number;
  cumpleHoy?: boolean;
}

/** Enlace wa.me con el mensaje ya escrito. Asume números de México (+52). */
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/\D/g, "");
  const internacional = digitos.length === 10 ? `52${digitos}` : digitos;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}

/** Cuántas redacciones distintas hay para esta situación (para el botón "Otra redacción"). */
export const REDACCIONES = 4;

/** Arma el mensaje. `variante` 0 es la del día; 1, 2… son otras redacciones. */
export function redactarMensaje(c: ContextoMensaje, variante = 0): string {
  // Cada parte del mensaje tiene su propio punto de partida (por socio y por día) y
  // avanza una opción con cada "otra redacción": así las combinaciones no se repiten.
  const elegir = <T,>(opciones: T[], parte: number) => opciones[(huella(`${c.socioId}|${c.hoy}|${parte}`) + variante) % opciones.length];

  const caso = casoDe(c);
  const n = `*${c.nombre}*`;
  const membresia = c.plan ? `tu plan *${c.plan}*` : "tu membresía";
  const Membresia = capital(membresia);
  const fecha = c.fechaDePago ? fechaConDia(c.fechaDePago) : "";
  const dias = Math.abs(c.diasParaPagar ?? 0);
  const haceDias = dias === 1 ? "ayer" : `hace ${dias} días`;

  const momento = c.hora < 12 ? "Buenos días" : c.hora < 19 ? "Buenas tardes" : "Buenas noches";
  const saludo = elegir([`Hola, ${n}.`, `${momento}, ${n}.`, `¡Hola, ${n}!`], 1);

  // Lo que pasa, en una línea.
  const cuerpo: Record<Caso, string[]> = {
    vence_hoy: [`${Membresia} vence *hoy*.`, `Hoy te toca renovar ${membresia}.`],
    vence_manana: [`${Membresia} vence *mañana, ${fecha}*.`, `Mañana, *${fecha}*, te toca renovar ${membresia}.`],
    vence_pronto: [`${Membresia} vence el *${fecha}*.`, `A ${membresia} le quedan *${dias} días* (vence el ${fecha}).`],
    vigente: [`${Membresia} vence el *${fecha}*.`],
    vencida_reciente: [`${Membresia} venció el *${fecha}*.`, `${Membresia} venció *${haceDias}*.`],
    vencida: [`${Membresia} venció el *${fecha}*.`],
    recuperar: ["Hace tiempo que no te vemos por el gimnasio.", "Te extrañamos en el gimnasio."],
    sin_plan: ["Aún no tienes una membresía activa.", "Tu membresía todavía no está activa."],
  };

  // Qué hacer, en una línea.
  const accion: Record<Caso, string[]> = {
    vence_hoy: ["Renueva hoy en recepción para seguir entrenando.", "Pasa hoy a recepción a renovarla y sigue entrenando."],
    vence_manana: ["Renueva en recepción; los días que te quedan se respetan.", "Si renuevas antes, *no pierdes ningún día*."],
    vence_pronto: ["Renueva cuando gustes en recepción; *no pierdes ningún día*.", "Si renuevas antes, los días que te quedan se respetan."],
    vigente: ["Si quieres renovar por adelantado, te ayudamos en recepción."],
    vencida_reciente: ["Renueva en recepción y retoma tu rutina.", "Te esperamos en recepción para renovarla."],
    vencida: ["Cuando quieras regresar, la reactivamos en recepción.", "Pasa a recepción cuando quieras retomar."],
    recuperar: ["Cuando quieras volver, aquí te esperamos.", "Si te animas a regresar, te ayudamos a elegir plan."],
    sin_plan: ["Pasa a recepción y elige el plan que más te acomode.", "En recepción te ayudamos a elegir tu plan."],
  };

  const lineas = [
    `*${c.gimnasio.toUpperCase()}* · ${tarjetaDelMensaje(c).rotulo}`,
    "",
    `${saludo} ${elegir(cuerpo[caso], 2)}`,
    elegir(accion[caso], 3),
    toquePersonal(c, caso),
    c.cumpleHoy ? "¡Y feliz cumpleaños de parte de todo el equipo!" : "",
  ];
  return lineas.filter((l, i) => l || i === 1).join("\n").trim();
}

/** Lo que muestra la imagen del mensaje: el mismo aviso, en grande. */
export interface TarjetaMensaje {
  /** Qué tipo de aviso es ("Aviso de membresía", "Te extrañamos"…). */
  rotulo: string;
  /** Lo importante, en pocas palabras ("Vence mañana"). */
  titulo: string;
  /** La fecha o el detalle que acompaña al título. */
  detalle: string;
  /** Qué hacer. */
  nota: string;
  /** Aviso urgente (vence hoy o ya venció): el título va en rojo. */
  urgente: boolean;
}

export function tarjetaDelMensaje(c: ContextoMensaje): TarjetaMensaje {
  const caso = casoDe(c);
  const fecha = c.fechaDePago ? capital(fechaConDia(c.fechaDePago)) : "";
  const dias = Math.abs(c.diasParaPagar ?? 0);
  const renovar = "Renueva en recepción · efectivo o transferencia";
  switch (caso) {
    case "vence_hoy":
      return { rotulo: "Aviso de membresía", titulo: "Vence hoy", detalle: fecha, nota: renovar, urgente: true };
    case "vence_manana":
      return { rotulo: "Aviso de membresía", titulo: "Vence mañana", detalle: fecha, nota: renovar, urgente: false };
    case "vence_pronto":
      return { rotulo: "Aviso de membresía", titulo: `Vence en ${dias} días`, detalle: fecha, nota: renovar, urgente: false };
    case "vigente":
      return { rotulo: "Tu membresía", titulo: "Membresía activa", detalle: `Vence el ${fechaConDia(c.fechaDePago!)}`, nota: "Renovar antes no te quita días", urgente: false };
    case "vencida_reciente":
    case "vencida":
      return { rotulo: "Aviso de membresía", titulo: "Membresía vencida", detalle: `Venció el ${fechaConDia(c.fechaDePago!)}`, nota: renovar, urgente: true };
    case "recuperar":
      return { rotulo: "Te extrañamos", titulo: "Te extrañamos", detalle: "Tu lugar sigue aquí", nota: "En recepción te ayudamos a elegir plan", urgente: false };
    case "sin_plan":
      return { rotulo: "Tu membresía", titulo: "Activa tu plan", detalle: "Aún no tienes membresía activa", nota: "Elige tu plan en recepción", urgente: false };
  }
}

/** Quita el formato (*negritas*, _cursivas_) para mostrar el texto plano. */
export function sinFormato(mensaje: string): string {
  return mensaje.replace(/\*(.+?)\*/g, "$1").replace(/_(.+?)_/g, "$1");
}

/* ── Internos ─────────────────────────────────────────────────────── */

type Caso = "vence_hoy" | "vence_manana" | "vence_pronto" | "vigente" | "vencida_reciente" | "vencida" | "recuperar" | "sin_plan";

function casoDe(c: ContextoMensaje): Caso {
  const d = c.diasParaPagar;
  if (c.situacion === "sin_plan" || d === null || !c.fechaDePago) return "sin_plan";
  if (d < -30) return "recuperar";
  if (d < -7) return "vencida";
  if (d < 0) return "vencida_reciente";
  if (d === 0) return "vence_hoy";
  if (d === 1) return "vence_manana";
  if (c.situacion === "por_vencer" || d <= 7) return "vence_pronto";
  return "vigente";
}

/** Una línea corta que muestra que el gimnasio conoce a la persona (o nada, si no aplica). */
function toquePersonal(c: ContextoMensaje, caso: Caso): string {
  const venciendo = caso === "vence_hoy" || caso === "vence_manana" || caso === "vence_pronto";
  if (venciendo && (c.racha ?? 0) >= 3) return `Llevas *${c.racha} días seguidos*; no cortes la racha.`;
  if ((venciendo || caso === "vencida_reciente") && (c.visitasDelMes ?? 0) >= 6) return `Este mes llevas *${c.visitasDelMes} entrenamientos*. ¡Vas muy bien!`;
  const anios = Number(c.hoy.slice(0, 4)) - (c.desdeAnio ?? Infinity);
  if (anios >= 1 && (caso === "vencida" || caso === "recuperar")) return `Gracias por ser parte de ${c.gimnasio} desde ${c.desdeAnio}.`;
  return "";
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-30" → "viernes 30 de octubre". */
function fechaConDia(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`;
}

function capital(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Número estable a partir de un texto (mismo socio y mismo día → misma redacción). */
function huella(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 9973;
}
