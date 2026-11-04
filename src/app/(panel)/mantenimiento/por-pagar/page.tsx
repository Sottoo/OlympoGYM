import type { Metadata } from "next";
import Link from "next/link";
import { saldoDe, TIPOS_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { Vacio } from "@/presentation/components/Mensajes";
import { PanelTabla } from "@/presentation/components/Panel";
import { formatearDinero, formatearFecha } from "@/shared/formato";
import { SeccionesDeMantenimiento } from "../Secciones";

export const metadata: Metadata = { title: "Por pagar" };
export const dynamic = "force-dynamic";

export default async function PaginaPorPagar() {
  await exigirPermiso("mantenimiento.gestionar");
  const { total, deudas } = await (await casosDeUso()).obtenerPorPagar.ejecutar();
  const trabajos = deudas.reduce((n, d) => n + d.mantenimientos.length, 0);

  return (
    <div className="pagina">
      <Encabezado icono="llave" titulo="Mantenimiento" descripcion="Lo que se les debe a técnicos y empresas, de lo más antiguo a lo más reciente." />
      <SeccionesDeMantenimiento activa="por-pagar" porPagar={trabajos} />

      <Indicadores
        datos={[
          { etiqueta: "Total por pagar", icono: "ventas", valor: formatearDinero(total), destacada: true, alerta: total > 0, detalle: total > 0 ? "Lo que falta pagar a técnicos" : "No se debe nada" },
          { etiqueta: "Trabajos pendientes", icono: "llave", valor: trabajos, detalle: "Con saldo por liquidar" },
          { etiqueta: "A quién se le debe", icono: "usuario", valor: deudas.length, detalle: deudas.length === 1 ? "Un técnico o empresa" : "Técnicos o empresas" },
        ]}
      />

      {deudas.length === 0 ? (
        <Vacio>No se le debe nada a nadie. Todo el mantenimiento está pagado.</Vacio>
      ) : (
        deudas.map((d) => (
          <PanelTabla key={d.proveedor} titulo={d.proveedor} descripcion={`Se le deben ${formatearDinero(d.total)}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Trabajo</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pagado</th>
                  <th className="numero">Debe</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {d.mantenimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap tabular-nums text-tinta-suave">{formatearFecha(m.fecha)}</td>
                    <td>
                      <span className="flex items-center gap-2.5">
                      <Emblema {...dibujoDeEquipo({ nombre: m.equipoNombre, area: "otro" })} tamano="xs" />
                      <Link href={`/mantenimiento/equipos/${m.equipoId}`} className="enlace">{m.equipoNombre}</Link>
                    </span>
                    </td>
                    <td>
                      <span className="block text-[0.93rem]">{m.descripcion}</span>
                      <span className="block text-sm text-gris">{TIPOS_MANTENIMIENTO[m.tipo]}</span>
                    </td>
                    <td className="numero">{formatearDinero(m.total)}</td>
                    <td className="numero text-tinta-suave">{formatearDinero(m.pagado)}</td>
                    <td className="numero font-semibold text-rojo">{formatearDinero(saldoDe(m))}</td>
                    <td className="text-right">
                      <Link href={`/mantenimiento/registro/${m.id}`} className="boton-oscuro boton-chico">Pagar</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelTabla>
        ))
      )}
    </div>
  );
}
