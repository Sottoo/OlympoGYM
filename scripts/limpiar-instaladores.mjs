/**
 * Después de `electron-builder`, quita de dist-escritorio solo los archivos de
 * trabajo que genera el empaquetador (win-unpacked, .blockmap, latest.yml,
 * builder-debug.yml, el .7z intermedio…). Nunca toca instaladores .exe ni
 * archivos .zip u otros que haya guardado la persona: antes borraba todo lo
 * demás, y eso podía llevarse archivos que no eran suyos de borrar.
 * Solo corre si el instalador nuevo existe, así que un error al compilar nunca
 * deja la carpeta a medias.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const paquete = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
const salida = path.join(raiz, paquete.build.directories.output);
const instalador = `${paquete.build.productName} Setup ${paquete.version}.exe`;

if (!existsSync(path.join(salida, instalador))) {
  console.error(`No se encontró ${instalador}; no se borró nada.`);
  process.exit(1);
}

/** Lo que deja electron-builder y no sirve para nada después de compilar. */
const esDeTrabajo = (nombre) =>
  /^win-unpacked(\.tmp(\.lock)?)?$/.test(nombre) ||
  nombre.endsWith(".blockmap") ||
  nombre.endsWith(".nsis.7z") ||
  nombre === "latest.yml" ||
  nombre === "builder-debug.yml" ||
  nombre === "builder-effective-config.yaml";

for (const archivo of readdirSync(salida).filter(esDeTrabajo)) {
  rmSync(path.join(salida, archivo), { recursive: true, force: true });
  console.log(`Quitado ${archivo}`);
}
console.log(`Listo: ${path.join(salida, instalador)}`);
