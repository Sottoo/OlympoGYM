/**
 * Después de `next build`, deja lista la carpeta .next/standalone para la app
 * de escritorio: copia los archivos estáticos (Next no lo hace solo) y quita
 * cualquier archivo .env y la base de desarrollo (.datos) para que ni claves
 * ni datos de prueba terminen dentro del instalador: el programa se entrega
 * vacío.
 */
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const standalone = path.join(raiz, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error('No existe .next/standalone. Revisa que next.config.ts tenga output: "standalone".');
  process.exit(1);
}

cpSync(path.join(raiz, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
if (existsSync(path.join(raiz, "public"))) cpSync(path.join(raiz, "public"), path.join(standalone, "public"), { recursive: true });

for (const archivo of readdirSync(standalone).filter((a) => a.startsWith(".env"))) {
  rmSync(path.join(standalone, archivo));
  console.log(`Quitado ${archivo} de la versión de escritorio.`);
}
if (existsSync(path.join(standalone, ".datos"))) {
  rmSync(path.join(standalone, ".datos"), { recursive: true, force: true });
  console.log("Quitada la base de desarrollo (.datos) de la versión de escritorio.");
}
console.log("Versión de escritorio lista en .next/standalone");
