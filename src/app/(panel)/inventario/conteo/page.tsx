import type { Metadata } from "next";
import { precioPorUnidad } from "@/domain/entities/Producto";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { ConteoRapido } from "./ConteoRapido";

export const metadata: Metadata = { title: "Conteo de inventario" };
export const dynamic = "force-dynamic";

export default async function PaginaConteo() {
  await exigirPermiso("inventario.gestionar");
  const { productos } = await (await casosDeUso()).listarProductos.ejecutar({ filtro: "activos" });

  return (
    <div className="pagina">
      <Encabezado
        titulo="Conteo de inventario"
        volver={{ href: "/inventario", texto: "Inventario" }}
        descripcion="Recorre el anaquel y escribe cuánto hay de cada producto. A granel puedes contarlo en botes (un bote a la mitad es 0.5) o en gramos. Las diferencias se ajustan todas juntas."
      />
      {productos.length === 0 ? (
        <Vacio>No hay productos activos que contar.</Vacio>
      ) : (
        <ConteoRapido
          productos={productos
            .map(({ producto: p }) => ({
              id: p.id,
              nombre: p.nombre,
              categoria: p.categoria,
              foto: p.foto,
              stock: p.stock,
              unidad: p.unidad,
              precioUnidad: precioPorUnidad(p),
              granel: p.unidad === "gramo" ? { porcionGramos: p.porcionGramos ?? 1, porcionNombre: p.porcionNombre ?? "porción", envaseGramos: p.envaseGramos } : null,
            }))
            .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre, "es"))}
        />
      )}
    </div>
  );
}
