"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { escritorio } from "@/presentation/escritorio";

/**
 * Conexión con el lector de huellas (U.are.U 4500) desde la ventana del
 * programa. El lector no se maneja directo: lo atiende el servicio de HID
 * ("HID Authentication Device Client"), que corre en la computadora, y sus
 * scripts (public/vendor/digitalpersona) hablan con él. Cada vez que alguien
 * pone el dedo llega una imagen PNG; la comparación se hace en el servidor.
 *
 * UN SOLO LECTOR PARA TODO EL PROGRAMA. Antes cada pantalla (mostrador,
 * registro de huella) creaba su propio lector al abrirse y lo apagaba al
 * salir. Al cambiar de pantalla, el servicio de HID a veces no soltaba la
 * captura a tiempo: el lector quedaba "tomado" por una conexión que ya no
 * existía, encendido pero sin entregar la huella a nadie, hasta cerrar el
 * programa. Ahora el lector se conecta una vez y se queda conectado; las
 * pantallas solo se suscriben para recibir las huellas mientras están
 * abiertas (la última abierta es la que las recibe).
 *
 * EL LECTOR SIEMPRE SE DA POR "EN PRIMER PLANO". El servicio de HID solo
 * entrega huellas a la página que dice tener el foco: los scripts de HID le
 * avisan con document.hasFocus() y los eventos focus/blur de la ventana, y si
 * la página dice "sin foco" el servicio pausa la captura (o la deja "pospuesta"
 * al conectar) sin avisar nada: el lector se ve encendido y la pantalla dice
 * "listo", pero el dedo no llega. En Electron eso pasa de verdad: tras un
 * cuadro de confirmación (window.confirm) la ventana sigue activa pero
 * document.hasFocus() se queda en false y no vuelve a llegar el evento focus
 * (comprobado en Electron 44). Reiniciar no servía porque la conexión nueva
 * volvía a decir "sin foco"; solo se arreglaba al cambiar de ventana o cerrar
 * el programa. Este programa es el único que usa el lector en la computadora,
 * así que siempre se le dice al servicio que la página tiene el foco.
 *
 * CONEXIÓN "LISTA" PERO MUERTA. Si una ventana suelta el lector de golpe
 * (se cierra el programa a la fuerza, se reinicia para actualizarse, se
 * suspende la computadora), el servicio de HID se lo sigue apartando a esa
 * ventana unos segundos: al pedir la captura contesta 0x80070057 ("ocupado").
 * Cuando por fin la suelta, la conexión nueva a veces queda "lista" (HID dijo
 * que sí y avisó que empezó a capturar) pero nunca le entrega el dedo: el
 * lector prende la luz y no pasa nada (comprobado el 24/11/2026: 2 de 3 veces
 * al reabrir la ventana justo después de cerrarla de golpe; salir al login no
 * lo arreglaba porque se seguía usando la misma conexión). Desde aquí no hay
 * forma de saberlo hasta que alguien pone el dedo, y lo único que lo arregla
 * es reconectar. Por eso la conexión se renueva sola, sin que se note:
 *   · unos segundos después de que el lector estuvo ocupado;
 *   · si HID avisa que empezó o dejó de capturar sin que se lo pidiéramos;
 *   · si pasa un minuto sin que llegue ningún dedo (red de seguridad: si algo
 *     la dejó muerta, a lo mucho dura un minuto), lo que también cubre la
 *     vuelta de la suspensión, y al volver a verse la ventana tras ocultarla.
 *
 * EL AGENTE DE HID SE REINICIA SI HACE FALTA (solo en el programa de
 * escritorio, ver electron/agenteHid.cjs). Si el lector sigue "ocupado" más de
 * 20 s (el agente puede tardar más de 5 minutos en soltar una ventana muerta),
 * se cierra y se vuelve a abrir el agente: uno nuevo no recuerda ventanas
 * muertas y suelta el lector en segundos. Y si el agente no contesta (se cerró
 * o se cayó, y nadie lo vuelve a abrir hasta reiniciar la computadora), se abre.
 */

export type EstadoLector =
  /** Conectando con el servicio de HID. */
  | "conectando"
  /** El servicio de HID no responde (no está instalado o no está corriendo). */
  | "sin_programa"
  /** El servicio responde, pero no hay lector conectado. */
  | "sin_lector"
  /** El servicio de HID aún le aparta el lector a una ventana que se cerró de golpe: lo suelta en segundos. */
  | "ocupado"
  /** Esperando un dedo. */
  | "listo";

