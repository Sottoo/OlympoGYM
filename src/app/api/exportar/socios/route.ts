import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { generarCsv, respuestaCsv } from "@/presentation/csv";

export const dynamic = "force-dynamic";

const ESTADOS = { vigente: "Al corriente", por_vencer: "Por vencer", vencida: "Vencida", sin_plan: "Sin plan" } as const;

/** Descarga de todos los socios (activos y bajas) en un archivo que abre Excel. */
export async function GET() {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return new Response("No autorizado", { status: 401 });

  const { socios } = await (await casosDeUso()).listarSocios.ejecutar({ filtro: "todos" });
  const csv = generarCsv(
    ["Nombre", "Apellidos", "Celular", "Correo", "Estado", "Plan", "Vence", "Días restantes", "Alta", "Fecha de baja", "Motivo de baja", "Notas"],
    socios.map(({ socio: s, membresia: m, planNombre }) => [
      s.nombre,
      s.apellidos,
      s.telefono,
      s.email,
      s.activo ? ESTADOS[m.estado] : "Baja",
      planNombre,
      m.fechaFin,
      m.diasRestantes,
      s.creadoEn.slice(0, 10),
      s.fechaBaja,
      s.motivoBaja,
      s.notas,
    ]),
  );
  return respuestaCsv(`socios-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
