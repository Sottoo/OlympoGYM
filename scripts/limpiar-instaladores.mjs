/**
 * Después de `electron-builder`, deja en dist-escritorio solo el instalador
 * recién hecho: borra los de versiones anteriores y los archivos de trabajo
 * (win-unpacked, .blockmap, latest.yml…), que no se usan porque no hay
 * actualizaciones automáticas. Solo corre si el instalador nuevo existe, así
 * que un error al compilar nunca deja la carpeta vacía.
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

for (const archivo of readdirSync(salida).filter((a) => a !== instalador)) {
  rmSync(path.join(salida, archivo), { recursive: true, force: true });
  console.log(`Quitado ${archivo}`);
}
console.log(`Listo: ${path.join(salida, instalador)}`);
