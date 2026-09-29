import "server-only";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hoyEn } from "@/domain/shared/fechas";
import { entorno, modoDemo } from "../config/entorno";
import { obtenerAlmacen } from "../repositories/memoria/AlmacenMemoria";
import { crearClienteServidor } from "../supabase/clienteServidor";

/**
 * Copia completa de la base de datos en un archivo JSON.
 *
 * El plan gratuito de Supabase no guarda respaldos, así que la app de
 * escritorio deja uno por día en la computadora del gimnasio. Con ese
 * archivo se puede reconstruir todo si algo le pasa al proyecto en línea.
 */

const TABLAS = [
  "personal",
  "planes",
  "socios",
  "suscripciones",
  "pagos",
  "avisos_enviados",
  "productos",
  "ventas",
  "movimientos_inventario",
] as const;

/** Supabase regresa como máximo 1000 filas por consulta. */
const FILAS_POR_PAGINA = 1000;

/** Cuántos respaldos diarios se conservan antes de borrar los más viejos. */
const RESPALDOS_A_CONSERVAR = 60;

export interface Respaldo {
  generadoEn: string;
  origen: "supabase" | "demo";
  tablas: Record<string, unknown[]>;
}

export async function generarRespaldo(): Promise<Respaldo> {
  const generadoEn = new Date().toISOString();
  if (modoDemo) {
    const { avisos, ...resto } = obtenerAlmacen();
    return { generadoEn, origen: "demo", tablas: { ...resto, avisos: [...avisos] } };
  }

  const db = await crearClienteServidor();
  const tablas: Record<string, unknown[]> = {};
  for (const tabla of TABLAS) {
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += FILAS_POR_PAGINA) {
      const { data, error } = await db.from(tabla).select("*").range(desde, desde + FILAS_POR_PAGINA - 1);
      if (error) throw new Error(`No se pudo respaldar la tabla ${tabla}: ${error.message}`);
      filas.push(...data);
      if (data.length < FILAS_POR_PAGINA) break;
    }
    tablas[tabla] = filas;
  }
  return { generadoEn, origen: "supabase", tablas };
}

/**
 * Guarda el respaldo del día si todavía no existe. Solo corre en la app de
 * escritorio, que indica la carpeta en RUTA_RESPALDOS.
 * Devuelve la ruta del archivo creado, o null si no hizo falta.
 */
export async function respaldoDiarioSiFalta(): Promise<string | null> {
  const carpeta = entorno.rutaRespaldos;
  if (!carpeta || modoDemo) return null;

  await mkdir(carpeta, { recursive: true });
  const archivos = (await readdir(carpeta)).filter((a) => /^respaldo-\d{4}-\d{2}-\d{2}\.json$/.test(a)).sort();
  const nombre = `respaldo-${hoyEn(entorno.zonaHoraria)}.json`;
  if (archivos.includes(nombre)) return null;

  const destino = path.join(carpeta, nombre);
  // Se escribe a un temporal y luego se renombra: nunca queda un respaldo a medias.
  const temporal = `${destino}.tmp`;
  await writeFile(temporal, JSON.stringify(await generarRespaldo()), "utf8");
  await rename(temporal, destino);

  const sobrantes = [...archivos, nombre].sort().slice(0, -RESPALDOS_A_CONSERVAR);
  await Promise.all(sobrantes.map((a) => rm(path.join(carpeta, a), { force: true })));
  return destino;
}
