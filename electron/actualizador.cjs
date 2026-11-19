/**
 * Actualizaciones automáticas de Olimpo GYM.
 *
 * Cada versión se publica como "Release" en GitHub (ver
 * scripts/publicar-version.mjs) con:
 *   · actualizacion.json: { version, archivo, sha512, tamano, electron, recursos }
 *   · el instalador completo (.exe) y
 *   · recursos-<versión>.zip: solo el código del programa (parte de Electron
 *     y servidor), unos 25 MB.
 *
 * Forma normal — sin instalador: si la versión nueva usa el mismo programa
 * base (Electron), se baja el .zip, se revisa su huella SHA-512, se
 * descomprime en %APPDATA%\Olimpo GYM\versiones\<versión> y, tras el
 * respaldo, el programa se reinicia con él (ver versiones.cjs y
 * arranque.cjs). No se ejecuta ningún .exe nuevo, así que Windows no tiene
 * nada que bloquear, y tarda segundos. Si la versión nueva no logra abrir, el
 * programa regresa solo a la anterior.
 *
 * Solo si cambia el programa base se usa el instalador (que Windows puede
 * bloquear por no estar firmado).
 *
 * En ambos casos: aviso en el riel y notificación de Windows; se aplica con
 * "Actualizar ahora" (respaldo, se cierra y se vuelve a abrir) o al cerrar el
 * programa (respaldo con la ventana ya cerrada). Nunca se aplica sin un
 * respaldo recién hecho y comprobado; todo tiene tiempo límite; sin internet
 * o si algo falla, el programa sigue igual y lo intenta después. Lo que pasa
 * queda en %APPDATA%\Olimpo GYM\actualizaciones.log.
 *
 * Sin dependencias de node_modules: el instalador no las lleva para la parte
 * de Electron (fflate va copiado en electron/vendor).
 */
const { app, BrowserWindow, Notification } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { Unzip, UnzipInflate } = require("./vendor/fflate.cjs");
const { carpetaVersiones, leerPuntero, escribirPuntero, versionActiva, compararVersiones, registrar } = require("./versiones.cjs");

const REPOSITORIO = "Sottoo/OlympoGYM";
const URL_MANIFIESTO = `https://github.com/${REPOSITORIO}/releases/latest/download/actualizacion.json`;
const urlDeArchivo = (version, archivo) => `https://github.com/${REPOSITORIO}/releases/download/v${version}/${encodeURIComponent(archivo)}`;
/** La primera revisión espera a que el programa termine de abrir. */
const PRIMERA_REVISION_MS = 20_000;
/**
 * Mientras está abierto revisa cada 5 minutos: así una versión publicada llega
 * pronto. Cada revisión es una consulta de menos de 1 KB; solo se descarga algo
 * cuando de verdad hay versión nueva.
 */
const CADA_MS = 5 * 60 * 1000;
/** Tiempo máximo del respaldo previo. Si se pasa, no se actualiza (y el programa no se queda esperando). */
const LIMITE_RESPALDO_AHORA_MS = 3 * 60 * 1000;
/** Al cerrar el programa la ventana ya no está: se espera menos para no dejar un proceso colgado. */
const LIMITE_RESPALDO_AL_CERRAR_MS = 90 * 1000;
/** Lo mínimo que debe traer un paquete de código para poder arrancar. */
const ARCHIVOS_ESENCIALES = ["electron/main.cjs", "electron/preload.cjs", "electron/versiones.cjs", "servidor/server.js"];

/** @typedef {{ ok: true, archivo: string } | { ok: false, error: string }} ResultadoRespaldo */

/**
 * Versión descargada y lista para aplicar.
 * @type {{ version: string, modo: "recursos", carpeta: string, electron: string }
 *      | { version: string, modo: "instalador", ruta: string, tamano: number, sha512: string } | null}
 */
let lista = null;
/** Ya se hizo (y comprobó) el respaldo para aplicar la versión lista. */
let respaldado = false;
let abrirAlTerminar = false;
let aplicando = false;
/** "Actualizar ahora" en curso. */
let actualizandoAhora = false;
/** Cerraron la ventana mientras "Actualizar ahora" respaldaba: se cierra al terminar. */
let cerrarAlTerminarRespaldo = false;
/** Al cerrar: null = no ha empezado, "respaldando", "listo" (ya se puede cerrar). */
/** @type {null | "respaldando" | "listo"} */
let cierre = null;
/** Mientras se respaldaba al cerrar, alguien volvió a abrir el programa: se reabre al terminar. */
let reabrirPedido = false;
/** Se guarda la notificación: si se libera de memoria, Windows pierde el clic. */
let notificacion = null;

