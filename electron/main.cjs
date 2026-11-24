/**
 * App de escritorio de Olimpo GYM.
 *
 * Arranca el servidor de Next.js (ya compilado) dentro de la computadora y lo
 * muestra en una ventana propia, sin navegador. Todo vive en la computadora:
 *   · Datos (base SQLite y fotos): %APPDATA%\Olimpo GYM\datos
 *   · Respaldos diarios:           Documentos\Olimpo GYM\Respaldos
 *
 *   npm run escritorio       usa la versión compilada (.next/standalone)
 *   npm run escritorio:dev   usa `npm run dev` (http://localhost:3000)
 */
const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, shell, utilityProcess } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  buscarActualizacion,
  revisarActualizacionTerminada,
  iniciarActualizaciones,
  versionLista,
  actualizarAhora,
  detenerCierreParaRespaldar,
  seEstaCerrandoParaActualizar,
  instalarAlSalir,
} = require("./actualizador.cjs");
const { raizDelCodigo, confirmarVersion, revertirVersion, limpiarVersionesViejas } = require("./versiones.cjs");
const { reiniciarAgente } = require("./agenteHid.cjs");

const NOMBRE = "Olimpo GYM";
const MODO_DEV = process.argv.includes("--dev");
const URL_DEV = "http://localhost:3000";

/** @type {Electron.UtilityProcess | null} */
let servidor = null;
/** @type {BrowserWindow | null} */
let ventana = null;
let saliendo = false;
/** El servidor ya respondió: a partir de aquí, si se detiene, es una falla. */
let servidorListo = false;
/** Puerto del servidor interno: solo las páginas de ese origen pueden usar el puente con Windows. */
let puertoApp = MODO_DEV ? 3000 : 0;
/** Llave de un solo uso para que solo este programa pida el respaldo previo a actualizar (cambia cada vez que abre). */
const LLAVE_INTERNA = crypto.randomBytes(32).toString("hex");
const RUTA_RESPALDOS = () => path.join(app.getPath("documents"), NOMBRE, "Respaldos");

