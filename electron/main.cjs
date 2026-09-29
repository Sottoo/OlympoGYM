/**
 * App de escritorio de Olimpo GYM.
 *
 * Arranca el servidor de Next.js (ya compilado) dentro de la computadora y lo
 * muestra en una ventana propia, sin navegador. Los datos viven en Supabase;
 * los respaldos diarios se guardan en Documentos\Olimpo GYM\Respaldos.
 *
 *   npm run escritorio       usa la versión compilada (.next/standalone)
 *   npm run escritorio:dev   usa `npm run dev` (http://localhost:3000)
 */
const { app, BrowserWindow, Menu, dialog, shell, utilityProcess } = require("electron");
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
  ventana = crearVentana();
  try {
    const url = MODO_DEV ? URL_DEV : await iniciarServidor();
    await ventana.loadURL(url);
  } catch (error) {
    dialog.showErrorBox(NOMBRE, `No se pudo abrir el sistema.\n\n${error instanceof Error ? error.message : error}`);
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
    backgroundColor: "#0f0f11",
    icon: path.join(__dirname, "icono.png"),
    webPreferences: { contextIsolation: true, sandbox: true },
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

function esDeLaApp(url) {
  const { protocol, hostname } = new URL(url);
  return protocol === "data:" || hostname === "127.0.0.1" || hostname === "localhost";
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
      RUTA_RESPALDOS: path.join(app.getPath("documents"), NOMBRE, "Respaldos"),
    },
  });
  servidor.stdout?.pipe(bitacora);
  servidor.stderr?.pipe(bitacora);
  servidor.on("exit", (codigo) => {
    servidor = null;
    if (saliendo) return;
    dialog.showErrorBox(NOMBRE, `El sistema se detuvo inesperadamente (código ${codigo}). Vuelve a abrirlo.`);
    app.quit();
  });

  const url = `http://127.0.0.1:${puerto}`;
  await esperarRespuesta(url);
  return url;
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
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0f0f11;color:#fff;font:600 18px system-ui,sans-serif;letter-spacing:.04em">
<p style="opacity:.7">Abriendo ${NOMBRE}…</p></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  saliendo = true;
  servidor?.kill();
});
