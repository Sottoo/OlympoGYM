import type { Metadata } from "next";
import { CATALOGO_INICIAL } from "@/domain/entities/CatalogoInicial";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { AltaDesdeCatalogo } from "./AltaDesdeCatalogo";

export const metadata: Metadata = { title: "Catálogo de productos" };
export const dynamic = "force-dynamic";

export default async function PaginaCatalogo() {
  await exigirPermiso("inventario.gestionar");
  const casos = await casosDeUso();
  const [{ productos }, { productos: inactivos }] = await Promise.all([
    casos.listarProductos.ejecutar({ filtro: "activos" }),
    casos.listarProductos.ejecutar({ filtro: "inactivos" }),
  ]);

  return (
    <div className="pagina">
      <Encabezado
        titulo="Agregar del catálogo"
        volver={{ href: "/inventario", texto: "Inventario" }}
        descripcion="Lo que suele venderse en un gimnasio. Marca lo que vendes, pon tu precio y lo que tienes, y se da de alta todo junto."
      />
      <AltaDesdeCatalogo
        catalogo={CATALOGO_INICIAL}
        registrados={[...productos, ...inactivos].map(({ producto: p }) => ({ id: p.id, nombre: p.nombre, activo: p.activo, foto: p.foto }))}
      />
    </div>
  );
}
