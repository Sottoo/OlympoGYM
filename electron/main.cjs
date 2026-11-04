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
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const NOMBRE = "Olimpo GYM";
const MODO_DEV = process.argv.includes("--dev");
const URL_DEV = "http://localhost:3000";

/** @type {Electron.UtilityProcess | null} */
let servidor = null;
/** @type {BrowserWindow | null} */
let ventana = null;
let saliendo = false;
/** Puerto del servidor interno: solo las páginas de ese origen pueden usar el puente con Windows. */
let puertoApp = MODO_DEV ? 3000 : 0;
const RUTA_RESPALDOS = () => path.join(app.getPath("documents"), NOMBRE, "Respaldos");

if (!app.requestSingleInstanceLock()) {
  // Ya hay una ventana abierta: se enfoca esa en lugar de abrir otra.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
}

async function iniciar() {
  Menu.setApplicationMenu(null);
  registrarPuente();
  ventana = crearVentana();
  try {
    const url = MODO_DEV ? URL_DEV : await iniciarServidor();
    await ventana.loadURL(url);
  } catch (error) {
    dialog.showErrorBox(NOMBRE, `No se pudo abrir el programa.\n\n${error instanceof Error ? error.message : error}`);
    app.quit();
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
 * una carpeta, mostrar un respaldo en el Explorador y abrir WhatsApp.
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
}

function esDeLaApp(url) {
  const { protocol, hostname, port } = new URL(url);
  if (protocol === "data:") return true;
  return (hostname === "127.0.0.1" || hostname === "localhost") && port === String(puertoApp);
}

/** La petición viene de la ventana del programa (no de otra página). */
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
  const carpeta = app.isPackaged
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
    },
  });
  servidor.stdout?.pipe(bitacora);
  servidor.stderr?.pipe(bitacora);
  servidor.on("exit", (codigo) => {
    servidor = null;
    if (saliendo) return;
    dialog.showErrorBox(NOMBRE, `El programa se detuvo inesperadamente (código ${codigo}). Vuelve a abrirlo.`);
    app.quit();
  });

  await esperarRespuesta(`http://127.0.0.1:${puerto}`);
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

async function esperarRespuesta(url, limiteMs = 30_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
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
  const html = `<!doctype html><meta charset="utf-8"><title>${NOMBRE}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#161514;color:#e9e5dc;font:500 15px system-ui,sans-serif;letter-spacing:.04em">
<p>Abriendo ${NOMBRE}…</p></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  saliendo = true;
  servidor?.kill();
});
