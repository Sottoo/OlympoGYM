import { estadoDePago, ESTADOS_PAGO, saldoDe, TIPOS_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { hoyEn, sumarDias, sumarMeses } from "@/domain/shared/fechas";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { generarCsv, respuestaCsv } from "@/presentation/csv";

export const dynamic = "force-dynamic";

/** Mantenimientos de un mes (o de los últimos 12 si no se indica) en un archivo que abre Excel. */
export async function GET(request: Request) {
  if (!(await tienePermiso("exportar")) || !(await tienePermiso("mantenimiento.gestionar"))) {
    return new Response("Tu perfil no permite exportar el mantenimiento.", { status: 403 });
  }
  const hoy = hoyEn(entorno.zonaHoraria);
  const mes = new URL(request.url).searchParams.get("mes");
  const desde = mes && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : sumarMeses(hoy, -12);
  const hasta = mes && /^\d{4}-\d{2}$/.test(mes) ? sumarDias(sumarMeses(desde, 1), -1) : hoy;

  const { mantenimientos } = await (await casosDeUso()).listarHistorialDeMantenimiento.ejecutar(desde, hasta);
  const csv = generarCsv(
    ["Fecha", "Equipo", "Tipo", "Qué se hizo", "Técnico o empresa", "Mano de obra", "Refacciones", "Total", "Pagado", "Por pagar", "Estado del pago", "Nota"],
    mantenimientos.map((m) => [
      m.fecha,
      m.equipoNombre,
      TIPOS_MANTENIMIENTO[m.tipo],
      m.descripcion,
      m.proveedor,
      m.manoDeObra,
      m.refacciones,
      m.total,
      m.pagado,
      saldoDe(m),
      ESTADOS_PAGO[estadoDePago(m)],
      m.nota,
    ]),
  );
  return respuestaCsv(`mantenimiento-${mes ?? hoy}.csv`, csv);
}
