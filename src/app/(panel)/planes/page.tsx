import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import { describirDuracion, esPlanDeVisita } from "@/domain/entities/Plan";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { Vacio } from "@/presentation/components/Mensajes";
import { formatearDinero } from "@/shared/formato";
import { accionCambiarEstadoPlan } from "./acciones";
import { Panel } from "@/presentation/components/Panel";
import { FormularioPlan } from "./FormularioPlan";

export const metadata: Metadata = { title: "Planes" };
export const dynamic = "force-dynamic";

export default async function PaginaPlanes() {
  await exigirPermiso("planes.gestionar");
  const planes = await (await casosDeUso()).listarPlanes.ejecutar();
  const hayVisita = planes.some((p) => p.activo && esPlanDeVisita(p));

  return (
    <div className="pagina">
      <Encabezado icono="planes"
        titulo="Planes"
        descripcion="Un plan desactivado ya no se vende, pero sigue en el historial de cada socio."
      />

      {!hayVisita && (
        <p className="rounded-[10px] border-[1.5px] border-dashed border-linea-fuerte px-4 py-3 text-[0.88rem] text-tinta-suave">
          <b className="text-tinta">Falta un plan de 1 día.</b> Crea uno (por ejemplo «Visita») para que el mostrador pueda cobrar la entrada a
          quien llega sin membresía. Nadie puede dejar pasar sin pago.
        </p>
      )}

      <div className="con-lateral">
        {planes.length === 0 ? (
          <Vacio>Todavía no hay planes. Crea el primero en «Nuevo plan»: por ejemplo Mensual, Visita (1 día) o Anual.</Vacio>
        ) : (
        <div className="superficie overflow-x-auto">
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
        )}

        <Panel titulo="Nuevo plan" descripcion="Queda disponible en cuanto se crea.">
          <FormularioPlan />
        </Panel>
      </div>
    </div>
  );
}
