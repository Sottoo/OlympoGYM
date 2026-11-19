/** Las imágenes del lector pesan ~150 KB; más de 3 MB no es una huella. */
const TAMANO_MAXIMO = 3_000_000;

export const deBase64 = (texto: string) => new Uint8Array(Buffer.from(texto, "base64"));

/** Lee `{ imagen: base64, ...resto }` de la petición. Null si no viene una imagen válida. */
export async function leerCuerpo(peticion: Request): Promise<({ imagen: Uint8Array } & Record<string, unknown>) | null> {
  if (Number(peticion.headers.get("content-length") ?? 0) > TAMANO_MAXIMO) return null;
  try {
    const datos = (await peticion.json()) as Record<string, unknown>;
    if (typeof datos.imagen !== "string" || datos.imagen.length === 0 || datos.imagen.length > TAMANO_MAXIMO) return null;
    return { ...datos, imagen: deBase64(datos.imagen) };
  } catch {
    return null;
  }
}