let opciones = {
  /** @type {(info: { version: string }) => void} */
  avisar: () => {},
  /** Abre la ventana del programa con el diálogo de actualizar. */
  mostrar: () => {},
  /** @type {(limiteMs: number) => Promise<ResultadoRespaldo>} */
  respaldar: async () => ({ ok: false, error: "Sin respaldo configurado." }),
};

/**
 * Empieza a revisar si hay versiones nuevas. Solo en el programa instalado
 * (no al probar con `npm run escritorio` ni en modo dev).
 * @param {typeof opciones} configuracion
 */
function iniciarActualizaciones(configuracion) {
  opciones = configuracion;
  if (!app.isPackaged) return;
  registrar(`Programa abierto (versión ${versionActiva()}${process.env.OLIMPO_RAIZ ? ", descargada" : ", instalada"}).`);
  setTimeout(() => void revisar(), PRIMERA_REVISION_MS);
  setInterval(() => void revisar(), CADA_MS).unref();
}

/** Versión ya descargada y lista para aplicar, si la hay. */
function versionLista() {
  return lista ? { version: lista.version } : null;
}

/**
 * "Actualizar ahora": revisa lo descargado, hace el respaldo y, solo si todo
 * salió bien, cierra el programa para aplicar la versión (se vuelve a abrir solo).
 * Si algo falla, regresa el error y el programa sigue abierto como estaba.
 * @returns {Promise<ResultadoRespaldo>}
 */
async function actualizarAhora() {
  if (!lista) return { ok: false, error: "No hay una versión nueva lista para instalar." };
  if (actualizandoAhora || cierre) return { ok: false, error: "La actualización ya está en curso." };
  actualizandoAhora = true;
  try {
    if (!(await descargaIntacta())) return { ok: false, error: "La versión descargada se dañó. Se volverá a descargar sola; intenta más tarde." };
    registrar(`Actualizar ahora: respaldando antes de aplicar ${lista.version}…`);
    const r = await respaldarConLimite(LIMITE_RESPALDO_AHORA_MS);
    if (!r.ok) {
      registrar(`No se actualizó: el respaldo falló (${r.error}).`);
      return { ok: false, error: `No se pudo hacer el respaldo, así que no se actualizó y todo sigue igual. (${r.error})` };
    }
    respaldado = true;
    abrirAlTerminar = true;
    registrar(`Respaldo listo (${r.archivo}). Cerrando para aplicar la versión ${lista.version}.`);
    // Un momento para que la ventana alcance a mostrar "listo" antes de cerrarse.
    setTimeout(() => app.quit(), 1500);
    return r;
  } finally {
    actualizandoAhora = false;
    // Si cerraron la ventana a medio respaldo y no se va a aplicar, ahora sí se cierra.
    if (cerrarAlTerminarRespaldo && !respaldado) {
      cierre = "listo";
      app.quit();
    }
  }
}

/**
 * Para `before-quit`. Si hay una versión lista sin respaldo, detiene el cierre,
 * esconde las ventanas, hace el respaldo (con tiempo límite) y vuelve a cerrar.
 * Devuelve true si detuvo el cierre (entonces aún no hay que apagar el servidor).
 */
function detenerCierreParaRespaldar(evento) {
  if (!lista || respaldado || aplicando || cierre === "listo") return false;
  evento.preventDefault();
  if (actualizandoAhora) {
    // Ya se está respaldando desde "Actualizar ahora": se espera a que termine.
    cerrarAlTerminarRespaldo = true;
    for (const v of BrowserWindow.getAllWindows()) v.hide();
    return true;
  }
  if (cierre === "respaldando") return true;
  cierre = "respaldando";
  for (const v of BrowserWindow.getAllWindows()) v.hide();
  registrar(`Al cerrar: respaldando antes de aplicar ${lista.version}…`);
  void (async () => {
    try {
      if (!(await descargaIntacta())) return;
      const r = await respaldarConLimite(LIMITE_RESPALDO_AL_CERRAR_MS);
      if (r.ok) {
        respaldado = true;
        registrar(`Respaldo listo (${r.archivo}).`);
      } else {
        registrar(`No se aplicó al cerrar: el respaldo falló (${r.error}). Se intentará la próxima vez.`);
      }
    } catch (error) {
      registrar(`No se aplicó al cerrar: ${mensaje(error)}`);
    } finally {
      cierre = "listo";
      // Si lo volvieron a abrir mientras tanto y no se va a aplicar, se reabre ya.
      if (reabrirPedido && !respaldado) app.relaunch();
      if (reabrirPedido) abrirAlTerminar = true;
      app.quit();
    }
  })();
  return true;
}

