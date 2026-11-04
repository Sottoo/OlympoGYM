import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import { rutaFotos } from "./baseDeDatos";

const EXTENSIONES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Una ruta de foto válida: carpeta del socio o producto y archivo, sin saltos a otras carpetas. */
export const RUTA_FOTO_VALIDA = /^[0-9a-f-]{36}\/\d+\.(webp|jpg|png)$/;

/**
 * Fotos de los socios y de los productos en una carpeta de la computadora, junto a la base de
 * datos. Se muestran a través de /api/fotos, que exige sesión iniciada.
 */
export class AlmacenFotosLocal implements AlmacenFotos {
  async guardar(duenoId: string, imagen: Uint8Array, tipo: string): Promise<string> {
    // Nombre nuevo en cada cambio: así nunca se muestra una foto vieja guardada en caché.
    const ruta = `${duenoId}/${Date.now()}.${EXTENSIONES[tipo] ?? "img"}`;
    if (!RUTA_FOTO_VALIDA.test(ruta)) throw new Error("Ruta de foto no válida.");
    const destino = path.join(rutaFotos(), ruta);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, imagen);
    return ruta;
  }

  async urlTemporal(ruta: string): Promise<string | null> {
    return RUTA_FOTO_VALIDA.test(ruta) ? `/api/fotos/${ruta}` : null;
  }

  async borrar(ruta: string): Promise<void> {
    if (RUTA_FOTO_VALIDA.test(ruta)) await rm(path.join(rutaFotos(), ruta), { force: true });
  }
}
