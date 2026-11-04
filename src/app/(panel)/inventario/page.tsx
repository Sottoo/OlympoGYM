import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { FILTROS_PRODUCTOS, type FiltroProductos } from "@/application/use-cases/inventario/GestionarProductos";
import { CATEGORIAS_PRODUCTO, esGranel, existenciaGranel } from "@/domain/entities/Producto";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono, type NombreIcono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { EstadoStockInsignia, Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Pestanas } from "@/presentation/components/Pestanas";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { formatearDinero } from "@/shared/formato";
import { accionCambiarEstadoProducto } from "./acciones";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

const ATAJOS: { href: string; titulo: string; texto: string; icono: NombreIcono }[] = [
  { href: "/inventario/entrada", titulo: "Llegó mercancía", texto: "Registra todo lo del proveedor de una vez.", icono: "caja" },
  { href: "/inventario/pedido", titulo: "Lista de compra", texto: "Qué pedir y cuánto, según lo vendido.", icono: "planes" },
  { href: "/inventario/conteo", titulo: "Conteo rápido", texto: "Cuenta el anaquel y ajusta todo junto.", icono: "check" },
  { href: "/inventario/catalogo", titulo: "Agregar del catálogo", texto: "Alta de productos típicos sin escribir.", icono: "mas" },
];

const PESTANAS: { filtro: FiltroProductos; texto: string }[] = [
  { filtro: "activos", texto: "Todos" },
  { filtro: "bajo", texto: "Stock bajo" },
  { filtro: "agotado", texto: "Agotados" },
  { filtro: "inactivos", texto: "Desactivados" },
];