/** Mientras se respalda al cerrar (sin ventana), alguien abrió el programa otra vez. */
function seEstaCerrandoParaActualizar() {
  if (cierre !== "respaldando") return false;
  reabrirPedido = true;
  return true;
}

/** Para `will-quit`: solo aplica si hay versión lista Y su respaldo ya se hizo. */
function instalarAlSalir() {
  if (!lista || !respaldado || aplicando) return;
  aplicando = true;
  // Marca para que, al volver a abrir, se confirme si la actualización quedó.
  escribirPendiente({ version: lista.version, desde: versionActiva(), inicio: new Date().toISOString() });
  if (lista.modo === "recursos") return activarVersionDescargada(lista);
  try {
    if (fs.statSync(lista.ruta).size !== lista.tamano) return registrar("El instalador descargado cambió de tamaño; no se usó.");
    // --updated: es una actualización (el instalador muestra solo su barra de progreso y no toca los datos).
    // --force-run: vuelve a abrir el programa al terminar.
    const argumentos = ["--updated", ...(abrirAlTerminar ? ["--force-run"] : [])];
    const instalador = spawn(lista.ruta, argumentos, { detached: true, stdio: "ignore" });
    instalador.on("error", (error) => registrar(`Windows no abrió el instalador: ${mensaje(error)}`));
    instalador.unref();
    registrar(`Instalando ${lista.version} con el instalador${abrirAlTerminar ? " (y se vuelve a abrir)" : ""}.`);
  } catch (error) {
    registrar(`No se pudo correr el instalador: ${mensaje(error)}`);
  }
}

/**
 * Deja la versión descargada como la que se usa al abrir (en prueba: si no
 * abre, se regresa sola a la actual) y, si se pidió, reabre el programa.
 */
function activarVersionDescargada(v) {
  try {
    const actual = leerPuntero();
    // La "anterior" es la que está corriendo ahora: la descargada en uso, o ninguna (la instalada).
    const anterior = actual && process.env.OLIMPO_RAIZ && actual.version === versionActiva() ? { ...actual, anterior: null } : null;
    escribirPuntero({ version: v.version, electron: v.electron, carpeta: v.carpeta, estado: "probando", intentos: 0, anterior });
    registrar(`Versión ${v.version} activada; se usa al abrir${abrirAlTerminar ? " (se vuelve a abrir ya)" : ""}.`);
    if (abrirAlTerminar) app.relaunch();
  } catch (error) {
    registrar(`No se pudo activar la versión ${v.version}: ${mensaje(error)}`);
  }
}

/** Respaldo con tiempo límite; nunca lanza error ni se queda esperando. */
async function respaldarConLimite(limiteMs) {
  let reloj;
  const limite = new Promise((resolver) => {
    reloj = setTimeout(() => resolver({ ok: false, error: "el respaldo tardó demasiado" }), limiteMs + 2000);
  });
  try {
    const r = await Promise.race([opciones.respaldar(limiteMs).catch((e) => ({ ok: false, error: mensaje(e) })), limite]);
    return r && typeof r === "object" && "ok" in r ? r : { ok: false, error: "respuesta inesperada" };
  } finally {
    clearTimeout(reloj);
  }
}

