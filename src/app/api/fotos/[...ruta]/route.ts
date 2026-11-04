import { readFile } from "node:fs/promises";
import path from "node:path";
import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { rutaFotos } from "@/infrastructure/sqlite/baseDeDatos";
import { RUTA_FOTO_VALIDA } from "@/infrastructure/sqlite/AlmacenFotosLocal";

const TIPOS: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

/** Entrega la foto de un socio o de un producto. Solo con sesión iniciada. */
export async function GET(_: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return new Response("No autorizado", { status: 401 });

  const ruta = (await params).ruta.join("/");
  if (!RUTA_FOTO_VALIDA.test(ruta)) return new Response("No encontrada", { status: 404 });
  try {
    const imagen = await readFile(path.join(rutaFotos(), ruta));
    return new Response(imagen, {
      headers: { "Content-Type": TIPOS[ruta.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("No encontrada", { status: 404 });
  }
}