if (!app.requestSingleInstanceLock()) {
  // Ya hay una ventana abierta: se enfoca esa en lugar de abrir otra.
  app.quit();
} else {
  app.on("second-instance", () => {
    // Se está respaldando para actualizar con la ventana ya cerrada: se reabre al terminar.
    if (seEstaCerrandoParaActualizar()) return;
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
}

async function iniciar() {
  Menu.setApplicationMenu(null);
  // Mismo id que el instalador: así Windows muestra las notificaciones a nombre del programa.
  app.setAppUserModelId("mx.olimpogym.panel");
  // Si una actualización se está instalando, abrir el programa a medias lo rompe
  // (los archivos se están reemplazando): se avisa y no se abre.
  if (await actualizacionInstalandose()) return;
  registrarPuente();
  ventana = crearVentana();
  await abrirPrograma();
}

/** Arranca el servidor y carga la ventana. Si algo falla, ofrece reintentar en lugar de cerrarse. */
async function abrirPrograma() {
  try {
    const url = MODO_DEV ? URL_DEV : await iniciarServidor();
    await ventana?.loadURL(url);
    // Busca versiones nuevas por detrás; si descarga una, la interfaz muestra el aviso.
    iniciarActualizaciones({
      avisar: (info) => ventana?.webContents.send("olimpo:actualizacion", info),
      mostrar: mostrarActualizacion,
      respaldar: respaldarAntesDeActualizar,
    });
    revisarActualizacionTerminada();
    // Ya abrió bien: las carpetas de versiones viejas sobran.
    setTimeout(limpiarVersionesViejas, 60_000).unref();
  } catch (error) {
    detenerServidor();
    // Es una versión recién descargada y no abrió: se regresa sola a la anterior.
    if (process.env.OLIMPO_PROBANDO === "1") {
      revertirVersion(error instanceof Error ? error.message : String(error));
      app.relaunch();
      app.exit(0);
      return;
    }
    const opciones = {
      type: "error",
      title: NOMBRE,
      message: "No se pudo abrir el programa.",
      detail: `${error instanceof Error ? error.message : error}\n\nSi se acaba de instalar o actualizar, espera un minuto y da «Reintentar».\nDetalle técnico: ${path.join(app.getPath("userData"), "servidor.log")}`,
      buttons: ["Reintentar", "Cerrar"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const { response } = ventana && !ventana.isDestroyed() ? await dialog.showMessageBox(ventana, opciones) : await dialog.showMessageBox(opciones);
    if (response === 0 && ventana && !ventana.isDestroyed()) {
      await ventana.loadURL(pantallaDeCarga()).catch(() => {});
      return abrirPrograma();
    }
    app.quit();
  }
}

/**
 * ¿Se está instalando una versión del programa? (el instalador sigue corriendo).
 * Al terminar una instalación manual, el instalador abre el programa y se cierra
 * en un par de segundos: por eso se espera un poco antes de decidir. Si sigue
 * instalándose, se avisa con una notificación y este intento se cierra solo.
 */
async function actualizacionInstalandose() {
  if (!app.isPackaged || process.platform !== "win32") return false;
  // Lo abrió el instalador al terminar ("Finalizar", o al actualizar): el instalador que se ve
  // corriendo es ese mismo, cerrándose. No es una instalación a medias.
  if (process.argv.includes("--desde-instalador") || process.argv.includes("--updated")) return false;
  for (let i = 0; i < 8; i++) {
    if (!(await instaladorCorriendo())) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    new Notification({
      title: `${NOMBRE} se está instalando`,
      body: "Espera a que termine la instalación y vuelve a abrirlo (si es una actualización, se abre solo al terminar).",
      icon: path.join(__dirname, "icono.png"),
    }).show();
  } catch {
    // Sin notificación: igual se cierra.
  }
  setTimeout(() => app.quit(), 1500);
  return true;
}

/** Busca el instalador de Olimpo GYM entre los procesos de Windows (nunca tarda más de 5 s). */
function instaladorCorriendo() {
  return new Promise((resolver) => {
    execFile("tasklist", ["/FO", "CSV", "/NH", "/FI", "IMAGENAME eq Olimpo*"], { windowsHide: true, timeout: 5000 }, (error, salida) => {
      if (error) return resolver(false);
      resolver(/"Olimpo[^"]*Setup[^"]*\.exe"/i.test(String(salida)));
    });
  });
}

function detenerServidor() {
  if (!servidor) return;
  const s = servidor;
  servidor = null;
  servidorListo = false;
  try {
    s.kill();
  } catch {
    // Ya se había detenido.
  }
}

function crearVentana() {
  const nueva = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 660,
    show: false,
    title: NOMBRE,
    backgroundColor: "#161514",
    icon: path.join(__dirname, "icono.png"),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.cjs") },
  });
  nueva.once("ready-to-show", () => {
    nueva.maximize();
    nueva.show();
  });
  nueva.loadURL(pantallaDeCarga());

  // WhatsApp y cualquier otro enlace externo se abren fuera de la app.
  nueva.webContents.setWindowOpenHandler(({ url }) => {
    abrirFuera(url);
    return { action: "deny" };
  });
  nueva.webContents.on("will-navigate", (evento, url) => {
    if (!esDeLaApp(url)) {
      evento.preventDefault();
      abrirFuera(url);
    }
  });
  nueva.on("closed", () => (ventana = null));
  return nueva;
}

/**
 * Funciones de Windows que la interfaz puede pedir (ver preload.cjs): elegir
 * una carpeta, mostrar un respaldo en el Explorador, abrir WhatsApp e
 * instalar el programa del lector de huellas.
 * Solo responden a la página del propio programa y solo aceptan rutas
 * locales (no de red): archivos .zip y carpetas que existen.
 */
function registrarPuente() {
  ipcMain.handle("olimpo:elegir-carpeta", async (evento) => {
    if (!delPrograma(evento)) return null;
    const r = await dialog.showOpenDialog(ventana, {
      title: "Elige dónde copiar los respaldos (Google Drive, OneDrive o una USB)",
      properties: ["openDirectory", "createDirectory"],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle("olimpo:mostrar-archivo", (evento, ruta) => {
    if (!delPrograma(evento) || !rutaLocal(ruta)) return;
    if (ruta.toLowerCase().endsWith(".zip") && fs.existsSync(ruta)) shell.showItemInFolder(ruta);
  });
  ipcMain.handle("olimpo:abrir-carpeta", async (evento, ruta) => {
    if (!delPrograma(evento) || !rutaLocal(ruta)) return;
    // Solo la carpeta de respaldos se crea si falta; cualquier otra debe existir ya.
    if (path.resolve(ruta) === path.resolve(RUTA_RESPALDOS())) fs.mkdirSync(ruta, { recursive: true });
    if (fs.existsSync(ruta) && fs.statSync(ruta).isDirectory()) await shell.openPath(ruta);
  });
  ipcMain.handle("olimpo:abrir-whatsapp", async (evento) => {
    if (!delPrograma(evento)) return;
    try {
      await shell.openExternal("whatsapp://send");
    } catch {
      await shell.openExternal("https://web.whatsapp.com/");
    }
  });
  ipcMain.handle("olimpo:instalar-lector", async (evento) => {
    if (!delPrograma(evento)) return { ok: false, error: "Acción no permitida." };
    return instalarProgramaDelLector();
  });
  // El agente del lector de huellas se quedó con el lector apartado o se cayó: se reinicia (ver agenteHid.cjs).
  ipcMain.handle("olimpo:reiniciar-agente-lector", async (evento, opciones) => {
    if (!delPrograma(evento)) return { ok: false, error: "Acción no permitida." };
    const forzar = Boolean(opciones?.forzar);
    const r = await reiniciarAgente({ forzar });
    anotarEnRegistroDelLector(`agente de HID (${forzar ? "reiniciar" : "abrir si no corre"}): ${r.ok ? r.accion : `falló: ${r.error}`}`);
    return r;
  });
  ipcMain.handle("olimpo:actualizacion-lista", (evento) => (delPrograma(evento) ? versionLista() : null));
  // Botón «Buscar actualización»: revisa ya; si hay versión nueva, al terminar de bajarla abre la ventana de actualizar.
  ipcMain.handle("olimpo:buscar-actualizacion", async (evento) => {
    if (!delPrograma(evento)) return { estado: "error", mensaje: "Acción no permitida." };
    const resultado = await buscarActualizacion();
    if (resultado.estado === "lista") mostrarActualizacion();
    return resultado;
  });
  ipcMain.handle("olimpo:actualizar-ahora", async (evento) => (delPrograma(evento) ? actualizarAhora() : { ok: false, error: "Acción no permitida." }));
}

/**
 * Programa del lector de huellas: "HID Authentication Device Client", gratuito
 * de HID. Su licencia no permite incluirlo en el instalador de Olimpo GYM, así
 * que se descarga de la página oficial de HID y se abre su propio instalador
 * (ahí el gimnasio acepta la licencia de HID). Antes de abrirlo se revisa que
 * esté firmado por HID Global; si no, se borra.
 */
const URL_PROGRAMA_LECTOR = "https://crossmatch.hid.gl/lite-client/store/5.2.0/HID%20Authentication%20Device%20Client.exe";
let instalandoLector = false;

async function instalarProgramaDelLector() {
  if (instalandoLector) return { ok: false, error: "La descarga ya está en curso." };
  instalandoLector = true;
  const carpeta = path.join(app.getPath("temp"), NOMBRE);
  const destino = path.join(carpeta, "HID Authentication Device Client.exe");
  try {
    let respuesta;
    try {
      respuesta = await fetch(URL_PROGRAMA_LECTOR);
    } catch {
      return { ok: false, error: "No se pudo descargar el programa del lector. Revisa la conexión a internet e intenta de nuevo." };
    }
    if (!respuesta.ok) return { ok: false, error: `La página de HID no entregó el programa (código ${respuesta.status}). Intenta más tarde.` };
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(destino, Buffer.from(await respuesta.arrayBuffer()));

    const firma = await firmaDigital(destino);
    if (firma.estado !== "Valid" || !/^CN=HID GLOBAL CORPORATION,/i.test(firma.firmante)) {
      fs.rmSync(destino, { force: true });
      return { ok: false, error: "El archivo descargado no tiene la firma de HID Global, así que no se abrió. Intenta de nuevo más tarde." };
    }
    const error = await shell.openPath(destino);
    return error ? { ok: false, error: `No se pudo abrir el instalador: ${error}` } : { ok: true };
  } catch (error) {
    return { ok: false, error: `No se pudo preparar el programa del lector. ${error instanceof Error ? error.message : ""}`.trim() };
  } finally {
    instalandoLector = false;
  }
}

/** Firma Authenticode de un archivo, según Windows (la ruta va por variable de entorno, no dentro del comando). */
function firmaDigital(archivo) {
  return new Promise((resolver) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "$f = Get-AuthenticodeSignature -LiteralPath $env:OLIMPO_ARCHIVO; \"$($f.Status)|$($f.SignerCertificate.Subject)\""],
      { env: { ...process.env, OLIMPO_ARCHIVO: archivo }, windowsHide: true, timeout: 60_000 },
      (error, salida) => {
        const [estado = "", firmante = ""] = error ? [] : String(salida).trim().split("|");
        resolver({ estado, firmante });
      },
    );
  });
}

function esDeLaApp(url) {
  const { protocol, hostname, port } = new URL(url);
  if (protocol === "data:") return true;
  return (hostname === "127.0.0.1" || hostname === "localhost") && port === String(puertoApp);
}

/** La petición viene de la ventana del programa (no de otra página). */
/** Misma bitácora del lector que usa el servidor (datos/huellas.log): ahí se ve todo lo del lector junto. */
function anotarEnRegistroDelLector(texto) {
  try {
    const carpeta = path.join(app.getPath("userData"), "datos");
    fs.mkdirSync(carpeta, { recursive: true });
    fs.appendFileSync(path.join(carpeta, "huellas.log"), `${new Date().toISOString()} ${texto}\n`);
  } catch {
    // Solo es para diagnosticar.
  }
}

function delPrograma(evento) {
  try {
    return esDeLaApp(evento.senderFrame?.url ?? "") && !evento.senderFrame.url.startsWith("data:");
  } catch {
    return false;
  }
}

/** Una ruta de esta computadora (no de red ni relativa). */
function rutaLocal(ruta) {
  return typeof ruta === "string" && path.isAbsolute(ruta) && !ruta.startsWith("\\\\") && !ruta.startsWith("//") && !ruta.split(/[\\/]/).includes("..");
}

function abrirFuera(url) {
  if (/^(https?|whatsapp|mailto):/.test(url)) shell.openExternal(url);
}

/** Levanta el servidor compilado en un proceso aparte y espera a que responda. */
async function iniciarServidor() {
  // Versión descargada por el actualizador, la instalada, o la compilada del proyecto (al desarrollar).
  const carpeta = raizDelCodigo()
    ? path.join(raizDelCodigo(), "servidor")
    : app.isPackaged
      ? path.join(process.resourcesPath, "servidor")
      : path.join(__dirname, "..", ".next", "standalone");
  const script = path.join(carpeta, "server.js");
  if (!fs.existsSync(script)) {
    throw new Error(`Falta la versión compilada en ${carpeta}. Ejecuta "npm run build:escritorio".`);
  }

  const puerto = await puertoLibre();
  puertoApp = puerto;
  const bitacora = fs.createWriteStream(path.join(app.getPath("userData"), "servidor.log"), { flags: "a" });
  bitacora.write(`\n── ${new Date().toISOString()} · puerto ${puerto}\n`);

  servidor = utilityProcess.fork(script, [], {
    cwd: carpeta,
    serviceName: `Servidor ${NOMBRE}`,
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(puerto),
      RUTA_DATOS: path.join(app.getPath("userData"), "datos"),
      RUTA_RESPALDOS: RUTA_RESPALDOS(),
      OLIMPO_LLAVE_INTERNA: LLAVE_INTERNA,
    },
  });
  servidor.stdout?.pipe(bitacora);
  servidor.stderr?.pipe(bitacora);
  const este = servidor;
  servidor.on("exit", (codigo) => {
    bitacora.write(`── ${new Date().toISOString()} · el servidor se detuvo (código ${codigo})\n`);
    // Si ya se reemplazó (Reintentar), esta salida no importa.
    if (servidor !== este) return;
    servidor = null;
    // Mientras arranca, la falla la atiende abrirPrograma (con «Reintentar»).
    if (saliendo || !servidorListo) return;
    servidorListo = false;
    dialog.showErrorBox(NOMBRE, `El programa se detuvo inesperadamente (código ${codigo}). Vuelve a abrirlo.\n\nDetalle técnico: ${path.join(app.getPath("userData"), "servidor.log")}`);
    app.quit();
  });

  await esperarRespuesta(`http://127.0.0.1:${puerto}`);
  servidorListo = true;
  // Si es una versión recién descargada, ya quedó probada.
  confirmarVersion();
  // La ventana usa "localhost" porque así arma Next.js sus redirecciones; si se
  // mezclara con 127.0.0.1, la sesión (cookies) quedaría en dos sitios distintos.
  return `http://localhost:${puerto}`;
}

function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const prueba = net.createServer();
    prueba.unref();
    prueba.on("error", rechazar);
    prueba.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {net.AddressInfo} */ (prueba.address());
      prueba.close(() => resolver(port));
    });
  });
}

