/**
 * Publica el instalador ya generado como versión nueva en GitHub Releases,
 * de donde el programa instalado en el gimnasio la descarga solo (ver
 * electron/actualizador.cjs).
 *
 *   npm run instalador:docker      (genera dist-escritorio/Olimpo GYM Setup X.exe)
 *   npm run publicar -- "Qué cambió en esta versión"
 *
 * Sube dos archivos a la Release vX: el instalador (con guiones en lugar de
 * espacios en el nombre) y actualizacion.json con su versión, tamaño y
 * huella SHA-512. Necesita la herramienta `gh` con la sesión iniciada
 * (`gh auth login`). Nunca reemplaza una versión ya publicada: para corregir
 * algo se sube el número de versión y se publica otra.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { armarPaqueteDeCodigo } from "./paquete-de-codigo.mjs";

const REPOSITORIO = "Sottoo/OlympoGYM";
const raiz = path.resolve(import.meta.dirname, "..");
const paquete = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
const version = paquete.version;
const etiqueta = `v${version}`;
const instalador = path.join(raiz, paquete.build.directories.output, `${paquete.build.productName} Setup ${version}.exe`);
const notas = process.argv.slice(2).join(" ").trim() || `Versión ${version} de Olimpo GYM.`;

// Recién instalado con winget, `gh` no está en la ruta de las terminales ya abiertas.
const GH_INSTALADO = "C:\\Program Files\\GitHub CLI\\gh.exe";
const comandoGh = existsSync(GH_INSTALADO) ? GH_INSTALADO : "gh";

function gh(argumentos, { mostrar = false } = {}) {
  const r = spawnSync(comandoGh, argumentos, { encoding: "utf8", stdio: mostrar ? "inherit" : "pipe" });
  if (r.error) salir("No se encontró la herramienta de GitHub (gh). Instálala con: winget install --id GitHub.cli");
  return r;
}

function salir(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

if (!existsSync(instalador)) salir(`No existe ${instalador}. Primero corre: npm run instalador:docker`);
if (gh(["auth", "status"]).status !== 0) salir("La herramienta de GitHub no tiene sesión. Corre: gh auth login");
if (gh(["release", "view", etiqueta, "-R", REPOSITORIO]).status === 0) {
  salir(`La versión ${version} ya está publicada. Sube el número de versión en package.json, genera el instalador y publica otra vez.`);
}

const sha512 = await new Promise((resolver, rechazar) => {
  const hash = createHash("sha512");
  createReadStream(instalador).on("data", (t) => hash.update(t)).on("end", () => resolver(hash.digest("base64"))).on("error", rechazar);
});
const archivo = `Olimpo-GYM-Setup-${version}.exe`;
const tamano = statSync(instalador).size;

// El paquete de código: lo que bajan las actualizaciones normales (sin instalador).
const electron = JSON.parse(readFileSync(path.join(raiz, "node_modules", "electron", "package.json"), "utf8")).version;
let paqueteDeCodigo;
try {
  paqueteDeCodigo = armarPaqueteDeCodigo({ raiz, version });
} catch (error) {
  salir(error instanceof Error ? error.message : String(error));
}
const recursos = {
  archivo: `recursos-${version}.zip`,
  sha512: createHash("sha512").update(paqueteDeCodigo.datos).digest("base64"),
  tamano: paqueteDeCodigo.datos.byteLength,
};

const carpeta = mkdtempSync(path.join(tmpdir(), "olimpo-publicar-"));
try {
  const copia = path.join(carpeta, archivo);
  const manifiesto = path.join(carpeta, "actualizacion.json");
  const zip = path.join(carpeta, recursos.archivo);
  copyFileSync(instalador, copia);
  writeFileSync(zip, paqueteDeCodigo.datos);
  writeFileSync(manifiesto, JSON.stringify({ version, archivo, sha512, tamano, electron, recursos }, null, 2));

  console.log(
    `Publicando ${etiqueta} en ${REPOSITORIO}: instalador ${(tamano / 1048576).toFixed(1)} MB y código ${(recursos.tamano / 1048576).toFixed(1)} MB (${paqueteDeCodigo.archivos} archivos)…`,
  );
  const r = gh(["release", "create", etiqueta, copia, zip, manifiesto, "-R", REPOSITORIO, "--target", "main", "--title", `Olimpo GYM ${version}`, "--notes", notas, "--latest"], { mostrar: true });
  if (r.status !== 0) salir("GitHub no aceptó la publicación (ver el mensaje de arriba).");
} finally {
  rmSync(carpeta, { recursive: true, force: true });
}

// Comprueba lo que verá el programa del gimnasio.
const publicado = await fetch(`https://github.com/${REPOSITORIO}/releases/latest/download/actualizacion.json`, { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
if (publicado?.version === version && publicado.sha512 === sha512 && publicado.recursos?.sha512 === recursos.sha512) {
  console.log(`\n✓ Publicada la ${version}. Desde la 1.0.0-beta.33 los programas la aplican sin instalador en cuanto la detectan (al abrir o en menos de 5 minutos).\n`);
} else {
  console.warn(`\n! Se subió la ${version}, pero GitHub todavía no la muestra como la última. Revisa en https://github.com/${REPOSITORIO}/releases\n`);
}