interface LectorHid {
  on(evento: string, manejador: (e: { samples?: unknown; quality?: number }) => void): void;
  off(): void;
  enumerateDevices(): Promise<string[]>;
  startAcquisition(formato: number): Promise<void>;
  stopAcquisition(): Promise<void>;
  /** Conexión (websocket) con el servicio de HID. La librería no la cierra sola. */
  channel?: {
    webChannel?: {
      disconnect(): void;
      isConnected(): boolean;
      resetReconnectTimer(): void;
      onConnectionSucceed: (() => void) | null;
      onConnectionFailed: (() => void) | null;
    };
  };
}

/** La conexión interna de los scripts de HID (websdk.client.ui), la que avisa del foco. */
interface ConexionHidInterna {
  prototype: { notifyFocusChanged?: (tieneFoco: boolean) => void; __olimpoSiempreConFoco?: boolean };
}

declare global {
  interface Window {
    dp?: { devices?: { FingerprintReader: new () => LectorHid } };
    WebSdkCore?: {
      channelClientImplementation?: ConexionHidInterna;
      /** Dónde y con qué clave conectarse al servicio; los scripts de HID lo guardan y nunca lo renuevan. */
      configurator?: { m_port?: number; m_srp?: unknown };
    };
  }
}

/** SampleFormat.PngImage de @digitalpersona/devices. */
const FORMATO_PNG = 5;
const SCRIPTS = ["websdk.client.ui.min.js", "core.umd.min.js", "devices.umd.min.js"].map((s) => `/vendor/digitalpersona/${s}`);
/** Si el servicio no contesta en este tiempo, se da por no disponible. */
const ESPERA_MAXIMA_MS = 8000;
/** Cada cuánto se reintenta solo mientras el servicio de HID no contesta. */
const REINTENTO_MS = 5000;
/** Lo más que se espera a que el servicio suelte el lector antes de cerrar la conexión. */
const ESPERA_AL_SOLTAR_MS = 3000;
/** Sin ningún dedo en este tiempo, la conexión se renueva por si quedó muerta (ver arriba). */
const RENOVAR_SIN_ACTIVIDAD_MS = 60_000;
/** Cada cuánto se revisa si toca renovar. */
const REVISION_MS = 15_000;
/** Después de que el lector estuvo ocupado, se renueva ya con HID limpio. */
const RENOVAR_TRAS_OCUPADO_MS = 8000;
/** Avisos de captura que llegan dentro de este tiempo después de pedirla son la respuesta a nuestro pedido. */
const MARGEN_DE_PEDIDO_MS = 2000;
/** Si el lector sigue ocupado este tiempo, se reinicia el agente de HID. */
const REINICIAR_AGENTE_TRAS_OCUPADO_MS = 20_000;
/** Si el agente no contesta este tiempo, se abre (por si se cerró o se cayó). */
const ABRIR_AGENTE_TRAS_SIN_RESPUESTA_MS = 4000;
/** Nunca dos reinicios del agente tan seguidos. */
const ENTRE_REINICIOS_DE_AGENTE_MS = 120_000;
/** Nunca dos renovaciones automáticas tan seguidas. */
const ENTRE_RENOVACIONES_MS = 10_000;
/** Lo que contesta HID ("parámetro inválido") mientras le aparta el lector a otra ventana. */
const ERROR_OCUPADO = "0x80070057";

/* ── Estado compartido (uno por ventana) ────────────────────────────── */

let lector: LectorHid | null = null;
let capturando = false;
let conexionEnCurso: Promise<void> | null = null;
let reintento: ReturnType<typeof setTimeout> | null = null;
let estado: EstadoLector = "conectando";
/** Último dedo (o aviso de calidad) que llegó, o la última captura lograda. */
let ultimaActividad = Date.now();
/** Cuándo pedimos por última vez empezar o detener la captura. */
let ultimoPedido = 0;
/** El lector estuvo ocupado desde la última captura lograda. */
let estuvoOcupado = false;
let renovacion: ReturnType<typeof setTimeout> | null = null;
let ultimaRenovacion = 0;
let revisionIniciada = false;
/** Desde cuándo está ocupado o sin respuesta (0 = no lo está). */
let ocupadoDesde = 0;
let sinRespuestaDesde = 0;
let ultimoReinicioDeAgente = 0;
let ultimaAperturaDeAgente = 0;
/** Hasta cuándo el agente de HID se está abriendo de nuevo (no contesta, pero no es que falte instalarlo). */
let agenteArrancandoHasta = 0;
const oyentes = new Set<() => void>();
interface Receptor {
  alLeer: { current: (imagenBase64: string) => void };
  alAvisar: { current: ((texto: string) => void) | undefined };
}
/** Pantallas que quieren huellas; la última abierta es la que las recibe. */
const receptores: Receptor[] = [];
const receptorActual = (): Receptor | undefined => receptores[receptores.length - 1];

