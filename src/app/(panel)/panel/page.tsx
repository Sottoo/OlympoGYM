import type { Metadata } from "next";
import Link from "next/link";
import type { FilaVencimiento } from "@/application/use-cases/dashboard/ObtenerResumen";
import { estadoDeStock } from "@/domain/entities/Producto";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { BotonWhatsApp } from "@/presentation/components/BotonWhatsApp";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { EstadoStockInsignia } from "@/presentation/components/Insignia";
import { mensajeRecordatorio } from "@/presentation/whatsapp";
import { describirDiasRestantes, diaDeLaSemana, formatearDinero, formatearFecha, formatearFechaLarga } from "@/shared/formato";

export const metadata: Metadata = { title: "Resumen" };
export const dynamic = "force-dynamic";

export default async function PaginaResumen() {
  const casos = await casosDeUso();
  const [r, avisos] = await Promise.all([casos.obtenerResumen.ejecutar(), casos.obtenerAvisosPendientes.ejecutar()]);
  const { membresiasMes, ventasMes, ventasHoy } = r.ingresos;
  const dia = diaDeLaSemana(r.hoy);

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Resumen"
        descripcion={`${dia[0].toUpperCase()}${dia.slice(1)} ${formatearFechaLarga(r.hoy)}`}
        acciones={
          <>
            <Link href="/ventas" className="boton-secundario">
              <Icono nombre="ventas" className="size-4" />
              Registrar venta
            </Link>
            <Link href="/socios/nuevo" className="boton">
              <Icono nombre="mas" className="size-4" />
              Registrar socio
            </Link>
          </>
        }
      />

      {avisos.length > 0 && (
        <Link
          href="/avisos"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rojo/25 bg-rojo-tenue px-5 py-4 hover:border-rojo/45"
        >
          <span className="flex items-center gap-3">
            <Icono nombre="avisos" className="size-5 text-rojo" />
            <span>
              <strong className="font-semibold">
                {avisos.length === 1 ? "Hay 1 aviso" : `Hay ${avisos.length} avisos`} por mandar hoy
              </strong>
              <span className="block text-sm text-gris">Recordatorios de vencimiento por WhatsApp, listos para enviar.</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-sm font-semibold">
            Ver avisos
            <Icono nombre="adelante" className="size-4" />
          </span>
        </Link>
      )}

      <Indicadores
        datos={[
          { etiqueta: "Socios activos", valor: r.totalSocios, detalle: `${r.vigentes} con membresía vigente` },
          {
            etiqueta: "Vencen esta semana",
            valor: r.porVencer.length,
            alerta: r.porVencer.some((f) => f.diasRestantes <= 1),
            detalle: avisos.length > 0 ? `${avisos.length} por avisar hoy` : "Sin avisos pendientes",
          },
          {
            etiqueta: "Ingresos del mes",
            valor: formatearDinero(membresiasMes + ventasMes),
            detalle: `Membresías ${formatearDinero(membresiasMes)} · Tienda ${formatearDinero(ventasMes)}`,
          },
          {
            etiqueta: "Ventas de hoy",
            valor: formatearDinero(ventasHoy),
            detalle: (
              <Link href="/ventas" className="enlace text-tinta">
                Ver corte del día
              </Link>
            ),
          },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="titulo-por-vencer" className="min-w-0">
          <EncabezadoSeccion id="titulo-por-vencer" titulo="Vencen en los próximos 7 días" />
          {r.porVencer.length === 0 ? (
            <p className="superficie px-5 py-8 text-center text-gris">Nadie vence esta semana.</p>
          ) : (
            <ol className="superficie divide-y divide-linea">
              {r.porVencer.map((fila) => (
                <FilaVencimientoProximo key={fila.socioId} fila={fila} />
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="titulo-stock" className="min-w-0">
          <EncabezadoSeccion
            id="titulo-stock"
            titulo="Por resurtir"
            enlace={{ href: "/inventario?filtro=bajo", texto: "Inventario" }}
          />
          {r.stockBajo.length === 0 ? (
            <p className="superficie px-5 py-8 text-center text-gris">Todo el inventario está por encima del mínimo.</p>
          ) : (
            <ul className="superficie divide-y divide-linea">
              {r.stockBajo.slice(0, 7).map((p) => (
                <li key={p.id}>
                  <Link href={`/inventario/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafaf8]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.nombre}</span>
                      <span className="text-sm text-gris">
                        Quedan <strong className="font-semibold text-tinta tabular-nums">{p.stock}</strong> · mínimo {p.stockMinimo}
                      </span>
                    </span>
                    <EstadoStockInsignia estado={estadoDeStock(p)} />
                  </Link>
                </li>
              ))}
              {r.stockBajo.length > 7 && (
                <li className="px-4 py-2.5 text-sm text-gris">y {r.stockBajo.length - 7} productos más</li>
              )}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="titulo-vencidos">
        <EncabezadoSeccion
          id="titulo-vencidos"
          titulo="Vencidos en el último mes"
          descripcion="Socios a los que vale la pena invitar a regresar."
        />
        {r.vencidosRecientes.length === 0 ? (
          <p className="superficie px-5 py-8 text-center text-gris">No hay membresías vencidas recientemente.</p>
        ) : (
          <div className="superficie overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Plan</th>
                  <th>Venció</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {r.vencidosRecientes.map((f) => (
                  <tr key={f.socioId}>
                    <td><Link href={`/socios/${f.socioId}`} className="enlace">{f.nombre}</Link></td>
                    <td className="text-tinta-suave">{f.planNombre}</td>
                    <td className="whitespace-nowrap">
                      {formatearFecha(f.fechaFin)}
                      <span className="ml-2 text-sm text-gris">{describirDiasRestantes(f.diasRestantes).toLowerCase()}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {f.telefono && <BotonWhatsApp compacto telefono={f.telefono} mensaje={recordatorio(f)} />}
                        <Link href={`/socios/${f.socioId}#renovar`} className="boton-secundario boton-chico">Renovar</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-dashed border-linea-fuerte px-5 py-4">
        <div>
          <h2 className="subtitulo">Respaldo de la información</h2>
          <p className="text-sm text-gris">
            La app guarda una copia diaria en la computadora. Aquí puedes descargar una al momento, por ejemplo para una USB.
          </p>
        </div>
        <a href="/api/respaldo" className="boton-secundario">
          <Icono nombre="descargar" className="size-4" />
          Descargar respaldo
        </a>
      </section>
    </div>
  );
}

function EncabezadoSeccion({
  id,
  titulo,
  descripcion,
  enlace,
}: {
  id: string;
  titulo: string;
  descripcion?: string;
  enlace?: { href: string; texto: string };
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="subtitulo">{titulo}</h2>
      {descripcion && <p className="text-sm text-gris">{descripcion}</p>}
      {enlace && (
        <Link href={enlace.href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-gris hover:text-tinta">
          {enlace.texto}
          <Icono nombre="adelante" className="size-4" />
        </Link>
      )}
    </div>
  );
}

function recordatorio(f: FilaVencimiento) {
  return mensajeRecordatorio(f.nombre.split(" ")[0], { diasRestantes: f.diasRestantes, fechaFin: f.fechaFin }, entorno.nombreGimnasio);
}

/** Cuenta regresiva en una columna fija: se lee de un vistazo, de arriba abajo. */
function FilaVencimientoProximo({ fila }: { fila: FilaVencimiento }) {
  const urgente = fila.diasRestantes <= 1;
  const numero = fila.diasRestantes === 0 ? "Hoy" : String(fila.diasRestantes);
  const unidad = fila.diasRestantes === 0 ? "" : fila.diasRestantes === 1 ? "día" : "días";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap">
      <div
        className={`flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5 ${
          urgente ? "border-rojo/30 bg-rojo-tenue text-rojo" : "border-linea bg-hundido text-tinta"
        }`}
      >
        <span className="cifra text-[1.7rem]">{numero}</span>
        {unidad && <span className="text-[0.7rem] font-semibold uppercase tracking-wider">{unidad}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/socios/${fila.socioId}`} className="enlace block truncate text-[1.02rem]">
          {fila.nombre}
        </Link>
        <p className="text-sm text-gris">
          {fila.planNombre} · válido hasta el {formatearFecha(fila.fechaFin)}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        {fila.telefono && <BotonWhatsApp compacto telefono={fila.telefono} mensaje={recordatorio(fila)} />}
        <Link href={`/socios/${fila.socioId}#renovar`} className="boton-secundario boton-chico">Renovar</Link>
      </div>
    </li>
  );
}
