import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { hoyEn } from "@/domain/shared/fechas";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioEquipo } from "../../FormularioEquipo";

export const metadata: Metadata = { title: "Editar máquina" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarEquipo({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("mantenimiento.gestionar");
  const { id } = await params;
  const { equipo } = await (await casosDeUso()).obtenerFichaDeEquipo.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });
  return (
    <div className="pagina max-w-4xl">
      <Encabezado titulo={`Editar ${equipo.nombre}`} volver={{ href: `/mantenimiento/equipos/${id}`, texto: equipo.nombre }} />
      <FormularioEquipo equipo={equipo} hoy={hoyEn(entorno.zonaHoraria)} />
    </div>
  );
}
