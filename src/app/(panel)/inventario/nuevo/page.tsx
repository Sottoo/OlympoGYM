import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioProducto } from "../FormularioProducto";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function PaginaNuevoProducto({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  await exigirPermiso("inventario.gestionar");
  const { codigo } = await searchParams;
  return (
    <div className="pagina mx-auto w-full max-w-3xl">
      <Encabezado titulo="Nuevo producto" volver={{ href: "/inventario", texto: "Inventario" }} />
      <FormularioProducto codigoInicial={codigo?.slice(0, 30)} />
    </div>
  );
}
