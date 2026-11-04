import { readFile } from "node:fs/promises";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { rutaDeRespaldo } from "@/infrastructure/respaldo/respaldo";

export const dynamic = "force-dynamic";

/** Descarga un respaldo guardado. El programa pregunta dónde guardarlo (USB, Drive…). */
export async function GET(_: Request, { params }: { params: Promise<{ nombre: string }> }) {
  if (!(await tienePermiso("respaldos.gestionar"))) return new Response("Tu perfil no permite descargar respaldos.", { status: 403 });
  const { nombre } = await params;
  const ruta = rutaDeRespaldo(decodeURIComponent(nombre));
  if (!ruta) return new Response("Ese respaldo no existe.", { status: 404 });
  return new Response(await readFile(ruta), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nombre}"` },
  });
}
