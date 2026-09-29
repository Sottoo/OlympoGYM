import type { Metadata } from "next";
import { describirDuracion } from "@/domain/entities/Plan";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { formatearDinero } from "@/shared/formato";
import { accionCambiarEstadoPlan } from "./acciones";
import { FormularioPlan } from "./FormularioPlan";

export const metadata: Metadata = { title: "Planes" };
export const dynamic = "force-dynamic";

export default async function PaginaPlanes() {
  const planes = await (await casosDeUso()).listarPlanes.ejecutar();

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Planes"
        descripcion="Los planes desactivados ya no se pueden vender, pero se conservan en el historial de cada socio."
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="superficie h-fit overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Duración</th>
                <th className="numero">Precio</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className={`flex items-center gap-2 font-semibold ${p.activo ? "" : "text-gris"}`}>
                      {p.nombre}
                      {!p.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                    </span>
                    {p.descripcion && <span className="text-sm text-gris">{p.descripcion}</span>}
                  </td>
                  <td className="whitespace-nowrap text-tinta-suave">{describirDuracion(p)}</td>
                  <td className={`numero cifra text-xl ${p.activo ? "" : "text-gris"}`}>{formatearDinero(p.precio)}</td>
                  <td className="text-right">
                    <form action={accionCambiarEstadoPlan}>
                      <input type="hidden" name="planId" value={p.id} />
                      <input type="hidden" name="activo" value={String(!p.activo)} />
                      <button className="boton-secundario boton-chico">{p.activo ? "Desactivar" : "Activar"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="superficie h-fit">
          <h2 className="subtitulo border-b border-linea px-5 py-3.5">Nuevo plan</h2>
          <div className="p-5">
            <FormularioPlan />
          </div>
        </section>
      </div>
    </div>
  );
}
