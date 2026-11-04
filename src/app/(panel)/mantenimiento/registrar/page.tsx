import type { Metadata } from "next";
import Link from "next/link";
import { describirFrecuencia, ESTADOS_EQUIPO } from "@/domain/entities/Mantenimiento";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { textoPreventivo } from "../piezas";
import { FormularioMantenimiento } from "./FormularioMantenimiento";

export const metadata: Metadata = { title: "Registrar mantenimiento" };
export const dynamic = "force-dynamic";

export default async function PaginaRegistrar({ searchParams }: { searchParams: Promise<{ equipo?: string; tipo?: string }> }) {
  await exigirPermiso("mantenimiento.gestionar");
  const { equipo, tipo } = await searchParams;
  const casos = await casosDeUso();
  const [t, proveedores] = await Promise.all([casos.obtenerTableroDeMantenimiento.ejecutar(), casos.listarProveedores.ejecutar()]);
  const activos = t.equipos.filter((e) => e.equipo.activo);
  const elegido = activos.find((e) => e.equipo.id === equipo);

  return (
    <div className="pagina max-w-4xl">
      <Encabezado
        titulo="Registrar mantenimiento"
        volver={elegido ? { href: `/mantenimiento/equipos/${elegido.equipo.id}`, texto: elegido.equipo.nombre } : { href: "/mantenimiento", texto: "Mantenimiento" }}
        descripcion="Lo que se le hizo a una máquina, quién lo hizo, cuánto costó y cómo quedó el pago."
      />
      {activos.length === 0 ? (
        <Vacio accion={<Link href="/mantenimiento/equipos/rapido" className="boton">Alta rápida de equipos</Link>}>
          Primero da de alta las máquinas del gimnasio.
        </Vacio>
      ) : (
        <FormularioMantenimiento
          hoy={t.hoy}
          proveedores={proveedores}
          equipoInicial={elegido?.equipo.id}
          tipoInicial={tipo === "preventivo" || tipo === "correctivo" ? tipo : elegido && elegido.reportes.length > 0 ? "correctivo" : undefined}
          equipos={activos.map((e) => ({
            id: e.equipo.id,
            nombre: e.equipo.nombre,
            detalle:
              e.estado !== "funcionando"
                ? `${ESTADOS_EQUIPO[e.estado]} · ${e.reportes.map((r) => r.descripcion).join(" · ")}`
                : e.preventivo.estado === "sin_programa"
                  ? "Funcionando · sin programa de preventivo"
                  : `Funcionando · preventivo: ${textoPreventivo(e.preventivo).texto.toLowerCase()}`,
            frecuenciaMeses: e.equipo.frecuenciaMeses,
            frecuenciaTexto: describirFrecuencia(e.equipo.frecuenciaMeses).toLowerCase(),
            reportes: e.reportes.map((r) => ({ id: r.id, descripcion: r.descripcion })),
          }))}
        />
      )}
    </div>
  );
}
