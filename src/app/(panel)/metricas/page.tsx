import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import {
  AltasYBajas,
  AsistenciaDiaria,
  BarrasHorizontales,
  formatos,
  IngresosPorMes,
  MapaHorasPico,
  VerDatos,
} from "@/presentation/components/graficas/Graficas";
import { compararCon, Marcador } from "@/presentation/components/Marcador";
import { formatearDinero, plural } from "@/shared/formato";

export const metadata: Metadata = { title: "Métricas" };
export const dynamic = "force-dynamic";

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export default async function PaginaMetricas() {
  await exigirPermiso("metricas.ver");
  const m = await (await casosDeUso()).obtenerMetricas.ejecutar();
  const { asistencia, horasPico, ingresos, socios, productos, equiposMasCostosos } = m;
  const hayGastos = ingresos.some((i) => i.mantenimiento > 0);

  const cambio = asistencia.totalAnterior > 0 ? Math.round(((asistencia.total - asistencia.totalAnterior) / asistencia.totalAnterior) * 100) : null;
  const esteMes = ingresos[ingresos.length - 1];
  const mesPasado = ingresos[ingresos.length - 2];
  const ingresoMes = esteMes.membresias + esteMes.tienda;
  const ingresoPasado = mesPasado ? mesPasado.membresias + mesPasado.tienda : 0;

  const porDiaDeSemana = horasPico.map((fila) => fila.reduce((t, n) => t + n, 0));
  // La franja más concurrida de la semana, para decirla en palabras.
  let pico = { dia: 0, hora: 0, entradas: 0 };
  horasPico.forEach((fila, dia) => fila.forEach((entradas, hora) => entradas > pico.entradas && (pico = { dia, hora, entradas })));

  return (
    <div className="pagina">
      <Encabezado icono="metricas" titulo="Métricas" descripcion="Cómo va el gimnasio: entradas, socios, ingresos y tienda." />

      <Marcador
        cifras={[
          {
            etiqueta: "Entradas en 30 días", icono: "entradas",
            valor: asistencia.total,
            destacada: true,
            comparacion: cambio === null ? undefined : { texto: `${Math.abs(cambio)} %`, sentido: cambio > 0 ? "sube" : cambio < 0 ? "baja" : "igual", contra: "vs. los 30 días anteriores" },
            barras: { valores: asistencia.dias.map((d) => d.entradas), resaltar: asistencia.dias.length - 1, titulo: "Entradas por día, últimos 30 días" },
            detalle: cambio === null ? "Sin datos del periodo anterior" : "vs. los 30 días anteriores",
          },
          {
            etiqueta: "Promedio por día", icono: "reloj",
            valor: asistencia.promedioDiario.toLocaleString("es-MX", { maximumFractionDigits: 1 }),
            barras: {
              valores: porDiaDeSemana,
              resaltar: porDiaDeSemana.indexOf(Math.max(...porDiaDeSemana)),
              titulo: `Entradas por día de la semana (lunes a domingo), últimas 8 semanas; el más fuerte: ${DIAS[porDiaDeSemana.indexOf(Math.max(...porDiaDeSemana))]}`,
            },
            detalle: asistencia.sociosDistintos === 1 ? "1 socio vino" : `${asistencia.sociosDistintos} socios distintos vinieron`,
          },
          {
            etiqueta: "Socios activos", icono: "socios",
            valor: socios.activos,
            barras: { valores: socios.meses.map((m) => m.altas), resaltar: socios.meses.length - 1, titulo: "Altas por mes, últimos 6 meses" },
            detalle: `${plural(socios.meses[socios.meses.length - 1].altas, "alta")} este mes · altas por mes`,
          },
          {
            etiqueta: "Ingresos del mes", icono: "ventas",
            valor: formatearDinero(ingresoMes),
            comparacion: ingresoPasado > 0 ? { ...compararCon(ingresoMes, ingresoPasado, { porcentaje: true }), contra: "vs. el mes pasado" } : undefined,
            barras: { valores: ingresos.map((i) => i.membresias + i.tienda), resaltar: ingresos.length - 1, titulo: "Ingresos por mes, últimos 6 meses" },
            detalle:
              esteMes.mantenimiento > 0
                ? `Queda ${formatearDinero(ingresoMes - esteMes.mantenimiento)} tras ${formatearDinero(esteMes.mantenimiento)} de mantenimiento`
                : ingresoPasado > 0 ? `${formatearDinero(ingresoPasado)} el mes pasado` : ingresoMes > 0 ? "Primer mes con ingresos" : "Sin ingresos registrados",
          },
        ]}
      />

      <section aria-labelledby="t-asistencia" className="superficie grid gap-5 px-6 py-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-asistencia" className="subtitulo">Entradas por día</h2>
          <p className="text-[0.84rem] text-gris">Últimos 30 días</p>
        </div>
        <AsistenciaDiaria dias={asistencia.dias} />
        <VerDatos encabezados={["Día", "Entradas"]} filas={asistencia.dias.map((d) => [formatos.fechaCorta(d.fecha), d.entradas])} />
      </section>

      <section aria-labelledby="t-horas" className="superficie grid gap-5 px-6 py-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-horas" className="subtitulo">Horas pico</h2>
          <p className="text-[0.84rem] text-gris">
            {pico.entradas > 0
              ? `Lo más concurrido: los ${DIAS[pico.dia]} a las ${pico.hora}:00 · últimas 8 semanas`
              : "Últimas 8 semanas"}
          </p>
        </div>
        <MapaHorasPico celdas={horasPico} />
      </section>

      <div className="mitades">
        <section aria-labelledby="t-ingresos" className="superficie grid content-start gap-5 px-6 py-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-ingresos" className="subtitulo">Ingresos por mes</h2>
            <p className="text-[0.84rem] text-gris">Últimos 6 meses</p>
          </div>
          <IngresosPorMes meses={ingresos} />
          <VerDatos
            encabezados={["Mes", "Membresías", "Tienda", "Total"]}
            filas={ingresos.map((i) => [formatos.mesCorto(i.mes), formatearDinero(i.membresias), formatearDinero(i.tienda), formatearDinero(i.membresias + i.tienda)])}
          />
        </section>

        <section aria-labelledby="t-socios" className="superficie grid content-start gap-5 px-6 py-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-socios" className="subtitulo">Altas y bajas de socios</h2>
            <p className="text-[0.84rem] text-gris">Últimos 6 meses</p>
          </div>
          <AltasYBajas meses={socios.meses} />
          <VerDatos
            encabezados={["Mes", "Altas", "Bajas"]}
            filas={socios.meses.map((s) => [formatos.mesCorto(s.mes), s.altas, s.bajas])}
          />
        </section>
      </div>

      {(hayGastos || equiposMasCostosos.length > 0) && (
        <section aria-labelledby="t-gastos" className="superficie grid gap-6 px-6 py-[22px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="t-gastos" className="subtitulo">Ingresos y mantenimiento</h2>
              <p className="text-[0.84rem] text-gris">Lo que entró, lo pagado a técnicos y lo que queda</p>
            </div>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="numero">Ingresos</th>
                  <th className="numero">Mantenimiento</th>
                  <th className="numero">Queda</th>
                </tr>
              </thead>
              <tbody>
                {[...ingresos].reverse().map((i) => {
                  const entra = i.membresias + i.tienda;
                  return (
                    <tr key={i.mes}>
                      <td className="first-letter:uppercase">{formatos.mesCorto(i.mes)}</td>
                      <td className="numero">{formatearDinero(entra)}</td>
                      <td className="numero text-tinta-suave">{i.mantenimiento > 0 ? `−${formatearDinero(i.mantenimiento)}` : "—"}</td>
                      <td className={`numero font-semibold ${entra - i.mantenimiento < 0 ? "text-rojo" : ""}`}>{formatearDinero(entra - i.mantenimiento)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[0.8rem] text-gris">El mantenimiento cuenta en el mes en que se pagó. Lo que se debe aparece cuando se paga.</p>
          </div>
          <div className="grid content-start gap-4 border-t border-linea pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h3 className="subtitulo">Las máquinas que más cuestan</h3>
            {equiposMasCostosos.length === 0 ? (
              <p className="text-gris">Todavía no hay mantenimientos con costo en los últimos 12 meses.</p>
            ) : (
              <BarrasHorizontales filas={equiposMasCostosos.map((e) => ({ nombre: e.nombre, valor: e.costo, detalle: formatearDinero(e.costo) }))} />
            )}
            <p className="text-[0.8rem] text-gris">Últimos 12 meses. Una máquina que cuesta mucho en reparaciones quizá convenga cambiarla.</p>
          </div>
        </section>
      )}

      <section aria-labelledby="t-tienda" className="superficie grid gap-6 px-6 py-[22px] lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid content-start gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-tienda" className="subtitulo">Lo más vendido en la tienda</h2>
            <p className="text-[0.84rem] text-gris">Lo que dejó en 30 días</p>
          </div>
          {productos.masVendidos.length === 0 ? (
            <p className="text-gris">Todavía no hay ventas en los últimos 30 días.</p>
          ) : (
            <BarrasHorizontales
              filas={productos.masVendidos.map((p) => ({
                nombre: p.nombre,
                valor: p.importe,
                detalle: `${p.piezas} ${p.unidad === "piezas" && p.piezas === 1 ? "pieza" : p.unidad} · ${formatearDinero(p.importe)}`,
              }))}
            />
          )}
        </div>
        <div className="grid content-start gap-2 border-t border-linea pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="rotulo">Valor del inventario</p>
          <p className="cifra text-[2.2rem]">{formatearDinero(productos.valorInventario)}</p>
          <p className="text-[0.84rem] text-gris">Existencias a precio de costo</p>
        </div>
      </section>
    </div>
  );
}
