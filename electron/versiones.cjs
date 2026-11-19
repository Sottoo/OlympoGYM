/**
 * Versiones del código del programa.
 *
 * Las actualizaciones no corren un instalador (Windows bloquea instaladores
 * sin firma): bajan solo el código nuevo (la parte de Electron y el servidor)
 * a %APPDATA%\Olimpo GYM\versiones\<versión> y, al reiniciar, el programa
 * arranca con él. El programa base (Electron) sigue siendo el instalado; si
 * una versión nueva pidiera otro programa base, se usa el instalador.
 *
 * `versiones/actual.json` dice cuál usar:
 *   { version, electron, carpeta, estado: "probando" | "buena", intentos, anterior }
 *   · "probando": recién activada. Si al abrir no llega a funcionar, el
 *     siguiente arranque regresa solo a `anterior` (o a la instalada).
 *   · "buena": ya abrió bien al menos una vez.
 *
 * Este archivo lo usan tanto arranque.cjs (que va dentro del instalador y no
 * cambia con las actualizaciones) como main.cjs y actualizador.cjs (que sí):
 * el formato de actual.json no debe cambiar de forma incompatible.
 */
const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const carpetaVersiones = () => path.join(app.getPath("userData"), "versiones");
const archivoPuntero = () => path.join(carpetaVersiones(), "actual.json");