/** QualityCode de @digitalpersona/core: 0 = buena, 1 = sin imagen; del 2 en adelante, el dedo se puso mal. */
const PRIMERA_CALIDAD_MALA = 2;
const AVISO_CALIDAD = "No se leyó bien el dedo. Ponlo otra vez, plano y centrado, sin moverlo.";
const AVISO_ERROR = "El lector no pudo leer el dedo. Ponlo otra vez.";

function cambiar(nuevo: EstadoLector) {
  // Mientras el agente que se acaba de reiniciar abre su puerto no contesta: no es que falte el
  // programa (eso ofrecería instalarlo), sigue liberándose.
  if (nuevo === "sin_programa" && Date.now() < agenteArrancandoHasta) nuevo = "ocupado";
  // El reintento se programa cada vez que algo falla, aunque ya estuviera en
  // "sin_programa". Antes solo se programaba al CAMBIAR a ese estado: si el
  // servicio tardaba más de 5 s en volver (al despertar la computadora), se
  // reintentaba una vez y ya no más, y se quedaba "no disponible" para siempre.
  if (nuevo === "sin_programa" || nuevo === "ocupado") programarReintento();
  if (estado === nuevo) return;
  ocupadoDesde = nuevo === "ocupado" ? Date.now() : 0;
  sinRespuestaDesde = nuevo === "sin_programa" ? Date.now() : 0;
  estado = nuevo;
  oyentes.forEach((avisar) => avisar());
}

/** Mientras alguna pantalla use el lector y el servicio no conteste, se reintenta solo. */
function programarReintento() {
  if (reintento || receptores.length === 0) return;
  reintento = setTimeout(async () => {
    reintento = null;
    if ((estado !== "sin_programa" && estado !== "ocupado") || receptores.length === 0) return;
    await atenderAgente();
    if ((estado === "sin_programa" || estado === "ocupado") && receptores.length > 0) void reconectar(false);
  }, REINTENTO_MS);
}

/**
 * Si el lector lleva rato ocupado, reinicia el agente de HID; si el agente no
 * contesta, lo abre. Solo en el programa de escritorio y con pausas largas
 * entre intentos. Al terminar, el reintento normal vuelve a conectar (y la
 * conexión olvida el puerto viejo, porque el agente nuevo abre otro).
 */
async function atenderAgente() {
  const puente = escritorio()?.reiniciarAgenteLector;
  if (!puente) return;
  const ahora = Date.now();
  try {
    if (estado === "ocupado" && ocupadoDesde && ahora - ocupadoDesde > REINICIAR_AGENTE_TRAS_OCUPADO_MS && ahora - ultimoReinicioDeAgente > ENTRE_REINICIOS_DE_AGENTE_MS) {
      ultimoReinicioDeAgente = ahora;
      // Se marca ANTES de cerrarlo: al cerrarse, la conexión avisa del fallo enseguida.
      agenteArrancandoHasta = Date.now() + 45_000;
      const r = await puente({ forzar: true });
      agenteArrancandoHasta = r.ok ? Date.now() + 15_000 : 0;
    } else if (estado === "sin_programa" && sinRespuestaDesde && ahora - sinRespuestaDesde > ABRIR_AGENTE_TRAS_SIN_RESPUESTA_MS && ahora - ultimaAperturaDeAgente > ENTRE_REINICIOS_DE_AGENTE_MS / 2) {
      ultimaAperturaDeAgente = ahora;
      const r = await puente({ forzar: false });
      if (r.ok && r.accion === "abierto") {
        agenteArrancandoHasta = Date.now() + 15_000;
        cambiar("ocupado");
      }
    }
  } catch {
    // Si no se pudo, se sigue reintentando como siempre.
  }
}

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(new Error("sin respuesta del servicio de HID")), ms);
    promesa.then(
      (v) => (clearTimeout(t), resolver(v)),
      (e) => (clearTimeout(t), rechazar(e)),
    );
  });
}

