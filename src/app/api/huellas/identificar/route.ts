import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";
import { anotarEnRegistroDelLector } from "@/infrastructure/huellas/registroDelLector";
import { leerCuerpo } from "../cuerpo";

export const dynamic = "force-dynamic";

/** Mostrador: el socio puso el dedo; responde de quién es la huella. Registrar la entrada sigue igual que con la credencial. */
export async function POST(peticion: Request) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return Response.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const cuerpo = await leerCuerpo(peticion);
  if (!cuerpo) {
    anotarEnRegistroDelLector("mostrador: llegó una huella dañada o vacía");
    return Response.json({ error: "La imagen del lector llegó dañada. Pon el dedo otra vez." }, { status: 400 });
  }
  const inicio = Date.now();
  try {
    const { socioId, seguro } = await (await casosDeUso()).identificarPorHuella.ejecutar(cuerpo.imagen);
    anotarEnRegistroDelLector(`mostrador: reconocida (${seguro ? "segura" : "probable"}) en ${Date.now() - inicio} ms`);
    return Response.json({ socioId, seguro });
  } catch (error) {
    const mensaje = mensajeDeError(error);
    anotarEnRegistroDelLector(`mostrador: ${mensaje} (${Date.now() - inicio} ms)`);
    return Response.json({ error: mensaje }, { status: 422 });
  }
}