function leerPuntero() {
  try {
    const p = JSON.parse(fs.readFileSync(archivoPuntero(), "utf8"));
    if (!p || typeof p.version !== "string" || typeof p.carpeta !== "string" || !/^[\w.-]+$/.test(p.carpeta)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Guarda el puntero de forma segura (nunca queda a medias). null lo borra: se usa la versión instalada. */
function escribirPuntero(p) {
  fs.mkdirSync(carpetaVersiones(), { recursive: true });
  if (!p) return fs.rmSync(archivoPuntero(), { force: true });
  const temporal = `${archivoPuntero()}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(p, null, 2));
  fs.renameSync(temporal, archivoPuntero());
}

/** Versión del código que está corriendo (la descargada si se eligió una, si no la instalada). */
const versionActiva = () => process.env.OLIMPO_VERSION || app.getVersion();
/** Carpeta de la versión descargada en uso, o null si corre la instalada. */
const raizDelCodigo = () => process.env.OLIMPO_RAIZ || null;

/**
 * Para arranque.cjs: qué versión usar. Devuelve { raiz, version, probando } o
 * null para usar la instalada. Nunca lanza error.
 */
function elegirVersion() {
  try {
    if (!app.isPackaged) return null;
    let p = leerPuntero();
    if (!p) return null;
    // La vez pasada no llegó a abrir: se regresa a la anterior (o a la instalada).
    if (p.estado === "probando" && (p.intentos ?? 0) >= 1) {
      registrar(`La versión ${p.version} no logró abrir; se regresa a ${p.anterior?.version ?? `la instalada (${app.getVersion()})`}.`);
      escribirPuntero(p.anterior ? { ...p.anterior, estado: "buena", intentos: 0, anterior: null } : null);
      p = leerPuntero();
      if (!p) return null;
    }
    // Esa versión necesita otro programa base, o la instalada ya es igual o más nueva.
    if (p.electron !== process.versions.electron) return null;
    if (compararVersiones(p.version, app.getVersion()) <= 0) return null;
    const raiz = path.join(carpetaVersiones(), p.carpeta);
    if (!fs.existsSync(path.join(raiz, "electron", "main.cjs")) || !fs.existsSync(path.join(raiz, "servidor", "server.js"))) {
      registrar(`Faltan archivos de la versión ${p.version}; se usa la instalada.`);
      return null;
    }
    if (p.estado === "probando") escribirPuntero({ ...p, intentos: (p.intentos ?? 0) + 1 });
    return { raiz, version: p.version, probando: p.estado === "probando" };
  } catch (error) {
    registrar(`No se pudo elegir la versión del programa (${mensaje(error)}); se usa la instalada.`);
    return null;
  }
}

/** La versión en prueba ya abrió bien: queda como buena. */
function confirmarVersion() {
  if (process.env.OLIMPO_PROBANDO !== "1") return;
  try {
    const p = leerPuntero();
    if (p && p.version === versionActiva() && p.estado === "probando") {
      escribirPuntero({ ...p, estado: "buena", intentos: 0 });
      registrar(`La versión ${p.version} abrió bien.`);
    }
    delete process.env.OLIMPO_PROBANDO;
  } catch (error) {
    registrar(`No se pudo confirmar la versión: ${mensaje(error)}`);
  }
}

/** La versión en prueba no funcionó: se vuelve a la anterior (o a la instalada). */
function revertirVersion(motivo) {
  try {
    const p = leerPuntero();
    if (!p) return;
    registrar(`La versión ${p.version} no funcionó (${motivo}); se regresa a ${p.anterior?.version ?? `la instalada (${app.getVersion()})`}.`);
    escribirPuntero(p.anterior ? { ...p.anterior, estado: "buena", intentos: 0, anterior: null } : null);
  } catch (error) {
    registrar(`No se pudo regresar a la versión anterior: ${mensaje(error)}`);
  }
}

/**
 * Borra carpetas de versiones VIEJAS que ya no se usan. Nunca toca: la actual,
 * su anterior, ni ninguna más nueva que la que está corriendo (una descargada
 * que espera aplicarse, o una que se está preparando). Borra sin bloquear la
 * ventana (son miles de archivos).
 */
async function limpiarVersionesViejas() {
  try {
    const p = leerPuntero();
    const conservar = new Set([p?.carpeta, p?.anterior?.carpeta].filter(Boolean));
    const activa = versionActiva();
    for (const nombre of await fs.promises.readdir(carpetaVersiones())) {
      if (nombre === "actual.json" || nombre.endsWith(".tmp") || conservar.has(nombre)) continue;
      const version = nombre.replace(/\.preparando$/, "");
      if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) continue;
      if (compararVersiones(version, activa) >= 0) continue;
      await fs.promises.rm(path.join(carpetaVersiones(), nombre), { recursive: true, force: true });
    }
  } catch {
    // Si no se puede, se intenta otro día.
  }
}

/**
 * Compara versiones al estilo semver: 1.0.0-beta.9 < 1.0.0-beta.10 < 1.0.0 < 1.0.1.
 * Devuelve negativo, 0 o positivo.
 */
function compararVersiones(a, b) {
  const partir = (v) => {
    const [principal, previa] = v.split(/-(.*)/s);
    return { numeros: principal.split(".").map(Number), previa: previa ? previa.split(".") : [] };
  };
  const x = partir(a);
  const y = partir(b);
  for (let i = 0; i < 3; i++) if (x.numeros[i] !== y.numeros[i]) return x.numeros[i] - y.numeros[i];
  if (!x.previa.length || !y.previa.length) return y.previa.length - x.previa.length;
  for (let i = 0; i < Math.max(x.previa.length, y.previa.length); i++) {
    const p = x.previa[i];
    const q = y.previa[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** Una línea en %APPDATA%\Olimpo GYM\actualizaciones.log (no crece sin fin). */
function registrar(texto) {
  try {
    const archivo = path.join(app.getPath("userData"), "actualizaciones.log");
    if (fs.existsSync(archivo) && fs.statSync(archivo).size > 256 * 1024) {
      fs.writeFileSync(archivo, fs.readFileSync(archivo, "utf8").split("\n").slice(-1500).join("\n"));
    }
    fs.appendFileSync(archivo, `${new Date().toISOString()} ${texto}\n`);
  } catch {
    // Sin bitácora no pasa nada.
  }
}

function mensaje(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  carpetaVersiones,
  leerPuntero,
  escribirPuntero,
  versionActiva,
  raizDelCodigo,
  elegirVersion,
  confirmarVersion,
  revertirVersion,
  limpiarVersionesViejas,
  compararVersiones,
  registrar,
};
