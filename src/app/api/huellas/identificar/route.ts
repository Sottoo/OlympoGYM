import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";
import { leerCuerpo } from "../cuerpo";

export const dynamic = "force-dynamic";

/** Mostrador: el socio puso el dedo; responde de quién es la huella. Registrar la entrada sigue igual que con la credencial. */
export async function POST(peticion: Request) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return Response.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const cuerpo = await leerCuerpo(peticion);
  if (!cuerpo) return Response.json({ error: "La imagen del lector llegó dañada. Pon el dedo otra vez." }, { status: 400 });
  try {
    return Response.json({ socioId: await (await casosDeUso()).identificarPorHuella.ejecutar(cuerpo.imagen) });
  } catch (error) {
    return Response.json({ error: mensajeDeError(error) }, { status: 422 });
  }
}
