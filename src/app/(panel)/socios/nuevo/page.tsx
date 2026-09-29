import type { Metadata } from "next";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioSocio } from "../FormularioSocio";

export const metadata: Metadata = { title: "Registrar socio" };

export default function PaginaNuevoSocio() {
  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Registrar socio"
        volver={{ href: "/socios", texto: "Socios" }}
        descripcion="Después de guardarlo podrás asignarle un plan y registrar su pago."
      />
      <FormularioSocio />
    </div>
  );
}
