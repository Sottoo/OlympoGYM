import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { METODOS_PAGO, type MetodoPago, nombreDelMetodo } from "@/domain/entities/Pago";
import { esFechaValida, sumarDias } from "@/domain/shared/fechas";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { compararCon } from "@/presentation/components/Marcador";
import { diaDeLaSemana, fechaLocal, formatearDinero, formatearFechaLarga, formatearHora } from "@/shared/formato";
import { describirPartida } from "@/domain/entities/Venta";
import { PuntoDeVenta } from "./PuntoDeVenta";

export const metadata: Metadata = { title: "Tienda" };
export const dynamic = "force-dynamic";

export default async function PaginaVentas({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const casos = await casosDeUso();
  const [{ productos }, { productos: inactivos }, popularidad, corteHoy, veOtrosDias, gestionaInventario] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.listarProductos.ejecutar({ filtro: "inactivos" }),
    casos.obtenerPopularidad.ejecutar(),
    casos.obtenerCorteDelDia.ejecutar(),
    tienePermiso("dinero.historial"),
    tienePermiso("inventario.gestionar"),
  ]);
  const hoy = corteHoy.fecha;
  // Recepción solo ve el corte de su día; los días anteriores son de la administración.
  const dia = veOtrosDias && fecha && esFechaValida(fecha) && fecha <= hoy ? fecha : hoy;
  const [corte, salidas, veMantenimiento, corteSemanaPasada] = await Promise.all([
    dia === hoy ? corteHoy : casos.obtenerCorteDelDia.ejecutar(dia),
    casos.obtenerSalidasDelDia.ejecutar(dia),
    tienePermiso("mantenimiento.gestionar"),
    // Para comparar: el mismo día de la semana pasada (solo quien ve el dinero de otros días).
    veOtrosDias ? casos.obtenerCorteDelDia.ejecutar(sumarDias(dia, -7)) : null,
  ]);
  const esHoy = dia === hoy;
  const efectivoCobrado = corte.porMetodo.efectivo.tienda + corte.porMetodo.efectivo.membresias;
  const enCaja = Math.round((efectivoCobrado - salidas.efectivo) * 100) / 100;

  const vendibles = productos
    .map(({ producto: p }) => ({
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      categoria: p.categoria,
      foto: p.foto,
      precio: p.precioVenta,
      stock: p.stock,
      unidad: p.unidad,
      porcionGramos: p.porcionGramos,
      porcionNombre: p.porcionNombre,
      frecuente: popularidad.get(p.id)?.frecuente ?? false,
      puntaje: popularidad.get(p.id)?.puntaje ?? 0,
    }))
    // Lo que hay en existencia primero, y dentro, lo que más se vende (sobre todo a esta hora).
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.puntaje - a.puntaje || a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="pagina">
      <Encabezado icono="ventas" titulo="Tienda" descripcion="Cobra productos y revisa el corte de caja del día." />

      {vendibles.length === 0 ? (
        <p className="superficie px-5 py-8 text-center text-gris">
          No hay productos a la venta.{" "}
          {gestionaInventario && inactivos.length > 0 ? (
            <>
              Los que tienes están desactivados:{" "}
              <Link href="/inventario?filtro=inactivos" className="enlace text-tinta">reactívalos en Inventario</Link>.
            </>
          ) : gestionaInventario ? (
            <>
              <Link href="/inventario/nuevo" className="enlace text-tinta">Da de alta el primero</Link>.
            </>
          ) : (
            "Los da de alta la administración en Inventario."
          )}
        </p>
      ) : (
        <PuntoDeVenta
          productos={vendibles}
          puedeDarDeAlta={gestionaInventario}
          desactivados={inactivos.flatMap(({ producto: p }) => (p.codigo ? [{ id: p.id, nombre: p.nombre, codigo: p.codigo }] : []))}
        />
      )}

      <section aria-labelledby="titulo-corte" className="grid gap-4 border-t-[1.5px] border-dashed border-linea pt-7">
        <div className="cabecera-seccion">
          <div>
            <h2 id="titulo-corte" className="subtitulo">Corte del día</h2>
            <p className="first-letter:uppercase">
              {esHoy ? "Hoy, " : ""}
              {diaDeLaSemana(dia)} {formatearFechaLarga(dia)}
            </p>
          </div>
          {veOtrosDias && (
          <nav aria-label="Cambiar de día" className="flex items-center gap-1.5">
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
          )}
        </div>

        <Indicadores
          datos={[
            {
              etiqueta: "Total del día", icono: "ventas" as const,
              valor: formatearDinero(corte.total),
              detalle: `Tienda ${formatearDinero(corte.totalTienda)} · Membresías ${formatearDinero(corte.totalMembresias)}`,
              destacada: true,
              comparacion:
                corteSemanaPasada && corteSemanaPasada.total > 0
                  ? compararCon(corte.total, corteSemanaPasada.total, { porcentaje: true, contra: `vs. el ${diaDeLaSemana(dia)} pasado (${formatearDinero(corteSemanaPasada.total)})` })
                  : undefined,
            },
            ...(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => {
              const { tienda, membresias } = corte.porMetodo[m];
              return {
                etiqueta: METODOS_PAGO[m],
                icono: m === "efectivo" ? ("caja" as const) : ("credencial" as const),
                valor: formatearDinero(tienda + membresias),
                avance: corte.total > 0 ? { valor: tienda + membresias, total: corte.total, tono: "tinta" as const } : undefined,
                detalle: tienda + membresias > 0 ? `Tienda ${formatearDinero(tienda)} · Membresías ${formatearDinero(membresias)}` : "Sin cobros todavía",
              };
            }),
            ...(salidas.pagos.length > 0
              ? [
                  {
                    etiqueta: "Efectivo neto del día", icono: "check" as const,
                    valor: enCaja < 0 ? `−${formatearDinero(-enCaja)}` : formatearDinero(enCaja),
                    alerta: enCaja < 0,
                    detalle: `Entró ${formatearDinero(efectivoCobrado)} · salió ${formatearDinero(salidas.efectivo)} en pagos`,
                  },
                ]
              : []),
          ]}
        />
        <p className="ayuda -mt-1">
          Incluye lo cobrado en la tienda y las membresías y visitas cobradas ese día, para cuadrar la caja.
          {salidas.efectivo > 0 &&
            " Al efectivo se le restan los pagos de mantenimiento que salieron de la caja; si manejas fondo de caja, súmalo para saber cuánto debe haber en el cajón."}
        </p>

        <h3 className="rotulo pt-2">
          Tienda · {corte.ventas.length} {corte.ventas.length === 1 ? "venta" : "ventas"} · {corte.piezas} {corte.piezas === 1 ? "artículo" : "artículos"}
        </h3>
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
                          {describirPartida(p)}
                        </span>
                      ))}
                      {v.nota && <span className="block text-sm text-gris">{v.nota}</span>}
                    </td>
                    <td className="whitespace-nowrap text-tinta-suave">{nombreDelMetodo(v.metodo)}</td>
                    <td className="numero font-semibold">{formatearDinero(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="rotulo pt-2">
          Membresías y visitas · {corte.cobros.length} {corte.cobros.length === 1 ? "cobro" : "cobros"}
        </h3>
        {corte.cobros.length === 0 ? (
          <p className="text-gris">No se cobraron membresías ni visitas este día.</p>
        ) : (
          <div className="superficie overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Socio</th>
                  <th>Plan</th>
                  <th>Pago</th>
                  <th className="numero">Monto</th>
                </tr>
              </thead>
              <tbody>
                {corte.cobros.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap tabular-nums text-tinta-suave">{formatearHora(c.creadoEn, entorno.zonaHoraria)}</td>
                    <td>
                      <Link href={`/socios/${c.socioId}`} className="enlace">{c.socioNombre}</Link>
                      {c.nota && <span className="block text-sm text-gris">{c.nota}</span>}
                    </td>
                    <td className="text-tinta-suave">{c.planNombre ?? "—"}</td>
                    <td className="whitespace-nowrap text-tinta-suave">{nombreDelMetodo(c.metodo)}</td>
                    <td className="numero font-semibold">{formatearDinero(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {salidas.pagos.length > 0 && (
          <>
            <h3 className="rotulo pt-2">
              Salidas · {salidas.pagos.length} {salidas.pagos.length === 1 ? "pago de mantenimiento" : "pagos de mantenimiento"}
            </h3>
            <div className="superficie overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Concepto</th>
                    <th>Pago</th>
                    <th className="numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {salidas.pagos.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap tabular-nums text-tinta-suave">
                        {/* Si se anotó otro día (un pago atrasado), la hora no es la del pago. */}
                        {fechaLocal(p.creadoEn, entorno.zonaHoraria) === dia ? formatearHora(p.creadoEn, entorno.zonaHoraria) : "—"}
                      </td>
                      <td>
                        {veMantenimiento ? (
                          <Link href={`/mantenimiento/registro/${p.mantenimientoId}`} className="enlace">{p.equipoNombre}</Link>
                        ) : (
                          <span>{p.equipoNombre}</span>
                        )}
                        <span className="block text-sm text-gris">
                          {p.descripcion}
                          {p.proveedor && ` · ${p.proveedor}`}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-tinta-suave">{nombreDelMetodo(p.metodo)}</td>
                      <td className="numero font-semibold text-rojo">−{formatearDinero(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
