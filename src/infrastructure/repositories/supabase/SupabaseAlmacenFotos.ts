import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";

export const CARPETA_FOTOS = "fotos-socios";

const EXTENSIONES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Cuánto dura el enlace para ver una foto. Se genera de nuevo en cada visita. */
const SEGUNDOS_ENLACE = 60 * 60;

/**
 * Fotos en Supabase Storage, en una carpeta privada: solo el personal con
 * sesión iniciada puede verlas, y siempre con enlaces que caducan.
 */
export class SupabaseAlmacenFotos implements AlmacenFotos {
  constructor(private readonly db: SupabaseClient) {}

  async guardar(socioId: string, imagen: Uint8Array, tipo: string): Promise<string> {
    // Nombre nuevo en cada cambio: así nunca se muestra una foto vieja guardada en caché.
    const ruta = `${socioId}/${Date.now()}.${EXTENSIONES[tipo] ?? "img"}`;
    const { error } = await this.db.storage.from(CARPETA_FOTOS).upload(ruta, imagen, { contentType: tipo });
    if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
    return ruta;
  }

  async urlTemporal(ruta: string): Promise<string | null> {
    const { data } = await this.db.storage.from(CARPETA_FOTOS).createSignedUrl(ruta, SEGUNDOS_ENLACE);
    return data?.signedUrl ?? null;
  }

  async borrar(ruta: string): Promise<void> {
    await this.db.storage.from(CARPETA_FOTOS).remove([ruta]);
  }
}