/** Vuelve a revisar lo descargado; si se dañó, se olvida y se descargará de nuevo. */
async function descargaIntacta() {
  if (!lista) return false;
  try {
    if (lista.modo === "recursos") {
      const raiz = path.join(carpetaVersiones(), lista.carpeta);
      if (ARCHIVOS_ESENCIALES.every((a) => fs.existsSync(path.join(raiz, a)))) return true;
    } else if (fs.statSync(lista.ruta).size === lista.tamano && (await huella(lista.ruta)) === lista.sha512) {
      return true;
    }
  } catch {
    // No existe o no se pudo leer.
  }
  registrar("Lo descargado ya no está completo; se descartó y se volverá a descargar.");
  try {
    if (lista.modo === "recursos") fs.rmSync(path.join(carpetaVersiones(), lista.carpeta), { recursive: true, force: true });
    else fs.rmSync(lista.ruta, { force: true });
  } catch {
    // Da igual: se reemplaza en la próxima descarga.
  }
  lista = null;
  respaldado = false;
  return false;
}

/** Notificación de Windows con clic para actualizar. Si Windows no las permite, basta el aviso del riel. */
function notificar(version) {
  try {
    if (!Notification.isSupported()) return;
    notificacion = new Notification({
      title: "Olimpo GYM: hay una versión nueva",
      body: `La versión ${version} ya está descargada. Da clic para respaldar y actualizar ahora (tarda unos segundos), o se aplicará sola al cerrar el programa.`,
      icon: path.join(__dirname, "icono.png"),
    });
    notificacion.on("click", () => {
      try {
        opciones.mostrar();
      } catch (error) {
        registrar(`No se pudo abrir el aviso desde la notificación: ${mensaje(error)}`);
      }
    });
    notificacion.show();
  } catch (error) {
    registrar(`No se pudo mostrar la notificación: ${mensaje(error)}`);
  }
}

/**
 * @typedef {{ estado: "al-dia", publicada: string | null }
 *         | { estado: "lista", version: string }
 *         | { estado: "error", mensaje: string }
 *         | { estado: "desarrollo" }} ResultadoDeRevision
 */

/** Revisión en curso: si se pide otra mientras tanto (botón o reloj), se espera esta misma. */
/** @type {Promise<ResultadoDeRevision> | null} */
let revisionEnCurso = null;

/** Revisa si hay versión nueva y, si la hay, la descarga y la deja lista. */
function revisar() {
  if (lista) return Promise.resolve({ estado: "lista", version: lista.version });
  revisionEnCurso ??= revisarUnaVez().finally(() => (revisionEnCurso = null));
  return revisionEnCurso;
}

/** Botón «Buscar actualización» (Mi cuenta): revisa en ese momento y dice el resultado. */
function buscarActualizacion() {
  if (!app.isPackaged) return Promise.resolve({ estado: "desarrollo" });
  if (!lista && !revisionEnCurso) registrar("Búsqueda de actualización pedida desde el programa.");
  return revisar();
}

