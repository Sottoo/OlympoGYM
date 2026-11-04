import { hoyEn } from "@/domain/shared/fechas";
import { entorno } from "@/infrastructure/config/entorno";
import { CATEGORIAS_PRODUCTO, costoPorUnidad, esGranel } from "@/domain/entities/Producto";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { generarCsv, respuestaCsv } from "@/presentation/csv";

export const dynamic = "force-dynamic";

const ESTADOS = { suficiente: "Suficiente", bajo: "Stock bajo", agotado: "Agotado" } as const;

/** Descarga del inventario completo en un archivo que abre Excel. */
export async function GET() {
  if (!(await tienePermiso("exportar"))) return new Response("Tu perfil no permite exportar a Excel.", { status: 403 });

  const casos = await casosDeUso();
  const [activos, inactivos] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.listarProductos.ejecutar({ filtro: "inactivos" }),
  ]);
  const csv = generarCsv(
    ["Producto", "Categoría", "Código", "Se vende", "Precio de venta", "Costo", "Existencia", "Stock mínimo", "Unidad", "Estado", "Valor a costo"],
    [...activos.productos, ...inactivos.productos].map(({ producto: p, estado }) => [
      p.nombre,
      CATEGORIAS_PRODUCTO[p.categoria],
      p.codigo,
      esGranel(p) ? `A granel (${p.porcionGramos} g por ${p.porcionNombre ?? "porción"})` : "Por pieza",
      p.precioVenta,
      p.costo,
      p.stock,
      p.stockMinimo,
      esGranel(p) ? "gramos" : "piezas",
      p.activo ? ESTADOS[estado] : "Desactivado",
      costoPorUnidad(p) === null ? null : Math.round(costoPorUnidad(p)! * p.stock * 100) / 100,
    ]),
  );
  return respuestaCsv(`inventario-${hoyEn(entorno.zonaHoraria)}.csv`, csv);
}
