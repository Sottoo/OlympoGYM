import type { Metadata } from "next";
import Link from "next/link";
import { AREAS_EQUIPO, ESTADOS_EQUIPO } from "@/domain/entities/Mantenimiento";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { FormularioReporte } from "./FormularioReporte";

export const metadata: Metadata = { title: "Reportar una falla" };
export const dynamic = "force-dynamic";

export default async function PaginaReportar({ searchParams }: { searchParams: Promise<{ equipo?: string }> }) {
  const { equipo } = await searchParams;
  const t = await (await casosDeUso()).obtenerTableroDeMantenimiento.ejecutar();
  const activos = t.equipos.filter((e) => e.equipo.activo);
  const desdeFicha = Boolean(equipo && activos.some((e) => e.equipo.id === equipo));

  return (
    <div className="pagina max-w-3xl">
      <Encabezado
        titulo="Reportar una falla"
        volver={desdeFicha ? { href: `/mantenimiento/equipos/${equipo}`, texto: "Máquina" } : { href: "/mantenimiento", texto: "Máquinas" }}
      />
      {activos.length === 0 ? (
        <Vacio accion={<Link href="/mantenimiento" className="boton-secundario">Volver</Link>}>Todavía no hay máquinas registradas.</Vacio>
      ) : (
        <FormularioReporte
          equipoInicial={desdeFicha ? equipo : undefined}
          volverAFicha={desdeFicha}
          equipos={activos.map((e) => ({
            valor: e.equipo.id,
            texto: e.equipo.nombre,
            detalle:
              e.estado === "funcionando"
                ? AREAS_EQUIPO[e.equipo.area]
                : `${ESTADOS_EQUIPO[e.estado]}: ${e.reportes.map((r) => r.descripcion).join(" · ")}`,
          }))}
          abiertos={Object.fromEntries(activos.map((e) => [e.equipo.id, e.reportes.map((r) => r.descripcion)]))}
        />
      )}
    </div>
  );
}