/** Carga los scripts de HID una sola vez, en orden (cada uno usa al anterior). */
let cargaDeScripts: Promise<void> | null = null;
function cargarScripts(): Promise<void> {
  cargaDeScripts ??= (async () => {
    for (const src of SCRIPTS) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      await new Promise<void>((resolver, rechazar) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = () => resolver();
        s.onerror = () => rechazar(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(s);
      });
    }
  })().catch((error) => {
    cargaDeScripts = null;
    throw error;
  });
  return cargaDeScripts;
}

/**
 * Hace que cada conexión con el servicio de HID diga siempre "con foco" (ver
 * arriba). Se cambia el método de los scripts de HID que manda ese aviso, así
 * aplica al conectar y en cada focus/blur de la ventana. Devuelve false si los
 * scripts no traen ese método (otra versión): entonces se queda como estaba.
 */
function siempreConFoco(): boolean {
  const prototipo = window.WebSdkCore?.channelClientImplementation?.prototype;
  const original = prototipo?.notifyFocusChanged;
  if (!prototipo || typeof original !== "function") return false;
  if (prototipo.__olimpoSiempreConFoco) return true;
  prototipo.notifyFocusChanged = function (this: unknown) {
    original.call(this, true);
  };
  prototipo.__olimpoSiempreConFoco = true;
  return true;
}

