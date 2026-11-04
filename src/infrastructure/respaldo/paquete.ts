import "server-only";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { strToU8, type Zippable, zipSync } from "fflate";
import { hoyEn } from "@/domain/shared/fechas";
import { entorno } from "../config/entorno";
import { ARCHIVO_BASE, rutaFotos } from "../sqlite/rutas";

/*
 * Cómo se arma y se guarda un archivo de respaldo. Está aparte de respaldo.ts
 * porque la base de datos lo usa al abrirse (respaldo antes de actualizar),
 * y respaldo.ts a su vez usa la base.
 */

export const PREFIJO = "respaldo-olimpo-";
export const PATRON = /^respaldo-olimpo-\d{4}-\d{2}-\d{2}(-\d{4}-(manual|antes-de-restaurar|antes-de-actualizar))?\.zip$/;
const CONSERVAR_DIARIOS = 30;
const CONSERVAR_OTROS = 20;

export type TipoRespaldo = "diario" | "manual" | "antes-de-restaurar" | "antes-de-actualizar";

function archivosDeCarpeta(carpeta: string, base = carpeta): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    return e.isDirectory() ? archivosDeCarpeta(ruta, base) : [path.relative(base, ruta)];
  });
}

/** Lo que va dentro del respaldo: una copia exacta de la base y las fotos. */
export function contenidoDelRespaldo(db: DatabaseSync): Zippable {
  const temporal = path.join(entorno.rutaDatos, `copia-${Date.now()}.db`);
  // VACUUM INTO hace una copia consistente aunque el programa esté en uso.
  db.exec(`vacuum into '${temporal.replace(/'/g, "''")}'`);
  try {
    // La llave de las sesiones no sale de esta computadora.
    const copia = new DatabaseSync(temporal);
    copia.exec("delete from ajustes where clave = 'llave_sesion'");
    copia.close();
    const info = { programa: "Olimpo GYM", version: entorno.versionPrograma, creadoEn: new Date().toISOString() };
    const contenido: Zippable = {
      [ARCHIVO_BASE]: readFileSync(temporal),
      "info.json": strToU8(JSON.stringify(info, null, 2)),
    };
    for (const relativa of archivosDeCarpeta(rutaFotos())) {
      // Las fotos ya vienen comprimidas: se guardan tal cual, sin volver a comprimir.
      contenido[`fotos/${relativa.split(path.sep).join("/")}`] = [readFileSync(path.join(rutaFotos(), relativa)), { level: 0 }];
    }
    return contenido;
  } finally {
    rmSync(temporal, { force: true });
  }
}

export function nombreDeRespaldo(tipo: TipoRespaldo): string {
  const fecha = hoyEn(entorno.zonaHoraria);
  if (tipo === "diario") return `${PREFIJO}${fecha}.zip`;
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: entorno.zonaHoraria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .replace(":", "");
  return `${PREFIJO}${fecha}-${hora}-${tipo}.zip`;
}

export function escribirSeguro(destino: string, datos: Uint8Array) {
  mkdirSync(path.dirname(destino), { recursive: true });
  // Primero a un temporal y luego se renombra: nunca queda un respaldo a medias.
  writeFileSync(`${destino}.tmp`, datos);
  renameSync(`${destino}.tmp`, destino);
}

export function depurar(carpeta: string) {
  const respaldos = readdirSync(carpeta).filter((a) => PATRON.test(a)).sort();
  const diarios = respaldos.filter((a) => /^respaldo-olimpo-\d{4}-\d{2}-\d{2}\.zip$/.test(a));
  const otros = respaldos.filter((a) => !diarios.includes(a));
  for (const viejo of [...diarios.slice(0, -CONSERVAR_DIARIOS), ...otros.slice(0, -CONSERVAR_OTROS)]) rmSync(path.join(carpeta, viejo), { force: true });
}

/**
 * Respaldo completo de la base tal como está, antes de que una versión nueva
 * del programa le cambie la estructura. Si no se puede guardar, la
 * actualización no se aplica: los datos quedan intactos.
 */
export function respaldoAntesDeActualizar(db: DatabaseSync) {
  try {
    const ruta = path.join(entorno.rutaRespaldos, nombreDeRespaldo("antes-de-actualizar"));
    escribirSeguro(ruta, zipSync(contenidoDelRespaldo(db), { level: 6 }));
    depurar(entorno.rutaRespaldos);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo guardar el respaldo previo a la actualización, así que no se aplicó. Revisa que haya espacio en el disco. (${detalle})`);
  }
}
