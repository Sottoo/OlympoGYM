/**
 * Arma recursos-<versión>.zip: el código del programa sin el programa base
 * (Electron). Es lo que bajan las actualizaciones normales (ver
 * electron/actualizador.cjs), en lugar del instalador completo:
 *   electron/…    la parte de Electron (main, preload, actualizador, vendor…)
 *   package.json  versión y datos del programa
 *   servidor/…    el servidor compilado (.next/standalone), igual que el instalador
 *
 * Revisa que el servidor compilado sea de esta misma versión: publicar código
 * de otra compilación dejaría al gimnasio con una mezcla.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

function agregarCarpeta(contenido, carpeta, prefijo) {
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    const nombre = `${prefijo}/${entrada.name}`;
    if (entrada.isDirectory()) agregarCarpeta(contenido, ruta, nombre);
    else if (entrada.isFile()) contenido[nombre] = readFileSync(ruta);
  }
}

/** ¿Algún archivo del servidor compilado trae esta versión grabada? (next.config la incrusta). */
function servidorEsDeLaVersion(servidor, version) {
  const buscar = (carpeta) => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = path.join(carpeta, entrada.name);
      if (entrada.isDirectory()) {
        if (buscar(ruta)) return true;
      } else if (entrada.name.endsWith(".js") && statSync(ruta).size < 5_000_000 && readFileSync(ruta, "utf8").includes(`"${version}"`)) {
        return true;
      }
    }
    return false;
  };
  return buscar(path.join(servidor, ".next", "server"));
}

/** @returns {{ datos: Uint8Array, archivos: number }} */
export function armarPaqueteDeCodigo({ raiz, version }) {
  const servidor = path.join(raiz, ".next", "standalone");
  if (!existsSync(path.join(servidor, "server.js"))) throw new Error("No existe .next/standalone. Primero corre: npm run instalador:docker");
  if (!servidorEsDeLaVersion(servidor, version)) {
    throw new Error(`El servidor compilado no es de la versión ${version}. Vuelve a correr: npm run instalador:docker`);
  }
  for (const prohibido of [".env", ".env.local", ".datos"]) {
    if (existsSync(path.join(servidor, prohibido))) throw new Error(`El servidor compilado trae ${prohibido}; no se publica. Vuelve a correr: npm run build:escritorio`);
  }
  const contenido = {};
  agregarCarpeta(contenido, path.join(raiz, "electron"), "electron");
  contenido["package.json"] = readFileSync(path.join(raiz, "package.json"));
  agregarCarpeta(contenido, servidor, "servidor");
  return { datos: zipSync(contenido, { level: 6 }), archivos: Object.keys(contenido).length };
}
