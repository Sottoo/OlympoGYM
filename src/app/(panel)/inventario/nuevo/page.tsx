import type { Metadata } from "next";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioProducto } from "../FormularioProducto";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function PaginaNuevoProducto() {
  return (
    <div className="space-y-6">
      <Encabezado titulo="Nuevo producto" volver={{ href: "/inventario", texto: "Inventario" }} />
      <FormularioProducto />
    </div>
  );
}