/**
 * Espera a que el servidor conteste. La primera vez después de instalar o
 * actualizar puede tardar (el antivirus revisa los archivos nuevos): por eso
 * hasta 2 minutos. Si el servidor se cae mientras tanto, avisa de inmediato.
 */
async function esperarRespuesta(url, limiteMs = 120_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (!servidor) throw new Error("El servidor interno se detuvo al arrancar.");
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("El servidor interno tardó demasiado en arrancar.");
}

function pantallaDeCarga() {
  // Recién aplicada una versión nueva: se dice que es el final de la actualización, no un arranque cualquiera.
  const actualizando = process.env.OLIMPO_PROBANDO === "1";
  const titulo = actualizando ? `Terminando de actualizar a la versión ${process.env.OLIMPO_VERSION}…` : `Abriendo ${NOMBRE}…`;
  const detalle = actualizando ? "No cierres el programa. En unos segundos queda listo." : "La primera vez después de instalar o actualizar puede tardar un poco.";
  const html = `<!doctype html><meta charset="utf-8"><title>${NOMBRE}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#161514;color:#e9e5dc;font:500 15px system-ui,sans-serif;letter-spacing:.04em">
<div style="text-align:center"><p style="margin:0 0 6px">${titulo}</p>
<p style="margin:0;font-size:12px;opacity:.55">${detalle}</p></div></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (evento) => {
  // Con una versión nueva lista, primero se respalda (el servidor sigue vivo para hacerlo).
  if (detenerCierreParaRespaldar(evento)) return;
  saliendo = true;
  servidor?.kill();
});
// Con el servidor ya detenido, si hay una versión nueva respaldada se instala.
app.on("will-quit", instalarAlSalir);

/** Clic en la notificación de versión nueva: trae la ventana al frente y abre el aviso para actualizar. */
function mostrarActualizacion() {
  if (!ventana || ventana.isDestroyed()) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.show();
  ventana.focus();
  ventana.webContents.send("olimpo:mostrar-actualizacion");
}

/**
 * Pide al servidor interno el respaldo previo a actualizar (base y fotos en
 * Documentos\Olimpo GYM\Respaldos). El servidor lo comprueba antes de decir
 * que salió bien. Nunca espera más de `limiteMs`.
 */
async function respaldarAntesDeActualizar(limiteMs) {
  if (!servidor || !puertoApp) return { ok: false, error: "el programa no terminó de abrir" };
  try {
    const respuesta = await fetch(`http://127.0.0.1:${puertoApp}/api/interno/respaldo-previo`, {
      method: "POST",
      headers: { "x-olimpo-interno": LLAVE_INTERNA },
      redirect: "manual",
      signal: AbortSignal.timeout(limiteMs),
    });
    const datos = await respuesta.json().catch(() => null);
    if (datos && datos.ok === true && typeof datos.archivo === "string") return { ok: true, archivo: datos.archivo };
    return { ok: false, error: (datos && typeof datos.error === "string" && datos.error) || `respuesta ${respuesta.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "el respaldo tardó demasiado" : error instanceof Error ? error.message : String(error) };
  }
}
