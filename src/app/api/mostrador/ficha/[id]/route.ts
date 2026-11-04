import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";

export const dynamic = "force-dynamic";

/** La ficha de entrada de un socio (si puede pasar, su plan, sus parches del mes). Consulta GET por la misma razón que la búsqueda. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return Response.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const { id } = await params;
  try {
    return Response.json(await (await casosDeUso()).consultarFichaDeEntrada.ejecutar(id));
  } catch (error) {
    return Response.json({ error: mensajeDeError(error) }, { status: 404 });
  }
}
