import type { Metadata } from "next";
import Link from "next/link";
import { TIPOS_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { primerDiaDelMes, sumarDias, sumarMeses } from "@/domain/shared/fechas";
import { exigirPermiso, tienePermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { Vacio } from "@/presentation/components/Mensajes";
import { formatearDinero, formatearFecha } from "@/shared/formato";
import { EstadoPagoInsignia } from "../piezas";
import { SeccionesDeMantenimiento } from "../Secciones";

export const metadata: Metadata = { title: "Historial de mantenimiento" };
export const dynamic = "force-dynamic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreDelMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await exigirPermiso("mantenimiento.gestionar");
  const { mes: mesUrl } = await searchParams;
  const casos = await casosDeUso();
  const [gastos, exporta] = await Promise.all([casos.obtenerResumenDeGastos.ejecutar(), tienePermiso("exportar")]);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date());
  const esteMes = primerDiaDelMes(hoy);
  const mes = mesUrl && /^\d{4}-\d{2}$/.test(mesUrl) && `${mesUrl}-01` <= esteMes ? `${mesUrl}-01` : esteMes;
  const fin = sumarDias(sumarMeses(mes, 1), -1);
  const h = await casos.listarHistorialDeMantenimiento.ejecutar(mes, fin);

  return (
    <div className="pagina">
      <Encabezado icono="llave"
        titulo="Mantenimiento"
        descripcion="Todo lo que se les ha hecho a las máquinas, mes por mes, y lo que ha costado."
        acciones={
          exporta && (
            <a href={`/api/exportar/mantenimiento?mes=${mes.slice(0, 7)}`} className="boton-secundario" download>
              <Icono nombre="descargar" className="size-4" />
              Exportar a Excel
            </a>
          )
        }
      />
      <SeccionesDeMantenimiento activa="historial" porPagar={gastos.pendientes} />

      <div className="cabecera-seccion">
        <div>
          <h2 className="subtitulo first-letter:uppercase">{nombreDelMes(mes)}</h2>
          <p>{mes === esteMes ? "Este mes, hasta hoy" : "Mes completo"}</p>
        </div>
        <nav aria-label="Cambiar de mes" className="flex items-center gap-1.5">
          <Link href={`/mantenimiento/historial?mes=${sumarMeses(mes, -1).slice(0, 7)}`} className="boton-secundario boton-chico" aria-label="Mes anterior">
            <Icono nombre="atras" className="size-4" />
          </Link>
          {mes !== esteMes && (
            <>
              <Link href={`/mantenimiento/historial?mes=${sumarMeses(mes, 1).slice(0, 7)}`} className="boton-secundario boton-chico" aria-label="Mes siguiente">
                <Icono nombre="adelante" className="size-4" />
              </Link>
              <Link href="/mantenimiento/historial" className="boton-secundario boton-chico">Este mes</Link>
            </>
          )}
        </nav>
      </div>

      <Indicadores
        datos={[
          { etiqueta: "Pagado en el mes", icono: "ventas", valor: formatearDinero(h.pagado), destacada: true, detalle: "Lo que salió de dinero (incluye abonos de trabajos anteriores)" },
          { etiqueta: "Costo de los trabajos", icono: "llave", valor: formatearDinero(h.costo), detalle: "De lo que se hizo este mes, pagado o no" },
          { etiqueta: "Preventivos", icono: "reloj", valor: h.preventivos, detalle: "Servicios programados del mes" },
          { etiqueta: "Reparaciones", icono: "alerta", valor: h.reparaciones, detalle: "Arreglos por falla del mes" },
        ]}
      />

      {h.mantenimientos.length === 0 ? (
        <Vacio>No hay mantenimientos registrados en {nombreDelMes(mes)}.</Vacio>
      ) : (
        <div className="superficie overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Qué se hizo</th>
                <th className="numero">Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {h.mantenimientos.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap tabular-nums">
                    <Link href={`/mantenimiento/registro/${m.id}`} className="enlace">{formatearFecha(m.fecha)}</Link>
                  </td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Emblema {...dibujoDeEquipo({ nombre: m.equipoNombre, area: "otro" })} tamano="xs" />
                      <Link href={`/mantenimiento/equipos/${m.equipoId}`} className="enlace">{m.equipoNombre}</Link>
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-tinta-suave">{TIPOS_MANTENIMIENTO[m.tipo]}</td>
                  <td>
                    <span className="block text-[0.93rem]">{m.descripcion}</span>
                    {m.proveedor && <span className="block text-sm text-gris">{m.proveedor}</span>}
                  </td>
                  <td className="numero font-semibold">{m.total > 0 ? formatearDinero(m.total) : <span className="font-normal text-gris">—</span>}</td>
                  <td>
                    <EstadoPagoInsignia m={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
