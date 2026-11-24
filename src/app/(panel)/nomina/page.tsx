import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { nombreDelMetodo } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { entorno } from "@/infrastructure/config/entorno";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Panel } from "@/presentation/components/Panel";
import { fechaLocal, formatearDinero, formatearFecha, formatearHora } from "@/shared/formato";
import { accionAnularPagoNomina, accionCambiarEstadoEmpleado } from "./acciones";
import { FormularioEmpleado } from "./FormularioEmpleado";
import { FormularioPagoNomina } from "./FormularioPagoNomina";

export const metadata: Metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ editar?: string; guardado?: string; activado?: string; desactivado?: string; anulado?: string }>;
}

export default async function PaginaNomina({ searchParams }: Props) {
  await exigirPermiso("nomina.gestionar");
  const { editar, guardado, activado, desactivado, anulado } = await searchParams;
  const n = await (await casosDeUso()).consultarNomina.ejecutar();
  const activos = n.empleados.filter((e) => e.activo);
  const inactivos = n.empleados.filter((e) => !e.activo);
  const enEdicion = editar ? n.empleados.find((e) => e.id === editar) : undefined;
  const aviso = guardado
    ? `Datos de ${guardado} actualizados.`
    : activado
      ? `${activado} está activo otra vez.`
      : desactivado
        ? `${desactivado} quedó desactivado: sus pagos se conservan y ya no aparece en el aviso.`
        : anulado
          ? `Pago anulado (${anulado}).`
          : undefined;

  return (
    <div className="pagina">
      <Encabezado icono="billete" titulo="Nómina" descripcion="Lo que se les paga a los empleados cada semana, de lunes a viernes." guia="nomina" />

      <MensajeExito mensaje={aviso} />

      {n.aviso && (
        <p role="status" className="rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.92rem]">
          <b className="font-semibold">Nómina de la semana {n.aviso.texto}:</b> falta pagarle a {n.aviso.faltan.map((e) => e.nombre).join(", ")} ({n.aviso.faltan.length} de{" "}
          {n.aviso.activos}).
        </p>
      )}

      <div className="con-lateral">
        <div className="grid gap-6">
          <Panel titulo="Pagos por semana" accion={<span className="text-[0.84rem] text-gris">Este mes: {formatearDinero(n.totalDelMes)}</span>}>
            {n.semanas.length === 0 ? (
              <Vacio>Todavía no hay pagos de nómina registrados.</Vacio>
            ) : (
              <div className="grid gap-5">
                {n.semanas.map((s) => (
                  <section key={s.semana}>
                    <h3 className="rotulo mb-1.5 flex justify-between gap-3">
                      <span>Semana {s.texto}</span>
                      <span>{formatearDinero(s.total)}</span>
                    </h3>
                    <ul>
                      {s.pagos.map((p) => (
                        <li key={p.id} className="flex items-start justify-between gap-3 border-b border-dashed border-linea py-2 last:border-0">
                          <span className="min-w-0">
                            <span className="block text-[0.9rem] font-semibold">{p.empleadoNombre}</span>
                            <span className="block text-[0.76rem] text-gris">
                              Pagado el {formatearFecha(p.fecha)}
                              {fechaLocal(p.creadoEn, entorno.zonaHoraria) === p.fecha && ` a las ${formatearHora(p.creadoEn, entorno.zonaHoraria)}`}
                              {p.nota && ` · ${p.nota}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="cifra block text-[1.1rem] leading-tight">{formatearDinero(p.monto)}</span>
                            <span className="block text-[0.72rem] text-gris">{nombreDelMetodo(p.metodo)}</span>
                            {/* Solo el mismo día: el corte de un día pasado ya se contó. */}
                            {p.fecha === n.hoy && (
                              <form action={accionAnularPagoNomina}>
                                <input type="hidden" name="pagoId" value={p.id} />
                                <button className="enlace text-[0.74rem] text-rojo">Anular</button>
                              </form>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Panel>

          <Panel titulo="Empleados">
            {n.empleados.length === 0 ? (
              <Vacio>Da de alta a tus empleados para registrar su nómina.</Vacio>
            ) : (
              <ul>
                {[...activos, ...inactivos].map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 border-b border-dashed border-linea py-2.5 last:border-0">
                    <span className="min-w-0">
                      <span className={`flex flex-wrap items-center gap-2 text-[0.9rem] font-semibold ${e.activo ? "" : "text-gris"}`}>
                        {e.nombre}
                        {!e.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                      </span>
                      <span className="block text-[0.76rem] text-gris">
                        {[e.puesto, e.sueldoSemanal !== null ? `${formatearDinero(e.sueldoSemanal)} por semana` : null].filter(Boolean).join(" · ") || "Sin puesto ni sueldo anotado"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-[0.8rem]">
                      <Link href={`/nomina?editar=${e.id}`} className="enlace">
                        Editar
                      </Link>
                      <form action={accionCambiarEstadoEmpleado}>
                        <input type="hidden" name="empleadoId" value={e.id} />
                        <input type="hidden" name="nombre" value={e.nombre} />
                        <input type="hidden" name="activo" value={String(!e.activo)} />
                        <button className="enlace">{e.activo ? "Desactivar" : "Activar"}</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel titulo="Pagar nómina">
            <FormularioPagoNomina
              empleados={activos.map((e) => ({ id: e.id, nombre: e.nombre, puesto: e.puesto, sueldoSemanal: e.sueldoSemanal }))}
              semanas={n.semanasParaPagar}
              semanaSugerida={n.semanaSugerida}
              empleadoSugerido={n.aviso?.faltan[0]?.id}
            />
          </Panel>
          <Panel titulo={enEdicion ? `Editar a ${enEdicion.nombre}` : "Nuevo empleado"}>
            <FormularioEmpleado key={enEdicion?.id ?? "nuevo"} empleado={enEdicion} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