/** La imagen de la muestra, en base64 normal (HID la manda en base64url, a veces dentro de un objeto). */
function imagenDeMuestra(samples: unknown): string | null {
  const primera = Array.isArray(samples) ? samples[0] : samples;
  const datos = typeof primera === "string" ? primera : (primera as { Data?: unknown; data?: unknown } | undefined)?.Data ?? (primera as { data?: unknown } | undefined)?.data;
  if (typeof datos !== "string" || !datos) return null;
  const b64 = datos.replace(/-/g, "+").replace(/_/g, "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

/** Crea el lector si no existe y deja la captura encendida. Nunca hay dos conexiones a la vez. */
function conectar(): Promise<void> {
  conexionEnCurso ??= (async () => {
    try {
      await cargarScripts();
      if (!siempreConFoco()) console.warn("Lector de huellas: no se pudo fijar el foco; la captura puede pausarse al cambiar de ventana.");
      const Lector = window.dp?.devices?.FingerprintReader;
      if (!Lector) return cambiar("sin_programa");
      if (!lector) {
        const nuevo = new Lector();
        lector = nuevo;
        nuevo.on("DeviceConnected", () => {
          if (lector === nuevo) void iniciarCaptura();
        });
        nuevo.on("DeviceDisconnected", () => {
          if (lector !== nuevo) return;
          capturando = false;
          cambiar("sin_lector");
        });
        nuevo.on("CommunicationFailed", () => {
          if (lector !== nuevo) return;
          capturando = false;
          cambiar("sin_programa");
        });
        nuevo.on("SamplesAcquired", (e) => {
          if (lector !== nuevo) return;
          ultimaActividad = Date.now();
          const imagen = imagenDeMuestra(e.samples);
          const receptor = receptorActual();
          if (imagen && receptor) receptor.alLeer.current(imagen);
        });
        // Si el lector sí vio el dedo pero no lo pudo usar, se dice (antes no pasaba nada y parecía descompuesto).
        nuevo.on("QualityReported", (e) => {
          if (lector !== nuevo) return;
          ultimaActividad = Date.now();
          if (typeof e.quality !== "number" || e.quality < PRIMERA_CALIDAD_MALA) return;
          receptorActual()?.alAvisar.current?.(AVISO_CALIDAD);
        });
        nuevo.on("ErrorOccurred", () => {
          if (lector === nuevo) receptorActual()?.alAvisar.current?.(AVISO_ERROR);
        });
        // HID empezó o dejó de capturar sin que se lo pidiéramos: le movió el lector a otra conexión
        // (o se lo regresó a una ventana muerta). Se renueva la nuestra para quedarnos con él.
        const avisoNoPedido = () => {
          if (lector === nuevo && Date.now() - ultimoPedido > MARGEN_DE_PEDIDO_MS) programarRenovacion(3000);
        };
        nuevo.on("AcquisitionStarted", avisoNoPedido);
        nuevo.on("AcquisitionStopped", avisoNoPedido);
      }
      iniciarRevision();
      await iniciarCaptura();
    } catch {
      cambiar("sin_programa");
    } finally {
      conexionEnCurso = null;
    }
  })();
  return conexionEnCurso;
}

/** Evita pedir la captura dos veces a la vez (al conectar y al avisar el servicio que llegó el lector). */
let capturaEnCurso: { de: LectorHid; promesa: Promise<void> } | null = null;

function iniciarCaptura(): Promise<void> {
  const actual = lector;
  if (!actual) return Promise.resolve();
  if (capturaEnCurso?.de === actual) return capturaEnCurso.promesa;
  const promesa = pedirCaptura(actual).finally(() => {
    if (capturaEnCurso?.promesa === promesa) capturaEnCurso = null;
  });
  capturaEnCurso = { de: actual, promesa };
  return promesa;
}

async function pedirCaptura(actual: LectorHid) {
  if (capturando) return;
  try {
    const lectores = await conLimite(actual.enumerateDevices(), ESPERA_MAXIMA_MS);
    if (lector !== actual) return;
    if (lectores.length === 0) return cambiar("sin_lector");
    ultimoPedido = Date.now();
    await conLimite(actual.startAcquisition(FORMATO_PNG), ESPERA_MAXIMA_MS);
    if (lector !== actual) return;
    capturando = true;
    ultimaActividad = Date.now();
    cambiar("listo");
    // Venía de estar ocupado por una ventana muerta: esta conexión pudo quedar muerta.
    if (estuvoOcupado) {
      estuvoOcupado = false;
      programarRenovacion(RENOVAR_TRAS_OCUPADO_MS);
    }
  } catch (error) {
    if (lector !== actual) return;
    if (error instanceof Error && error.message === ERROR_OCUPADO) {
      estuvoOcupado = true;
      cambiar("ocupado");
    } else cambiar("sin_programa");
  }
}

/**
 * Detiene la captura, ESPERA a que el servicio de HID suelte el lector (o se
 * rinde a los 3 s) y cierra la conexión. Solo después se conecta otro.
 */
async function soltar(viejo: LectorHid) {
  viejo.off();
  const canal = viejo.channel?.webChannel;
  if (!canal) return;
  // Si la conexión se había caído, los scripts de HID la reintentan solos cada
  // 5 s. Que la vieja no se reabra nunca: si llega a conectar se cierra, y si
  // falla no se vuelve a intentar (si no, quedaría una segunda conexión suelta).
  canal.onConnectionSucceed = () => canal.disconnect();
  canal.onConnectionFailed = () => canal.resetReconnectTimer();
  // Solo se detiene la captura si sigue conectada: pedirlo sin conexión la volvería a abrir.
  ultimoPedido = Date.now();
  if (canal.isConnected()) await conLimite(viejo.stopAcquisition(), ESPERA_AL_SOLTAR_MS).catch(() => {});
  try {
    canal.disconnect();
  } catch {
    // Ya estaba cerrada.
  }
}

/**
 * Olvida el puerto y la clave del servicio de HID para que la próxima conexión
 * los vuelva a pedir. Cuando el servicio se reinicia (al despertar la
 * computadora, si se cerró, etc.) abre otro puerto con otra clave, pero los
 * scripts de HID guardan los primeros (en memoria y en sessionStorage) y nunca
 * los renuevan: el programa se quedaba en "no disponible" hasta cerrarlo.
 * Comprobado reiniciando el servicio: el puerto pasó de 50603 a 57145.
 */
function olvidarConexionHid() {
  try {
    sessionStorage.removeItem("websdk");
  } catch {
    // Sin sessionStorage no hay nada guardado ahí.
  }
  const configuracion = window.WebSdkCore?.configurator;
  if (configuracion) {
    configuracion.m_port = undefined;
    configuracion.m_srp = undefined;
  }
}

let reconexionEnCurso: Promise<void> | null = null;

/**
 * Suelta el lector actual (esperando a que el servicio lo libere) y conecta uno
 * nuevo. Una sola reconexión a la vez: antes, varios clics seguidos en
 * "Reiniciar" soltaban el lector que el clic anterior aún estaba conectando y
 * la pantalla se quedaba en "Conectando…" para siempre. Los clics extra
 * mientras ya se reconecta no hacen nada más.
 */
function reconectar(mostrarConectando = true): Promise<void> {
  if (mostrarConectando) cambiar("conectando");
  reconexionEnCurso ??= (async () => {
    try {
      // Nunca se suelta un lector a media conexión.
      if (conexionEnCurso) await conexionEnCurso;
      const viejo = lector;
      lector = null;
      capturando = false;
      if (viejo) await soltar(viejo);
      olvidarConexionHid();
      await conectar();
    } finally {
      reconexionEnCurso = null;
    }
  })();
  return reconexionEnCurso;
}

/**
 * Renueva la conexión en silencio (la pantalla sigue diciendo "listo"). Tarda
 * menos de un cuarto de segundo; un dedo que llegue justo en ese instante se
 * pierde y se vuelve a poner, pero una conexión muerta ya no se queda así.
 */
function renovar() {
  if (receptores.length === 0 || reconexionEnCurso || conexionEnCurso) return;
  ultimaRenovacion = Date.now();
  ultimaActividad = Date.now();
  void reconectar(false);
}

/** Renueva dentro de `ms` (una sola vez aunque se pida varias, y nunca dos muy seguidas). */
function programarRenovacion(ms: number) {
  if (renovacion) return;
  const espera = Math.max(ms, ultimaRenovacion + ENTRE_RENOVACIONES_MS - Date.now());
  renovacion = setTimeout(() => {
    renovacion = null;
    if (estado === "listo") renovar();
  }, espera);
}

/**
 * Red de seguridad: si pasa un minuto sin ningún dedo, se renueva la conexión.
 * Al volver de la suspensión los relojes siguen con la última actividad vieja,
 * así que también se renueva entonces. Con la ventana oculta no se toca (nadie
 * la está usando); al volver a verse, se renueva.
 */
function iniciarRevision() {
  if (revisionIniciada) return;
  revisionIniciada = true;
  let oculta = false;
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (estado === "listo" && Date.now() - ultimaActividad > RENOVAR_SIN_ACTIVIDAD_MS) renovar();
  }, REVISION_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") oculta = true;
    else if (oculta) {
      oculta = false;
      if (estado === "listo") programarRenovacion(500);
    }
  });
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
}

