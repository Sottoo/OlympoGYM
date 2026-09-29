import type { Metadata } from "next";
import Link from "next/link";
import { FILTROS_PRODUCTOS, type FiltroProductos } from "@/application/use-cases/inventario/GestionarProductos";
import { CATEGORIAS_PRODUCTO } from "@/domain/entities/Producto";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { EstadoStockInsignia, Insignia } from "@/presentation/components/Insignia";
import { Vacio } from "@/presentation/components/Mensajes";
import { Pestanas } from "@/presentation/components/Pestanas";
import { formatearDinero } from "@/shared/formato";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

const PESTANAS: { filtro: FiltroProductos; texto: string }[] = [
  { filtro: "activos", texto: "Todos" },
  { filtro: "bajo", texto: "Stock bajo" },
  { filtro: "agotado", texto: "Agotados" },
  { filtro: "inactivos", texto: "Desactivados" },
];

export default async function PaginaInventario({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const { q = "", filtro: filtroUrl } = await searchParams;
  const filtro: FiltroProductos = (FILTROS_PRODUCTOS as readonly string[]).includes(filtroUrl ?? "") ? (filtroUrl as FiltroProductos) : "activos";
  const { productos, conteos, valorInventario, unidades } = await (await casosDeUso()).listarProductos.ejecutar({ busqueda: q, filtro });

  const hrefFiltro = (f: FiltroProductos, conBusqueda = true) => {
    const p = new URLSearchParams();
    if (f !== "activos") p.set("filtro", f);
    if (q && conBusqueda) p.set("q", q);
    const qs = p.toString();
    return qs ? `/inventario?${qs}` : "/inventario";
  };
  const porResurtir = conteos.bajo + conteos.agotado;

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Inventario"
        descripcion="Suplementos, bebidas y artículos a la venta en mostrador."
        acciones={
          <>
            <a href="/api/exportar/inventario" className="boton-secundario" download>
              <Icono nombre="descargar" className="size-4" />
              Exportar a Excel
            </a>
            <Link href="/inventario/nuevo" className="boton">
              <Icono nombre="mas" className="size-4" />
              Nuevo producto
            </Link>
          </>
        }
      />

      <Indicadores
        datos={[
          { etiqueta: "Productos a la venta", valor: conteos.activos },
          { etiqueta: "Piezas en existencia", valor: unidades.toLocaleString("es-MX") },
          { etiqueta: "Valor del inventario", valor: formatearDinero(valorInventario), detalle: "Calculado a precio de costo" },
          {
            etiqueta: "Por resurtir",
            valor: porResurtir,
            alerta: conteos.agotado > 0,
            detalle: `${conteos.agotado} ${conteos.agotado === 1 ? "agotado" : "agotados"} · ${conteos.bajo} en mínimo`,
          },
        ]}
      />

      <div className="space-y-4">
        <Pestanas
          etiqueta="Filtrar productos"
          opciones={PESTANAS.map((p) => ({ href: hrefFiltro(p.filtro), texto: p.texto, cuenta: conteos[p.filtro], activa: p.filtro === filtro }))}
        />
        <form role="search" className="flex max-w-md gap-2">
          {filtro !== "activos" && <input type="hidden" name="filtro" value={filtro} />}
          <label htmlFor="q" className="sr-only">Buscar producto</label>
          <div className="relative flex-1">
            <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gris" />
            <input id="q" name="q" defaultValue={q} placeholder="Nombre o código" className="campo pl-8" />
          </div>
          <button className="boton-secundario">Buscar</button>
          {q && <Link href={hrefFiltro(filtro, false)} className="boton-secundario">Limpiar</Link>}
        </form>
      </div>

      {productos.length === 0 ? (
        <Vacio accion={!q && filtro === "activos" && <Link href="/inventario/nuevo" className="boton">Dar de alta el primer producto</Link>}>
          {q ? `Ningún producto coincide con “${q}”.` : filtro === "activos" ? "Todavía no hay productos." : "No hay productos en esta lista."}
        </Vacio>
      ) : (
        <div className="superficie overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="numero">Precio</th>
                <th className="numero">Existencia</th>
                <th className="numero">Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(({ producto: p, estado }) => (
                <tr key={p.id} className={p.activo ? "" : "text-gris"}>
                  <td>
                    <Link href={`/inventario/${p.id}`} className="enlace">{p.nombre}</Link>
                    {p.codigo && <span className="block text-sm text-gris tabular-nums">{p.codigo}</span>}
                  </td>
                  <td className="text-tinta-suave">{CATEGORIAS_PRODUCTO[p.categoria]}</td>
                  <td className="numero">{formatearDinero(p.precioVenta)}</td>
                  <td className={`numero cifra text-lg ${estado === "agotado" ? "text-rojo" : estado === "bajo" ? "text-ambar" : ""}`}>{p.stock}</td>
                  <td className="numero text-gris">{p.stockMinimo}</td>
                  <td>{p.activo ? <EstadoStockInsignia estado={estado} /> : <Insignia tono="neutro">Desactivado</Insignia>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
