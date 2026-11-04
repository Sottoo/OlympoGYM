import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TIPOS_MOVIMIENTO } from "@/domain/entities/MovimientoInventario";
import { CATEGORIAS_PRODUCTO, cantidadCorta, esGranel, existenciaGranel } from "@/domain/entities/Producto";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Panel, PanelTabla } from "@/presentation/components/Panel";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { EstadoStockInsignia, Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { formatearDinero, formatearFecha } from "@/shared/formato";
import { AccionesDelProducto } from "./AccionesDelProducto";
import { FormularioMovimiento } from "./FormularioMovimiento";

export const metadata: Metadata = { title: "Producto" };
export const dynamic = "force-dynamic";

/** Cada movimiento con su señal: lo que entra en verde, lo que sale por venta en tinta, la merma en rojo. */
const SENAL_MOVIMIENTO = {
  entrada: { icono: "descargar", clase: "bg-verde-tenue text-verde" },
  venta: { icono: "ventas", clase: "bg-hundido text-tinta" },
  merma: { icono: "alerta", clase: "bg-rojo-tenue text-rojo" },
  ajuste: { icono: "check", clase: "bg-ambar-tenue text-ambar" },
} as const;

const AVISOS: Record<string, string> = {
  nuevo: "Producto dado de alta.",
  "nuevo-sin-foto": "Producto dado de alta, pero la foto no se pudo guardar. Agrégala desde Editar.",
  editado: "Cambios guardados.",
  desactivado: "Producto desactivado: ya no aparece en la Tienda. Su historial se conserva.",
  reactivado: "Producto reactivado: ya aparece otra vez en la Tienda.",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}

export default async function PaginaProducto({ params, searchParams }: Props) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const gestiona = await tienePermiso("inventario.gestionar");
  const { producto: p, estado, margen, movimientos, tieneVentas } = await (await casosDeUso()).obtenerDetalleProducto.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });

  const granel = esGranel(p);

  return (
    <div className="pagina">
      <Encabezado
        titulo={p.nombre}
        imagen={<Emblema {...dibujoDeProducto(p)} tamano="xl" apagado={!p.activo} />}
        volver={{ href: "/inventario", texto: "Inventario" }}
        etiquetas={p.activo ? <EstadoStockInsignia estado={estado} /> : <Insignia tono="neutro">Desactivado</Insignia>}
        descripcion={
          <>
            {CATEGORIAS_PRODUCTO[p.categoria]}
            {p.codigo && <span className="tabular-nums"> · Código {p.codigo}</span>}
          </>
        }
        acciones={
          gestiona && (
          <>
            <AccionesDelProducto productoId={p.id} nombre={p.nombre} activo={p.activo} tieneVentas={tieneVentas} movimientos={movimientos.length} />
            <Link href={`/inventario/${p.id}/editar`} className="boton-secundario">
              <Icono nombre="editar" className="size-4" />
              Editar
            </Link>
          </>
          )
        }
      />

      <MensajeExito mensaje={aviso ? AVISOS[aviso] : undefined} />
      {!p.activo && (
        <p role="status" className="flex items-start gap-2.5 rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.92rem]">
          <Icono nombre="alerta" className="mt-0.5 size-[18px] shrink-0 text-ambar" />
          <span>
            <strong className="font-semibold">Este producto está desactivado.</strong> No aparece en la Tienda, la lista de compra ni los conteos.
            {gestiona ? " Para volver a venderlo, pulsa «Reactivar» arriba." : " Si se debe volver a vender, pídele a la administración que lo reactive."}
          </span>
        </p>
      )}

      <Indicadores
        datos={[
          granel
            ? { etiqueta: "Existencia", icono: "caja" as const, valor: existenciaGranel(p, p.stock).principal, alerta: estado === "agotado", detalle: existenciaGranel(p, p.stock).detalle }
            : { etiqueta: "Existencia", icono: "caja" as const, valor: p.stock, alerta: estado === "agotado", detalle: `${p.stock === 1 ? "pieza" : "piezas"} en anaquel` },
          {
            etiqueta: "Stock mínimo", icono: "alerta" as const,
            valor: granel ? existenciaGranel(p, p.stockMinimo).principal : p.stockMinimo,
            detalle: estado === "suficiente" ? "Por encima del mínimo" : "Conviene resurtir",
          },
          {
            etiqueta: granel ? `Precio por ${p.porcionNombre ?? "porción"}` : "Precio de venta", icono: "ventas" as const,
            valor: formatearDinero(p.precioVenta),
            detalle: granel ? `${p.porcionGramos} g por ${p.porcionNombre ?? "porción"}` : "Lo que paga el cliente por pieza",
          },
          ...(gestiona ? [{
            etiqueta: "Margen", icono: "metricas" as const,
            valor: margen === null ? "—" : `${Math.round(margen * 100)} %`,
            detalle: p.costo === null ? "Captura el costo para calcularlo" : `Costo ${formatearDinero(p.costo)} por ${granel ? "bote" : "pieza"}`,
          }] : []),
        ]}
      />

      {/* Igual que en Planes y Personal: el historial al centro, el formulario a la derecha. */}
      <div className="con-lateral">
        <PanelTabla titulo="Movimientos recientes" descripcion="Entradas, ventas, mermas y ajustes.">
          {movimientos.length === 0 ? (
            <div className="px-2 pb-2">
              <Vacio>
                {p.stock === 0 && gestiona && p.activo
                  ? "Todavía no hay movimientos. Si ya tienes este producto en el anaquel, regístralo como «Entrada» en el formulario de la derecha."
                  : "Todavía no hay movimientos."}
              </Vacio>
            </div>
          ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Movimiento</th>
                    <th className="numero">{granel ? "Cantidad" : "Piezas"}</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap tabular-nums text-tinta-suave">{formatearFecha(m.fecha)}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className={`grid size-6 place-items-center rounded-full ${SENAL_MOVIMIENTO[m.tipo].clase}`}>
                            <Icono nombre={SENAL_MOVIMIENTO[m.tipo].icono} className="size-[14px]" />
                          </span>
                          {TIPOS_MOVIMIENTO[m.tipo]}
                        </span>
                      </td>
                      <td className={`numero font-semibold ${m.cantidad > 0 ? "text-verde" : "text-tinta"}`}>
                        {m.cantidad > 0 ? "+" : "−"}
                        {cantidadCorta(p, m.cantidad)}
                        {granel && !cantidadCorta(p, m.cantidad).endsWith(" g") && (
                          <span className="block text-[0.76rem] font-normal text-gris">{Math.abs(m.cantidad).toLocaleString("es-MX")} g</span>
                        )}
                      </td>
                      <td className="text-sm text-gris">
                        {m.tipo === "venta" && m.precioUnitario !== null
                          ? granel && p.porcionGramos
                            ? `${formatearDinero(m.precioUnitario * p.porcionGramos)} por ${p.porcionNombre ?? "porción"}`
                            : `${formatearDinero(m.precioUnitario)} c/u`
                          : (m.nota ?? "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )}
        </PanelTabla>
        {gestiona ? (
          <Panel titulo="Registrar movimiento" descripcion="Entradas del proveedor, mermas o ajustes por conteo.">
            <FormularioMovimiento
              productoId={p.id}
              stockActual={p.stock}
              granel={granel ? { envaseGramos: p.envaseGramos, porcionGramos: p.porcionGramos ?? 1, porcionNombre: p.porcionNombre ?? "porción" } : undefined}
            />
          </Panel>
        ) : (
          <Panel titulo="Movimientos de mercancía">
            <p className="text-[0.9rem] text-gris">Las entradas de mercancía y los ajustes de existencia los registra la administración.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
