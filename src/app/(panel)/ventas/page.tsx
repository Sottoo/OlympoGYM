import type { Metadata } from "next";
import Link from "next/link";
import { METODOS_PAGO, type MetodoPago } from "@/domain/entities/Pago";
import { esFechaValida, sumarDias } from "@/domain/shared/fechas";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { diaDeLaSemana, formatearDinero, formatearFechaLarga, formatearHora } from "@/shared/formato";
import { PuntoDeVenta } from "./PuntoDeVenta";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

export default async function PaginaVentas({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const casos = await casosDeUso();
  const [{ productos }, corteHoy] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.obtenerCorteDelDia.ejecutar(),
  ]);
  const hoy = corteHoy.fecha;
  const dia = fecha && esFechaValida(fecha) && fecha <= hoy ? fecha : hoy;
  const corte = dia === hoy ? corteHoy : await casos.obtenerCorteDelDia.ejecutar(dia);
  const esHoy = dia === hoy;

  const vendibles = productos
    .map(({ producto: p }) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo, precio: p.precioVenta, stock: p.stock }))
    // Primero lo que hay en existencia; los agotados al final.
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));

  return (
    <div className="space-y-8">
      <Encabezado titulo="Ventas" descripcion="Cobro de suplementos, bebidas y artículos en mostrador." />

      {vendibles.length === 0 ? (
        <p className="superficie px-5 py-8 text-center text-gris">
          No hay productos a la venta. <Link href="/inventario/nuevo" className="enlace text-tinta">Da de alta el primero</Link>.
        </p>
      ) : (
        <PuntoDeVenta productos={vendibles} />
      )}

      <section aria-labelledby="titulo-corte" className="space-y-4 border-t border-linea pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="titulo-corte" className="subtitulo">Corte del día</h2>
            <p className="text-gris">
              {esHoy ? "Hoy, " : ""}
              {diaDeLaSemana(dia)} {formatearFechaLarga(dia)}
            </p>
          </div>
          <nav aria-label="Cambiar de día" className="flex gap-1">
            <Link href={`/ventas?fecha=${sumarDias(dia, -1)}`} className="boton-secundario boton-chico" aria-label="Día anterior">
              <Icono nombre="atras" className="size-4" />
            </Link>
            {!esHoy && (
              <>
                <Link href={`/ventas?fecha=${sumarDias(dia, 1)}`} className="boton-secundario boton-chico" aria-label="Día siguiente">
                  <Icono nombre="adelante" className="size-4" />
                </Link>
                <Link href="/ventas" className="boton-secundario boton-chico">Hoy</Link>
              </>
            )}
          </nav>
        </div>

        <Indicadores
          datos={[
            {
              etiqueta: "Total vendido",
              valor: formatearDinero(corte.total),
              detalle: `${corte.ventas.length} ${corte.ventas.length === 1 ? "venta" : "ventas"} · ${corte.piezas} ${corte.piezas === 1 ? "pieza" : "piezas"}`,
            },
            ...(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => ({ etiqueta: METODOS_PAGO[m], valor: formatearDinero(corte.porMetodo[m] ?? 0) })),
          ]}
        />

        {corte.ventas.length === 0 ? (
          <p className="text-gris">No hubo ventas este día.</p>
        ) : (
          <div className="superficie overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Productos</th>
                  <th>Pago</th>
                  <th className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {corte.ventas.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap tabular-nums text-tinta-suave">{formatearHora(v.creadoEn, entorno.zonaHoraria)}</td>
                    <td>
                      {v.partidas.map((p) => (
                        <span key={p.productoId} className="block text-[0.93rem]">
                          <span className="tabular-nums text-gris">{p.cantidad} ×</span> {p.productoNombre}
                        </span>
                      ))}
                      {v.nota && <span className="block text-sm text-gris">{v.nota}</span>}
                    </td>
                    <td className="whitespace-nowrap text-tinta-suave">{METODOS_PAGO[v.metodo]}</td>
                    <td className="numero font-semibold">{formatearDinero(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
