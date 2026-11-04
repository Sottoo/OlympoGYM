import type { Metadata } from "next";
import Link from "next/link";
import { COBERTURAS, type RenglonDeCompra, type Urgencia } from "@/application/use-cases/inventario/Abasto";
import { pluralizar } from "@/domain/shared/texto";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Marcador } from "@/presentation/components/Marcador";
import { Vacio } from "@/presentation/components/Mensajes";
import { PanelTabla } from "@/presentation/components/Panel";
import { Pestanas } from "@/presentation/components/Pestanas";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { formatearDinero, formatearFechaLarga } from "@/shared/formato";
import { CompartirPedido } from "./CompartirPedido";

export const metadata: Metadata = { title: "Lista de compra" };
export const dynamic = "force-dynamic";

const URGENCIAS: Record<Urgencia, { texto: string; clase: string }> = {
  agotado: { texto: "Agotado", clase: "text-rojo" },
  urgente: { texto: "Se acaba en días", clase: "text-rojo" },
  pronto: { texto: "Alcanza poco", clase: "text-ambar" },
  al_minimo: { texto: "En su mínimo", clase: "text-ambar" },
};

const ETIQUETA_COBERTURA: Record<number, string> = { 7: "1 semana", 14: "2 semanas", 30: "1 mes" };

function cantidad(r: RenglonDeCompra) {
  if (r.pedirEn === "botes") return `${r.pedir} ${r.pedir === 1 ? "bote" : "botes"}`;
  if (r.pedirEn === "gramos") return `${r.pedir.toLocaleString("es-MX")} g`;
  return `${r.pedir} ${r.pedir === 1 ? "pieza" : "piezas"}`;
}

function ritmo(r: RenglonDeCompra) {
  if (r.promedioDiario === 0) return "Sin ventas recientes";
  const p = r.producto;
  if (p.unidad === "gramo" && p.porcionGramos) {
    const porciones = (r.promedioDiario * 7) / p.porcionGramos;
    const nombre = p.porcionNombre ?? "porción";
    const n = Math.round(porciones);
    return `≈ ${n} ${pluralizar(nombre, n)} por semana`;
  }
  const semana = r.promedioDiario * 7;
  return semana >= 1 ? `≈ ${Math.round(semana)} por semana` : "Menos de 1 por semana";
}

function alcanza(r: RenglonDeCompra) {
  if (r.producto.stock <= 0) return "Ya no hay";
  if (r.diasQueAlcanza === null) return "—";
  const d = Math.floor(r.diasQueAlcanza);
  return d < 1 ? "Menos de un día" : `${d} ${d === 1 ? "día" : "días"}`;
}

export default async function PaginaPedido({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await exigirPermiso("inventario.gestionar");
  const { dias } = await searchParams;
  const casos = await casosDeUso();
  const lista = await casos.obtenerListaDeCompra.ejecutar(Number(dias) || 14);
  const hoy = formatearFechaLarga(new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date()));

  const texto = [
    `*Pedido · ${entorno.nombreGimnasio}*`,
    `${hoy[0].toUpperCase()}${hoy.slice(1)}`,
    "",
    ...lista.renglones.map((r) => `• ${r.producto.nombre}: ${cantidad(r)}`),
    "",
    "Gracias.",
  ].join("\n");

  return (
    <div className="pagina">
      <Encabezado
        titulo="Lista de compra"
        volver={{ href: "/inventario", texto: "Inventario" }}
        descripcion="Lo que conviene pedir según lo que se ha vendido en las últimas 4 semanas, más el mínimo de cada producto."
        acciones={lista.renglones.length > 0 && <CompartirPedido texto={texto} />}
      />

      <Marcador
        cifras={[
          { etiqueta: "Productos por pedir", icono: "planes", valor: lista.renglones.length, destacada: true, detalle: "Según lo vendido en 4 semanas" },
          {
            etiqueta: "Costo estimado", icono: "ventas",
            valor: formatearDinero(lista.costoEstimado),
            detalle: lista.costoIncompleto ? "Parcial: a algunos productos les falta el costo" : "Con el último costo capturado",
          },
          { etiqueta: "Bien surtidos", icono: "check", valor: lista.bienSurtidos, detalle: `Alcanzan para ${ETIQUETA_COBERTURA[lista.coberturaDias]}` },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Pestanas
          etiqueta="Para cuánto tiempo"
          opciones={COBERTURAS.map((d) => ({ href: `/inventario/pedido?dias=${d}`, texto: `Para ${ETIQUETA_COBERTURA[d]}`, activa: d === lista.coberturaDias }))}
        />
        {lista.renglones.length > 0 && (
          <Link href={`/inventario/entrada?pedido=${lista.coberturaDias}`} className="boton-secundario">
            Ya llegó: registrar con esta lista
          </Link>
        )}
      </div>

      {lista.renglones.length === 0 ? (
        <Vacio>Todo está bien surtido para {ETIQUETA_COBERTURA[lista.coberturaDias]}. No hace falta pedir nada por ahora.</Vacio>
      ) : (
        <PanelTabla titulo="Qué pedir" descripcion="Ordenado por lo más urgente.">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Situación</th>
                <th className="numero">Alcanza para</th>
                <th>Se vende</th>
                <th className="numero">Pedir</th>
                <th className="numero">Costo est.</th>
              </tr>
            </thead>
            <tbody>
              {lista.renglones.map((r) => (
                <tr key={r.producto.id}>
                  <td>
                    <span className="flex items-center gap-3">
                      <Emblema {...dibujoDeProducto(r.producto)} tamano="sm" />
                      <Link href={`/inventario/${r.producto.id}`} className="enlace font-medium">
                        {r.producto.nombre}
                      </Link>
                    </span>
                  </td>
                  <td className={`whitespace-nowrap text-[0.86rem] font-semibold ${URGENCIAS[r.urgencia].clase}`}>{URGENCIAS[r.urgencia].texto}</td>
                  <td className="numero text-tinta-suave">{alcanza(r)}</td>
                  <td className="text-[0.86rem] text-gris">{ritmo(r)}</td>
                  <td className="numero cifra text-lg">{cantidad(r)}</td>
                  <td className="numero text-gris">{r.costoEstimado === null ? "—" : formatearDinero(r.costoEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      )}
    </div>
  );
}
