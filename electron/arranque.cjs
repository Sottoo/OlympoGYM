/**
 * Primer archivo que corre el programa. Decide con qué código arrancar: el
 * instalado, o una versión más nueva que el actualizador ya descargó y
 * comprobó (ver versiones.cjs). Va dentro del instalador y no cambia con las
 * actualizaciones, así que es a propósito pequeño y no debe fallar.
 */
const { app } = require("electron");
const path = require("node:path");
const { elegirVersion, revertirVersion } = require("./versiones.cjs");

const elegida = elegirVersion();

if (elegida) {
  process.env.OLIMPO_RAIZ = elegida.raiz;
  process.env.OLIMPO_VERSION = elegida.version;
  if (elegida.probando) process.env.OLIMPO_PROBANDO = "1";
  try {
    require(path.join(elegida.raiz, "electron", "main.cjs"));
  } catch (error) {
    // El código descargado ni siquiera cargó: se regresa a la versión anterior y se vuelve a abrir.
    revertirVersion(`no cargó: ${error instanceof Error ? error.message : error}`);
    app.relaunch();
    app.exit(0);
  }
} else {
  require("./main.cjs");
}
