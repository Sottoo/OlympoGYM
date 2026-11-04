import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";

export const dynamic = "force-dynamic";

/**
 * Búsqueda del mostrador mientras se escribe. Es una consulta normal (GET) y
 * no una acción de servidor: así varias búsquedas pueden ir al mismo tiempo,
 * la vieja se cancela al seguir escribiendo y ningún botón ni enlace tiene
 * que esperar a que termine.
 */
export async function GET(peticion: Request) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return Response.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const texto = new URL(peticion.url).searchParams.get("q") ?? "";
  try {
    return Response.json(await (await casosDeUso()).buscarSocioEnMostrador.ejecutar(texto));
  } catch {
    return Response.json({ error: "No se pudo buscar. Intenta de nuevo." }, { status: 500 });
  }
}
