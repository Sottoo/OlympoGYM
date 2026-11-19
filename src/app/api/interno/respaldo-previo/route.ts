import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { guardarRespaldo } from "@/infrastructure/respaldo/respaldo";
import { ARCHIVO_BASE } from "@/infrastructure/sqlite/baseDeDatos";

export const dynamic = "force-dynamic";

/**
 * Respaldo antes de instalar una versión nueva. Solo lo pide el propio
 * programa de escritorio (electron/actualizador.cjs), con la llave aleatoria
 * que le pasa al servidor al arrancarlo; no depende de la sesión, porque al
 * actualizar puede estar abierta cualquier cuenta (o ninguna, al cerrar).
 *
 * Antes de responder "listo" vuelve a abrir el .zip desde el disco y revisa
 * que traiga la base de datos completa: si no, la actualización no se hace.
 */
export async function POST(peticion: Request) {
  if (!llaveCorrecta(peticion.headers.get("x-olimpo-interno"))) return Response.json({ ok: false, error: "No permitido." }, { status: 403 });
  try {
    const { ruta, archivo } = guardarRespaldo("antes-de-actualizar");
    const entradas = unzipSync(readFileSync(ruta), { filter: (f) => f.name === ARCHIVO_BASE });
    const base = entradas[ARCHIVO_BASE];
    // Toda base SQLite empieza con este encabezado.
    const encabezado = base ? Buffer.from(base.subarray(0, 16)).toString("latin1") : "";
    if (!base || base.byteLength < 1024 || encabezado !== "SQLite format 3\u0000") {
      return Response.json({ ok: false, error: "El respaldo se guardó incompleto." }, { status: 500 });
    }
    return Response.json({ ok: true, archivo: archivo.nombre });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

function llaveCorrecta(recibida: string | null): boolean {
  const esperada = process.env.OLIMPO_LLAVE_INTERNA;
  if (!esperada || esperada.length < 32 || !recibida) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
