import { CATEGORIAS_PRODUCTO } from "@/domain/entities/Producto";
import { obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { generarCsv, respuestaCsv } from "@/presentation/csv";

export const dynamic = "force-dynamic";

const ESTADOS = { suficiente: "Suficiente", bajo: "Stock bajo", agotado: "Agotado" } as const;

/** Descarga del inventario completo en un archivo que abre Excel. */
export async function GET() {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") return new Response("No autorizado", { status: 401 });

  const casos = await casosDeUso();
  const [activos, inactivos] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.listarProductos.ejecutar({ filtro: "inactivos" }),
  ]);
  const csv = generarCsv(
    ["Producto", "Categoría", "Código", "Precio de venta", "Costo", "Existencia", "Stock mínimo", "Estado", "Valor a costo"],
    [...activos.productos, ...inactivos.productos].map(({ producto: p, estado }) => [
      p.nombre,
      CATEGORIAS_PRODUCTO[p.categoria],
      p.codigo,
      p.precioVenta,
      p.costo,
      p.stock,
      p.stockMinimo,
      p.activo ? ESTADOS[estado] : "Desactivado",
      p.costo === null ? null : p.costo * p.stock,
    ]),
  );
  return respuestaCsv(`inventario-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
