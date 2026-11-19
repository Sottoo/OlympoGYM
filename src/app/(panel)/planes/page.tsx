import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { describirDuracion, esPlanDeVisita, type Plan } from "@/domain/entities/Plan";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Panel } from "@/presentation/components/Panel";
import { formatearDinero } from "@/shared/formato";
import { AccionesDelPlan } from "./AccionesDelPlan";
import { FormularioPlan } from "./FormularioPlan";

export const metadata: Metadata = { title: "Planes" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ editar?: string; editado?: string; eliminado?: string; desactivado?: string; activado?: string }>;
}

export default async function PaginaPlanes({ searchParams }: Props) {
  await exigirPermiso("planes.gestionar");
  const { editar, editado, eliminado, desactivado, activado } = await searchParams;
  const casos = await casosDeUso();
  const [planes, vendidos] = await Promise.all([casos.listarPlanes.ejecutar(), casos.listarPlanesVendidos.ejecutar()]);
  const activos = planes.filter((p) => p.activo);
  const inactivos = planes.filter((p) => !p.activo);
  const visitasActivas = activos.filter(esPlanDeVisita);
  const enEdicion = editar ? planes.find((p) => p.id === editar) : undefined;

  const aviso = editado
    ? `Plan «${editado}» actualizado. Los próximos cobros usan los datos nuevos.`
    : eliminado
      ? `Plan «${eliminado}» eliminado.`
      : desactivado
        ? `Plan «${desactivado}» desactivado: ya no se vende.`
        : activado
          ? `Plan «${activado}» activado: ya se puede vender.`
          : undefined;

  const fila = (p: Plan) => (
    <tr key={p.id} className={enEdicion?.id === p.id ? "bg-hundido/60" : ""}>
      <td>
        <span className={`flex flex-wrap items-center gap-2 font-semibold ${p.activo ? "" : "text-gris"}`}>
          {p.nombre}
          {esPlanDeVisita(p) && <Insignia tono="oscuro">Visita</Insignia>}
          {!p.activo && <Insignia tono="neutro">Desactivado</Insignia>}
        </span>
        {p.descripcion && <span className="text-sm text-gris">{p.descripcion}</span>}
      </td>
      <td className="whitespace-nowrap text-tinta-suave">{describirDuracion(p)}</td>
      <td className={`numero cifra text-xl ${p.activo ? "" : "text-gris"}`}>{formatearDinero(p.precio)}</td>
      <td>
        <div className="flex justify-end gap-2">
          <Link href={`/planes?editar=${p.id}`} className="boton-secundario boton-chico" aria-label={`Editar ${p.nombre}`}>
            <Icono nombre="editar" className="size-3.5" />
            Editar
          </Link>
          <AccionesDelPlan
            planId={p.id}
            nombre={p.nombre}
            activo={p.activo}
            vendido={vendidos.has(p.id)}
            unicaVisita={p.activo && esPlanDeVisita(p) && visitasActivas.length === 1}
          />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="pagina">
      <Encabezado icono="planes" titulo="Planes" descripcion="Lo que se cobra: membresías y la visita de un día." guia="planes" />

      <MensajeExito mensaje={aviso} />

      {visitasActivas.length === 0 && (
        <p className="rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.9rem]">
          <b className="font-semibold">Falta un plan de visita.</b> Crea uno en «Nuevo plan» → «Visita de un día» para poder cobrar a quien llega sin
          membresía.
        </p>
      )}

      <div className="con-lateral">
        {planes.length === 0 ? (
          <Vacio>Todavía no hay planes. Crea el primero en «Nuevo plan»: por ejemplo Mensualidad o Visita.</Vacio>
        ) : (
          // Sin recorte horizontal: el menú «Más» de cada plan se despliega por encima de la tabla.
          <div className="superficie">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duración</th>
                  <th className="numero">Precio</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>{activos.map(fila)}</tbody>
              {inactivos.length > 0 && (
                <tbody>
                  <tr>
                    <td colSpan={4} className="pt-5 pb-1.5">
                      <span className="rotulo">Desactivados · ya no se venden</span>
                    </td>
                  </tr>
                  {inactivos.map(fila)}
                </tbody>
              )}
            </table>
          </div>
        )}

        {enEdicion ? (
          <Panel titulo={`Editar «${enEdicion.nombre}»`}>
            <FormularioPlan key={enEdicion.id} plan={enEdicion} vendido={vendidos.has(enEdicion.id)} />
          </Panel>
        ) : (
          <Panel titulo="Nuevo plan">
            <FormularioPlan />
          </Panel>
        )}
      </div>
    </div>
  );
}
