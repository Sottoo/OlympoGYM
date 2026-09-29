import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hoyEn } from "@/domain/shared/fechas";
import { entorno, modoDemo } from "../config/entorno";
import { obtenerAlmacen } from "../repositories/memoria/AlmacenMemoria";
import { CARPETA_FOTOS } from "../repositories/supabase/SupabaseAlmacenFotos";
import { crearClienteServidor } from "../supabase/clienteServidor";

/**
 * Copia completa de la base de datos en un archivo JSON.
 *
 * El plan gratuito de Supabase no guarda respaldos, así que la app de
 * escritorio deja uno por día en la computadora del gimnasio. Con ese
 * archivo se puede reconstruir todo si algo le pasa al proyecto en línea.
 * Las fotos de los socios se copian aparte, a la carpeta "fotos".
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
    const { avisos, fotos: _fotos, ...resto } = obtenerAlmacen();
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
  const respaldo = await generarRespaldo();
  await writeFile(temporal, JSON.stringify(respaldo), "utf8");
  await rename(temporal, destino);
  await respaldarFotos(carpeta, respaldo);

  const sobrantes = [...archivos, nombre].sort().slice(0, -RESPALDOS_A_CONSERVAR);
  await Promise.all(sobrantes.map((a) => rm(path.join(carpeta, a), { force: true })));
  return destino;
}

/**
 * Descarga solo las fotos que todavía no están en la computadora: la primera
 * vez copia todas y después, cada día, solo las nuevas.
 */
async function respaldarFotos(carpeta: string, respaldo: Respaldo) {
  const rutas = (respaldo.tablas.socios as { foto: string | null }[]).flatMap((s) => (s.foto ? [s.foto] : []));
  const faltantes = rutas.filter((ruta) => !existsSync(path.join(carpeta, "fotos", ruta)));
  if (faltantes.length === 0) return;

  const db = await crearClienteServidor();
  for (const ruta of faltantes) {
    const { data, error } = await db.storage.from(CARPETA_FOTOS).download(ruta);
    if (error || !data) continue; // Se reintenta en el siguiente respaldo.
    const destino = path.join(carpeta, "fotos", ruta);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from(await data.arrayBuffer()));
  }
}
