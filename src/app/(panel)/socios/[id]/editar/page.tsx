import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nombreCompleto } from "@/domain/entities/Socio";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioSocio } from "../../FormularioSocio";

export const metadata: Metadata = { title: "Editar socio" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { socio, fotoUrl } = await (await casosDeUso()).obtenerDetalleSocio.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });

  return (
    <div className="space-y-6">
      <Encabezado titulo="Editar datos" volver={{ href: `/socios/${id}`, texto: nombreCompleto(socio) }} />
      <FormularioSocio socio={socio} fotoUrl={fotoUrl} />
    </div>
  );
}