export default async function PaginaInventario({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; eliminado?: string; reactivado?: string }> }) {
  const { q = "", filtro: filtroUrl, eliminado, reactivado } = await searchParams;
  const filtro: FiltroProductos = (FILTROS_PRODUCTOS as readonly string[]).includes(filtroUrl ?? "") ? (filtroUrl as FiltroProductos) : "activos";
  const [{ productos, conteos, valorInventario, unidades, piezasPorCategoria, sinCosto }, gestiona, exporta] = await Promise.all([
    (await casosDeUso()).listarProductos.ejecutar({ busqueda: q, filtro }),
    tienePermiso("inventario.gestionar"),
    tienePermiso("exportar"),
  ]);

  const hrefFiltro = (f: FiltroProductos, conBusqueda = true) => {
    const p = new URLSearchParams();
    if (f !== "activos") p.set("filtro", f);
    if (q && conBusqueda) p.set("q", q);
    const qs = p.toString();
    return qs ? `/inventario?${qs}` : "/inventario";
  };
  const porResurtir = conteos.bajo + conteos.agotado;

  return (
    <div className="pagina">
      <Encabezado icono="inventario"
        titulo="Inventario"
        descripcion="Lo que se vende en la tienda: existencias, precios y lo que hay que resurtir."
        acciones={
          <>
            {exporta && (
              <a href="/api/exportar/inventario" className="boton-secundario" download>
                <Icono nombre="descargar" className="size-4" />
                Exportar a Excel
              </a>
            )}
            {gestiona && (
              <Link href="/inventario/nuevo" className="boton">
                <Icono nombre="mas" className="size-4" />
                Nuevo producto
              </Link>
            )}
          </>
        }
      />

      <MensajeExito
        mensaje={eliminado ? `«${eliminado}» se eliminó.` : reactivado ? `«${reactivado}» se reactivó: ya aparece otra vez en la Tienda.` : undefined}
      />

      <Indicadores
        datos={[
          {
            etiqueta: "Productos a la venta", icono: "inventario", valor: conteos.activos,
            avance: { valor: conteos.activos - porResurtir, total: conteos.activos, tono: "verde" },
            detalle: `${conteos.activos - porResurtir} bien surtidos${conteos.inactivos > 0 ? ` · ${conteos.inactivos} ${conteos.inactivos === 1 ? "desactivado" : "desactivados"}` : ""}`,
          },
          {
            etiqueta: "Piezas en existencia", icono: "caja", valor: unidades.toLocaleString("es-MX"),
            barras: piezasPorCategoria.length > 1
              ? { valores: piezasPorCategoria.map((c) => c.piezas), resaltar: 0, titulo: piezasPorCategoria.map((c) => `${CATEGORIAS_PRODUCTO[c.categoria]}: ${c.piezas}`).join(" · ") }
              : undefined,
            detalle: piezasPorCategoria.length > 0 ? `Más en ${CATEGORIAS_PRODUCTO[piezasPorCategoria[0].categoria].toLowerCase()} · sin contar granel` : "Sin contar lo que se vende a granel",
          },
          {
            etiqueta: "Valor del inventario", icono: "ventas", valor: formatearDinero(valorInventario),
            avance: { valor: conteos.activos - sinCosto, total: conteos.activos, tono: sinCosto > 0 ? "ambar" : "tinta" },
            detalle: sinCosto > 0 ? `A precio de costo · a ${sinCosto} les falta el costo` : "A precio de costo, de todos los productos",
          },
          {
            etiqueta: "Por resurtir", icono: "alerta",
            valor: porResurtir,
            alerta: conteos.agotado > 0,
            avance: { valor: porResurtir, total: conteos.activos, tono: conteos.agotado > 0 ? "rojo" : "ambar" },
            detalle: `${conteos.agotado} ${conteos.agotado === 1 ? "agotado" : "agotados"} · ${conteos.bajo} en mínimo`,
          },
        ]}
      />

      {gestiona && (
        <nav aria-label="Atajos de inventario" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ATAJOS.map((a) => (
            <Link key={a.href} href={a.href} className="atajo group">
              <Emblema icono={a.icono} hilo="negro" tamano="md" />
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">{a.titulo}</span>
                <span className="mt-0.5 block text-[0.8rem] leading-snug text-gris">
                  {a.href === "/inventario/pedido" && porResurtir > 0 ? `${porResurtir} por resurtir. ${a.texto}` : a.texto}
                </span>
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* Una sola barra: filtros a la izquierda, búsqueda a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Pestanas
          etiqueta="Filtrar productos"
          opciones={PESTANAS.map((p) => ({ href: hrefFiltro(p.filtro), texto: p.texto, cuenta: conteos[p.filtro], activa: p.filtro === filtro }))}
        />
        <form role="search" className="flex w-full gap-2 sm:w-[19rem]">
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
        <Vacio
          accion={
            gestiona &&
            !q &&
            filtro === "activos" &&
            (conteos.inactivos > 0 ? (
              <Link href="/inventario?filtro=inactivos" className="boton">Ver desactivados</Link>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/inventario/catalogo" className="boton">Agregar del catálogo</Link>
                <Link href="/inventario/nuevo" className="boton-secundario">Uno por uno</Link>
              </div>
            ))
          }
        >
          {q
            ? `Ningún producto coincide con “${q}”.`
            : filtro === "activos"
              ? conteos.inactivos > 0
                ? `No hay productos a la venta: ${conteos.inactivos === 1 ? "el que tienes está desactivado" : `los ${conteos.inactivos} que tienes están desactivados`}. Reactívalos para volver a venderlos.`
                : "Todavía no hay productos."
              : filtro === "inactivos"
                ? "No hay productos desactivados."
                : "No hay productos en esta lista."}
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
                    <div className="flex items-center gap-3">
                      <Emblema {...dibujoDeProducto(p)} tamano="sm" apagado={!p.activo} />
                      <span className="min-w-0">
                        <Link href={`/inventario/${p.id}`} className="enlace">{p.nombre}</Link>
                        {p.codigo && <span className="block text-sm text-gris tabular-nums">{p.codigo}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="text-tinta-suave">{CATEGORIAS_PRODUCTO[p.categoria]}</td>
                  <td className="numero">
                    {formatearDinero(p.precioVenta)}
                    {esGranel(p) && <span className="block text-[0.78rem] text-gris">por {p.porcionNombre ?? "porción"}</span>}
                  </td>
                  <td className={`numero ${estado === "agotado" ? "text-rojo" : estado === "bajo" ? "text-ambar" : ""}`}>
                    {esGranel(p) ? (
                      <>
                        <span className="cifra text-lg">{existenciaGranel(p, p.stock).principal}</span>
                        <span className="block text-[0.78rem] text-gris">{existenciaGranel(p, p.stock).detalle}</span>
                      </>
                    ) : (
                      <span className="cifra text-lg">{p.stock}</span>
                    )}
                  </td>
                  <td className="numero text-gris">{esGranel(p) ? existenciaGranel(p, p.stockMinimo).principal : p.stockMinimo}</td>
                  <td>
                    {p.activo ? (
                      <EstadoStockInsignia estado={estado} />
                    ) : gestiona ? (
                      <form action={accionCambiarEstadoProducto} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="productoId" value={p.id} />
                        <input type="hidden" name="activo" value="true" />
                        <input type="hidden" name="volver" value="lista" />
                        <input type="hidden" name="nombre" value={p.nombre} />
                        <Insignia tono="neutro">Desactivado</Insignia>
                        <button className="boton-secundario boton-chico">Reactivar</button>
                      </form>
                    ) : (
                      <Insignia tono="neutro">Desactivado</Insignia>
                    )}
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
