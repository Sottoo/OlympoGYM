import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioProducto } from "../../FormularioProducto";

export const metadata: Metadata = { title: "Editar producto" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarProducto({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("inventario.gestionar");
  const { id } = await params;
  const { producto } = await (await casosDeUso()).obtenerDetalleProducto.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });

  return (
    <div className="pagina mx-auto w-full max-w-3xl">
      <Encabezado titulo="Editar producto" volver={{ href: `/inventario/${id}`, texto: producto.nombre }} />
      <FormularioProducto producto={producto} />
    </div>
  );
}
