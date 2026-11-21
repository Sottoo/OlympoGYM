import "server-only";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { entorno } from "../config/entorno";

/**
 * Registro de lo que pasa con cada huella (huellas.log, junto a la base de
 * datos). Sirve para diagnosticar desde lejos «la lee pero no la reconoce»:
 * si no hay líneas, la huella nunca llegó al programa; si las hay, dice si
 * la imagen no sirvió o qué tan cerca estuvo de la huella más parecida.
 * Nunca guarda imágenes ni plantillas. Cuando pasa de 1 MB se guarda como
 * huellas.log.1 y empieza otro.
 */
const TAMANO_MAXIMO = 1024 * 1024;

export function anotarEnRegistroDelLector(texto: string): void {
  try {
    mkdirSync(entorno.rutaDatos, { recursive: true });
    const archivo = path.join(entorno.rutaDatos, "huellas.log");
    if (existsSync(archivo) && statSync(archivo).size > TAMANO_MAXIMO) renameSync(archivo, `${archivo}.1`);
    appendFileSync(archivo, `${new Date().toISOString()} ${texto}\n`);
  } catch {
    // El registro es solo para diagnosticar: si no se puede escribir, el lector sigue funcionando.
  }
}
