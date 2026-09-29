import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TIPOS_MOVIMIENTO } from "@/domain/entities/MovimientoInventario";
import { CATEGORIAS_PRODUCTO } from "@/domain/entities/Producto";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { EstadoStockInsignia, Insignia } from "@/presentation/components/Insignia";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { formatearDinero, formatearFecha } from "@/shared/formato";
import { accionCambiarEstadoProducto } from "../acciones";
import { FormularioMovimiento } from "./FormularioMovimiento";

export const metadata: Metadata = { title: "Producto" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  nuevo: "Producto dado de alta.",
  editado: "Cambios guardados.",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}

export default async function PaginaProducto({ params, searchParams }: Props) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const { producto: p, estado, margen, movimientos } = await (await casosDeUso()).obtenerDetalleProducto.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });

  return (
    <div className="space-y-7">
      <Encabezado
        titulo={p.nombre}
        volver={{ href: "/inventario", texto: "Inventario" }}
        etiquetas={p.activo ? <EstadoStockInsignia estado={estado} /> : <Insignia tono="neutro">Desactivado</Insignia>}
        descripcion={
          <>
            {CATEGORIAS_PRODUCTO[p.categoria]}
            {p.codigo && <span className="tabular-nums"> · Código {p.codigo}</span>}
          </>
        }
        acciones={
          <>
            <form action={accionCambiarEstadoProducto}>
              <input type="hidden" name="productoId" value={p.id} />
              <input type="hidden" name="activo" value={String(!p.activo)} />
              <button className="boton-secundario">{p.activo ? "Desactivar" : "Activar"}</button>
            </form>
            <Link href={`/inventario/${p.id}/editar`} className="boton-secundario">
              <Icono nombre="editar" className="size-4" />
              Editar
            </Link>
          </>
        }
      />

      <MensajeExito mensaje={aviso ? AVISOS[aviso] : undefined} />

      <Indicadores
        datos={[
          { etiqueta: "Existencia", valor: p.stock, alerta: estado === "agotado", detalle: `${p.stock === 1 ? "pieza" : "piezas"} en anaquel` },
          { etiqueta: "Stock mínimo", valor: p.stockMinimo, detalle: estado === "suficiente" ? "Por encima del mínimo" : "Conviene resurtir" },
          { etiqueta: "Precio de venta", valor: formatearDinero(p.precioVenta) },
          {
            etiqueta: "Margen",
            valor: margen === null ? "—" : `${Math.round(margen * 100)} %`,
            detalle: p.costo === null ? "Captura el costo para calcularlo" : `Costo ${formatearDinero(p.costo)} por pieza`,
          },
        ]}
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="superficie h-fit">
          <h2 className="subtitulo border-b border-linea px-5 py-3.5">Registrar movimiento</h2>
          <div className="p-5">
            <FormularioMovimiento productoId={p.id} stockActual={p.stock} />
          </div>
        </section>

        <section>
          <h2 className="subtitulo mb-3">Movimientos recientes</h2>
          {movimientos.length === 0 ? (
            <p className="text-gris">Todavía no hay movimientos.</p>
          ) : (
            <div className="superficie overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Movimiento</th>
                    <th className="numero">Piezas</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap tabular-nums text-tinta-suave">{formatearFecha(m.fecha)}</td>
                      <td className="whitespace-nowrap">{TIPOS_MOVIMIENTO[m.tipo]}</td>
                      <td className={`numero font-semibold ${m.cantidad > 0 ? "text-verde" : "text-tinta"}`}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : `−${Math.abs(m.cantidad)}`}
                      </td>
                      <td className="text-sm text-gris">
                        {m.tipo === "venta" && m.precioUnitario !== null ? `${formatearDinero(m.precioUnitario)} c/u` : (m.nota ?? "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
