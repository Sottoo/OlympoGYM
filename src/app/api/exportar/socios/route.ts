import { hoyEn } from "@/domain/shared/fechas";
import { entorno } from "@/infrastructure/config/entorno";
import { fechaLocal } from "@/shared/formato";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { generarCsv, respuestaCsv } from "@/presentation/csv";

export const dynamic = "force-dynamic";

const ESTADOS = { vigente: "Al corriente", por_vencer: "Por vencer", vencida: "Vencida", sin_plan: "Sin plan" } as const;

/** Descarga de todos los socios (activos y bajas) en un archivo que abre Excel. */
export async function GET() {
  if (!(await tienePermiso("exportar"))) return new Response("Tu perfil no permite exportar a Excel.", { status: 403 });

  const { socios } = await (await casosDeUso()).listarSocios.ejecutar({ filtro: "todos" });
  const csv = generarCsv(
    ["Nombre", "Apellidos", "Celular", "Fecha de nacimiento", "Estado", "Plan", "Vence (día de pago)", "Días para pagar", "Alta", "Fecha de baja", "Motivo de baja", "Notas"],
    socios.map(({ socio: s, membresia: m, planNombre }) => [
      s.nombre,
      s.apellidos,
      s.telefono,
      s.fechaNacimiento,
      s.activo ? ESTADOS[m.estado] : "Baja",
      planNombre,
      m.fechaDePago,
      m.diasParaPagar,
      fechaLocal(s.creadoEn, entorno.zonaHoraria),
      s.fechaBaja,
      s.motivoBaja,
      s.notas,
    ]),
  );
  return respuestaCsv(`socios-${hoyEn(entorno.zonaHoraria)}.csv`, csv);
}