/** @returns {Promise<ResultadoDeRevision>} */
async function revisarUnaVez() {
  try {
    const respuesta = await fetch(URL_MANIFIESTO, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (respuesta.status === 404) {
      registrar("Revisé GitHub: todavía no hay versiones publicadas.");
      return { estado: "al-dia", publicada: null };
    }
    if (!respuesta.ok) {
      registrar(`GitHub respondió ${respuesta.status} al buscar versiones.`);
      return { estado: "error", mensaje: `GitHub no respondió bien (código ${respuesta.status}). Intenta más tarde.` };
    }
    const m = validarManifiesto(await respuesta.json());
    if (!m) {
      registrar("El actualizacion.json publicado no es válido; se ignora.");
      return { estado: "error", mensaje: "La versión publicada no es válida; no se descargó." };
    }
    if (compararVersiones(m.version, versionActiva()) <= 0) {
      registrar(`Revisé GitHub: no hay versión nueva (la publicada es ${m.version}).`);
      return { estado: "al-dia", publicada: m.version };
    }

    const temporales = path.join(app.getPath("temp"), "Olimpo GYM", "actualizacion");
    fs.mkdirSync(temporales, { recursive: true });

    if (m.recursos && m.electron === process.versions.electron) {
      // Forma normal: solo el código, sin instalador.
      const carpeta = m.version;
      if (versionYaPreparada(carpeta, m.recursos.sha512)) {
        registrar(`La versión ${m.version} ya estaba descargada y completa.`);
      } else {
        const zip = path.join(temporales, m.recursos.archivo);
        await limpiarTemporales(temporales, m.recursos.archivo);
        if (!(fs.existsSync(zip) && (await huella(zip)) === m.recursos.sha512)) {
          registrar(`Descargando el código de la versión ${m.version} (${(m.recursos.tamano / 1048576).toFixed(1)} MB)…`);
          await descargar(urlDeArchivo(m.version, m.recursos.archivo), zip, m.recursos);
        }
        const inicio = Date.now();
        await prepararVersion(zip, carpeta, m.recursos.sha512);
        registrar(`Código de la versión ${m.version} preparado en ${Math.round((Date.now() - inicio) / 1000)} s.`);
        await fs.promises.rm(zip, { force: true });
      }
      lista = { version: m.version, modo: "recursos", carpeta, electron: m.electron };
    } else {
      // Cambió el programa base: hace falta el instalador completo.
      const destino = path.join(temporales, m.archivo);
      await limpiarTemporales(temporales, m.archivo);
      if (!(fs.existsSync(destino) && (await huella(destino)) === m.sha512)) {
        registrar(`Descargando el instalador de la versión ${m.version} (cambió el programa base)…`);
        await descargar(urlDeArchivo(m.version, m.archivo), destino, m);
      }
      lista = { version: m.version, modo: "instalador", ruta: destino, tamano: m.tamano, sha512: m.sha512 };
    }
    respaldado = false;
    registrar(`Versión ${m.version} descargada y revisada (${lista.modo === "recursos" ? "sin instalador" : "con instalador"}); se aplica al cerrar el programa.`);
    try {
      opciones.avisar({ version: m.version });
    } catch (error) {
      registrar(`No se pudo mostrar el aviso: ${mensaje(error)}`);
    }
    notificar(m.version);
    return { estado: "lista", version: m.version };
  } catch (error) {
    registrar(`No se pudo revisar o descargar la actualización: ${mensaje(error)}`);
    const sinInternet = error instanceof Error && (error.name === "TimeoutError" || /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN/i.test(`${error.message} ${error.cause?.code ?? ""}`));
    return {
      estado: "error",
      mensaje: sinInternet ? "No se pudo conectar para buscar actualizaciones. Revisa el internet e intenta de nuevo." : `No se pudo descargar la actualización: ${mensaje(error)}`,
    };
  }
}

/** Borra descargas viejas de la carpeta temporal (deja la que se va a usar), sin bloquear la ventana. */
async function limpiarTemporales(carpeta, conservar) {
  for (const viejo of await fs.promises.readdir(carpeta)) {
    if (viejo !== conservar) await fs.promises.rm(path.join(carpeta, viejo), { recursive: true, force: true });
  }
}

/** Marca dentro de la carpeta de una versión: su paquete se descomprimió completo. Guarda la huella del paquete. */
const MARCA_COMPLETA = ".paquete-completo";

/** ¿Esa versión ya está descomprimida, completa y es del mismo paquete publicado? */
function versionYaPreparada(carpeta, sha512) {
  try {
    const raiz = path.join(carpetaVersiones(), carpeta);
    return fs.readFileSync(path.join(raiz, MARCA_COMPLETA), "utf8") === sha512 && ARCHIVOS_ESENCIALES.every((a) => fs.existsSync(path.join(raiz, a)));
  } catch {
    return false;
  }
}

/**
 * Descomprime el paquete de código en versiones/<versión>. Primero en una
 * carpeta temporal; solo si trae todo lo esencial se le pone su nombre final
 * (con la marca de completa). Todo sin bloquear la ventana.
 */
async function prepararVersion(zip, carpeta, sha512) {
  const destino = path.join(carpetaVersiones(), carpeta);
  const temporal = `${destino}.preparando`;
  await fs.promises.rm(temporal, { recursive: true, force: true });
  await extraerZip(zip, temporal);
  const falta = ARCHIVOS_ESENCIALES.find((a) => !fs.existsSync(path.join(temporal, a)));
  if (falta) {
    await fs.promises.rm(temporal, { recursive: true, force: true });
    throw new Error(`el paquete de la versión ${carpeta} no trae ${falta}`);
  }
  await fs.promises.writeFile(path.join(temporal, MARCA_COMPLETA), sha512);
  await fs.promises.rm(destino, { recursive: true, force: true });
  await renombrarConReintentos(temporal, destino);
}

/** En Windows el antivirus puede tener abierto un archivo recién escrito un momento: se reintenta. */
async function renombrarConReintentos(origen, destino) {
  for (let intento = 1; ; intento++) {
    try {
      return await fs.promises.rename(origen, destino);
    } catch (error) {
      if (intento >= 20 || !["EPERM", "EBUSY", "EACCES"].includes(error?.code)) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/**
 * Descomprime un .zip sin trabar la ventana: lee por partes, y cada archivo se
 * escribe en segundo plano (pocos a la vez), dejando que la ventana responda
 * entre uno y otro. Rechaza rutas que intenten salir de la carpeta (../, absolutas).
 */
function extraerZip(zip, destino) {
  const raiz = path.resolve(destino);
  return new Promise((resolver, rechazar) => {
    let fallo = null;
    let leido = false;
    /** Escrituras pendientes y en curso (máximo ESCRITURAS_A_LA_VEZ a la vez). */
    const cola = [];
    let enCurso = 0;
    const ESCRITURAS_A_LA_VEZ = 8;
    const carpetasHechas = new Set();
    const lector = fs.createReadStream(zip, { highWaterMark: 256 * 1024 });

    const fallar = (error) => {
      if (fallo) return;
      fallo = error;
      lector.destroy();
      rechazar(error);
    };
    const terminarSiYa = () => {
      if (!fallo && leido && enCurso === 0 && cola.length === 0) resolver();
    };
    const escribirSiguiente = () => {
      while (!fallo && enCurso < ESCRITURAS_A_LA_VEZ && cola.length) {
        const { ruta, datos } = cola.shift();
        enCurso++;
        const carpeta = path.dirname(ruta);
        const crearCarpeta = carpetasHechas.has(carpeta) ? Promise.resolve() : fs.promises.mkdir(carpeta, { recursive: true }).then(() => carpetasHechas.add(carpeta));
        crearCarpeta
          .then(() => fs.promises.writeFile(ruta, datos))
          .then(() => {
            enCurso--;
            // Si la cola ya bajó, se sigue leyendo el paquete.
            if (lector.isPaused() && cola.length < 64) lector.resume();
            escribirSiguiente();
            terminarSiYa();
          }, fallar);
      }
    };

    const descompresor = new Unzip((archivo) => {
      if (fallo) return;
      const nombre = archivo.name;
      if (nombre.endsWith("/")) return; // Carpeta: se crea con sus archivos.
      const ruta = path.resolve(raiz, nombre);
      if (path.isAbsolute(nombre) || nombre.split(/[\\/]/).includes("..") || !ruta.startsWith(raiz + path.sep)) {
        return fallar(new Error(`ruta no permitida en el paquete: ${nombre}`));
      }
      const partes = [];
      archivo.ondata = (error, datos, final) => {
        if (error) return fallar(error);
        partes.push(datos);
        if (final) {
          cola.push({ ruta, datos: Buffer.concat(partes) });
          escribirSiguiente();
        }
      };
      archivo.start();
    });
    descompresor.register(UnzipInflate);

    lector.on("data", (trozo) => {
      try {
        descompresor.push(trozo);
        // No se acumula demasiado en memoria: se espera a que se escriba lo pendiente.
        if (cola.length >= 64) lector.pause();
      } catch (error) {
        fallar(error);
      }
    });
    lector.on("end", () => {
      if (fallo) return;
      try {
        descompresor.push(new Uint8Array(0), true);
        leido = true;
        terminarSiYa();
      } catch (error) {
        fallar(error);
      }
    });
    lector.on("error", fallar);
  });
}

/** Descarga a un archivo temporal y solo lo deja si tamaño y SHA-512 coinciden con lo publicado. */
async function descargar(url, destino, m) {
  const parcial = `${destino}.parcial`;
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(60 * 60 * 1000) });
    if (!respuesta.ok || !respuesta.body) throw new Error(`GitHub respondió ${respuesta.status} al descargar.`);
    const hash = crypto.createHash("sha512");
    const cuerpo = Readable.fromWeb(/** @type {any} */ (respuesta.body));
    cuerpo.on("data", (trozo) => hash.update(trozo));
    await pipeline(cuerpo, fs.createWriteStream(parcial));
    const tamano = fs.statSync(parcial).size;
    if (tamano !== m.tamano) throw new Error(`Lo descargado mide ${tamano} bytes y se esperaban ${m.tamano}.`);
    if (hash.digest("base64") !== m.sha512) throw new Error("La huella SHA-512 de lo descargado no coincide con la publicada.");
    fs.renameSync(parcial, destino);
  } finally {
    fs.rmSync(parcial, { force: true });
  }
}

function huella(ruta) {
  return new Promise((resolver, rechazar) => {
    const hash = crypto.createHash("sha512");
    fs.createReadStream(ruta)
      .on("data", (t) => hash.update(t))
      .on("end", () => resolver(hash.digest("base64")))
      .on("error", rechazar);
  });
}

const esHuella = (s) => typeof s === "string" && /^[A-Za-z0-9+/]{86}==$/.test(s);
const esTamano = (n) => Number.isSafeInteger(n) && n > 0;

/**
 * Solo se acepta lo esperado: versión x.y.z(-algo), un .exe sin rutas, SHA-512
 * en base64 y tamaño. El paquete de código es opcional (versiones viejas no lo traen).
 */
function validarManifiesto(m) {
  if (!m || typeof m !== "object") return null;
  const { version, archivo, sha512, tamano, electron, recursos } = m;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) return null;
  if (typeof archivo !== "string" || !/^[\w.-]+\.exe$/.test(archivo)) return null;
  if (!esHuella(sha512) || !esTamano(tamano)) return null;
  const conRecursos =
    typeof electron === "string" &&
    /^\d+\.\d+\.\d+$/.test(electron) &&
    recursos &&
    typeof recursos.archivo === "string" &&
    /^[\w.-]+\.zip$/.test(recursos.archivo) &&
    esHuella(recursos.sha512) &&
    esTamano(recursos.tamano);
  return {
    version,
    archivo,
    sha512,
    tamano,
    electron: conRecursos ? electron : null,
    recursos: conRecursos ? { archivo: recursos.archivo, sha512: recursos.sha512, tamano: recursos.tamano } : null,
  };
}