/* ── Para las pantallas ─────────────────────────────────────────────── */

/**
 * Recibe las huellas mientras `activo` sea true y la pantalla esté abierta
 * (si hay varias, la última abierta). Devuelve en qué estado está el lector y
 * cómo reiniciarlo (por ejemplo, si dejó de responder o se acaba de instalar
 * el programa de HID). `alAvisar` recibe un texto cuando el lector vio el
 * dedo pero no lo pudo leer bien.
 */
export function useLectorDeHuellas(
  alLeer: (imagenBase64: string) => void,
  activo = true,
  alAvisar?: (texto: string) => void,
): { estado: EstadoLector; reconectar: () => void } {
  const alLeerActual = useRef(alLeer);
  alLeerActual.current = alLeer;
  const alAvisarActual = useRef(alAvisar);
  alAvisarActual.current = alAvisar;
  const estadoActual = useSyncExternalStore(suscribir, () => estado, () => "conectando" as EstadoLector);

  useEffect(() => {
    if (!activo) return;
    const receptor: Receptor = { alLeer: alLeerActual, alAvisar: alAvisarActual };
    receptores.push(receptor);
    // Solo se conecta si aún no hay lector (o si se cayó); si ya está listo, no se toca.
    void conectar();
    if (estado === "sin_programa") programarReintento();
    return () => {
      const i = receptores.indexOf(receptor);
      if (i >= 0) receptores.splice(i, 1);
    };
  }, [activo]);

  return { estado: activo ? estadoActual : "conectando", reconectar: () => void reconectar() };
}

/** Texto corto para mostrar junto al lector. */
export const TEXTO_ESTADO_LECTOR: Record<EstadoLector, string> = {
  conectando: "Conectando con el lector…",
  sin_programa: "Lector de huellas no disponible",
  sin_lector: "Conecta el lector de huellas",
  ocupado: "El lector se está liberando…",
  listo: "Lector de huellas listo",
};
