import { TOQUES_PARA_REGISTRAR } from "@/domain/entities/Huella";
import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";
import { deBase64, leerCuerpo } from "../cuerpo";

export const dynamic = "force-dynamic";

/**
 * Registro de huella: lee un toque y dice si es del mismo dedo que los
 * anteriores. No guarda nada; la huella se guarda al final, con los 4 toques.
 */
export async function POST(peticion: Request) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return Response.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const cuerpo = await leerCuerpo(peticion);
  if (!cuerpo) return Response.json({ error: "La imagen del lector llegó dañada. Pon el dedo otra vez." }, { status: 400 });
  const anteriores = Array.isArray(cuerpo.anteriores) ? cuerpo.anteriores.filter((a): a is string => typeof a === "string" && a.length < 16_000) : [];
  if (anteriores.length >= TOQUES_PARA_REGISTRAR) return Response.json({ error: "Ya están todos los toques." }, { status: 400 });
  try {
    const { plantilla, coincide } = await (await casosDeUso()).leerToque.ejecutar(cuerpo.imagen, anteriores.map(deBase64));
    return Response.json({ plantilla: Buffer.from(plantilla).toString("base64"), coincide });
  } catch (error) {
    return Response.json({ error: mensajeDeError(error) }, { status: 422 });
  }
}
