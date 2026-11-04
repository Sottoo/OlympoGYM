import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { RecepcionDeMercancia } from "./RecepcionDeMercancia";

export const metadata: Metadata = { title: "Llegó mercancía" };
export const dynamic = "force-dynamic";

export default async function PaginaEntrada({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  await exigirPermiso("inventario.gestionar");
  const { pedido } = await searchParams;
  const casos = await casosDeUso();
  const [{ productos }, { productos: inactivos }] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.listarProductos.ejecutar({ filtro: "inactivos" }),
  ]);
  const aRecibir = ({ producto: p }: (typeof productos)[number]) => ({
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    categoria: p.categoria,
    stock: p.stock,
    unidad: p.unidad,
    porcionGramos: p.porcionGramos,
    porcionNombre: p.porcionNombre,
    envaseGramos: p.envaseGramos,
    foto: p.foto,
  });

  // Desde la lista de compra: llega prellenado con lo que se pidió (en piezas o botes).
  const inicial: Record<string, number> = {};
  if (pedido) {
    const lista = await casos.obtenerListaDeCompra.ejecutar(Number(pedido));
    // La lista pide en la misma unidad en que aquí se captura (piezas, botes o gramos).
    for (const r of lista.renglones) inicial[r.producto.id] = r.pedir;
  }

  return (
    <div className="pagina">
      <Encabezado
        titulo="Llegó mercancía"
        volver={{ href: "/inventario", texto: "Inventario" }}
        descripcion={
          pedido
            ? "Viene con lo de la lista de compra. Ajusta lo que de verdad llegó y guarda."
            : "Todo lo que trajo el proveedor de una vez: dale + o escanea cada pieza."
        }
      />
      {productos.length === 0 ? (
        <Vacio
          accion={
            <Link href="/inventario/catalogo" className="boton">
              Agregar del catálogo
            </Link>
          }
        >
          Todavía no hay productos. Puedes darlos de alta escaneándolos aquí mismo o elegirlos del catálogo.
        </Vacio>
      ) : null}
      <RecepcionDeMercancia
        inicial={inicial}
        productos={productos.map(aRecibir)}
        desactivados={inactivos.filter(({ producto }) => producto.codigo).map(aRecibir)}
      />
    </div>
  );
}