function mensaje(error) {
  return error instanceof Error ? error.message : String(error);
}

/* ── Confirmación al volver a abrir ─────────────────────────────────── */
const archivoPendiente = () => path.join(app.getPath("userData"), "actualizacion-pendiente.json");

function escribirPendiente(datos) {
  try {
    fs.writeFileSync(archivoPendiente(), JSON.stringify(datos));
  } catch (error) {
    registrar(`No se pudo guardar la marca de actualización: ${mensaje(error)}`);
  }
}

/**
 * Al abrir el programa: si antes de cerrarse dejó aplicando una versión,
 * confirma si quedó (y avisa) o si no se completó. Así nadie se queda con la
 * duda de si se actualizó.
 */
function revisarActualizacionTerminada() {
  if (!app.isPackaged) return;
  let pendiente;
  try {
    pendiente = JSON.parse(fs.readFileSync(archivoPendiente(), "utf8"));
  } catch {
    return; // No hay actualización pendiente.
  }
  const minutos = Math.max(0, Math.round((Date.now() - Date.parse(pendiente.inicio)) / 60000));
  const borrar = () => fs.rmSync(archivoPendiente(), { force: true });
  if (versionActiva() === pendiente.version) {
    registrar(`Actualización confirmada: de ${pendiente.desde} a ${pendiente.version} (${minutos} min desde que se cerró).`);
    borrar();
    avisarConNotificacion("Olimpo GYM se actualizó", `Ya tienes la versión ${pendiente.version}. Antes de actualizar se guardó un respaldo de toda la información.`);
  } else if (minutos >= 30 || compararVersiones(versionActiva(), pendiente.version) > 0) {
    registrar(`La actualización a ${pendiente.version} no quedó (sigue la versión ${versionActiva()}); se volverá a intentar.`);
    borrar();
  }
}

function avisarConNotificacion(titulo, cuerpo) {
  try {
    if (!Notification.isSupported()) return;
    notificacion = new Notification({ title: titulo, body: cuerpo, icon: path.join(__dirname, "icono.png") });
    notificacion.show();
  } catch (error) {
    registrar(`No se pudo mostrar la notificación: ${mensaje(error)}`);
  }
}

module.exports = {
  buscarActualizacion,
  revisarActualizacionTerminada,
  iniciarActualizaciones,
  versionLista,
  actualizarAhora,
  detenerCierreParaRespaldar,
  seEstaCerrandoParaActualizar,
  instalarAlSalir,
  compararVersiones,
  // Para pruebas.
  extraerZip,
  validarManifiesto,
};
