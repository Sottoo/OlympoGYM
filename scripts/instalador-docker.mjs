/**
 * Arma el instalador de Windows dentro de Docker (imagen oficial
 * electronuserland/builder:wine) en lugar de en Windows directamente.
 *
 * Para qué: electron-builder ejecuta un .exe temporal sin firmar para crear
 * el desinstalador, y Smart App Control de Windows 11 lo bloquea
 * ("spawn UNKNOWN"). Dentro del contenedor (Linux + Wine) ese paso no pasa
 * por Smart App Control. Requiere Docker Desktop abierto.
 *
 * Se usa después de `npm run build:escritorio` (ver "instalador:docker" en
 * package.json). npmRebuild=false: no hay módulos nativos y así no se tocan
 * los node_modules de Windows desde Linux.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const r = spawnSync(
  "docker",
  [
    "run", "--rm",
    "-v", `${raiz}:/project`,
    "-v", "olimpo-cache-electron-builder:/root/.cache/electron-builder",
    "-v", "olimpo-cache-electron:/root/.cache/electron",
    "-w", "/project",
    "electronuserland/builder:wine",
    "node", "node_modules/electron-builder/cli.js", "--win", "--x64", "-c.npmRebuild=false",
  ],
  { stdio: "inherit" },
);
if (r.error) console.error("No se pudo ejecutar Docker. ¿Está abierto Docker Desktop?", r.error.message);
process.exit(r.status ?? 1);
