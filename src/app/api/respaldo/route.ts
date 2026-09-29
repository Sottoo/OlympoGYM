import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { generarRespaldo } from "@/infrastructure/respaldo/respaldo";

export const dynamic = "force-dynamic";

/** Descarga una copia completa de la base de datos (para guardarla en una USB, por ejemplo). */
export async function GET() {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return new Response("No autorizado", { status: 401 });

  const respaldo = await generarRespaldo();
  return new Response(JSON.stringify(respaldo), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="respaldo-olimpo-${respaldo.generadoEn.slice(0, 10)}.json"`,
    },
  });
}
