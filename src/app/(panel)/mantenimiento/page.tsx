import type { Metadata } from "next";
import Link from "next/link";
import { AREAS_EQUIPO, describirFrecuencia } from "@/domain/entities/Mantenimiento";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Panel } from "@/presentation/components/Panel";
import { Pestanas } from "@/presentation/components/Pestanas";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { fechaLocal, formatearDinero, formatearFecha } from "@/shared/formato";
import { CerrarReporte } from "./CerrarReporte";
import { EstadoEquipoInsignia, hace, Preventivo, textoPreventivo } from "./piezas";
import { SeccionesDeMantenimiento } from "./Secciones";

export const metadata: Metadata = { title: "Mantenimiento" };
export const dynamic = "force-dynamic";

const FILTROS = { todos: "Todos", atencion: "Requieren atención", baja: "Dados de baja" } as const;
type Filtro = keyof typeof FILTROS;

interface Props {
  searchParams: Promise<{ filtro?: string; aviso?: string; n?: string; eliminado?: string }>;
}

export default async function PaginaMantenimiento({ searchParams }: Props) {
  const { filtro: filtroUrl, aviso, n, eliminado } = await searchParams;
  const filtro: Filtro = filtroUrl && Object.hasOwn(FILTROS, filtroUrl) ? (filtroUrl as Filtro) : "todos";
  const casos = await casosDeUso();
  const gestiona = await tienePermiso("mantenimiento.gestionar");
  const [t, gastos] = await Promise.all([casos.obtenerTableroDeMantenimiento.ejecutar(), gestiona ? casos.obtenerResumenDeGastos.ejecutar() : null]);
  const { cuentas } = t;

  const requiereAtencion = (e: (typeof t.equipos)[number]) =>
    e.equipo.activo && (e.estado !== "funcionando" || (gestiona && (e.preventivo.estado === "vencido" || e.preventivo.estado === "pronto")));
  const visibles = t.equipos.filter((e) => (filtro === "baja" ? !e.equipo.activo : filtro === "atencion" ? requiereAtencion(e) : e.equipo.activo));
  const preventivos = gestiona
    ? t.equipos
        .filter((e) => e.equipo.activo && (e.preventivo.estado === "vencido" || e.preventivo.estado === "pronto"))
        .sort((a, b) => ("dias" in a.preventivo ? a.preventivo.dias : 0) - ("dias" in b.preventivo ? b.preventivo.dias : 0))
    : [];
  const dadosDeBaja = t.equipos.length - cuentas.activos;
  const areaDe = new Map(t.equipos.map((e) => [e.equipo.id, e.equipo.area]));

  const avisos: Record<string, string> = {
    alta: `${n === "1" ? "1 equipo dado" : `${n} equipos dados`} de alta. Ya puedes registrarles mantenimientos y reportar fallas.`,
    reportado: "Falla reportada. La administración ya la ve en su lista; gracias por avisar.",
  };

  return (
    <div className="pagina">
      <Encabezado icono="llave"
        titulo="Mantenimiento"
        descripcion={
          gestiona
            ? "Tus máquinas: cuáles funcionan, cuándo les toca servicio, lo que han costado y lo que se debe."
            : "Qué máquinas funcionan y cuáles tienen falla. Si algo falla, repórtalo aquí para que la administración lo arregle."
        }
        acciones={
          t.equipos.length > 0 && (
            <>
              <Link href="/mantenimiento/reportar" className={gestiona ? "boton-secundario" : "boton"}>
                <Icono nombre="alerta" className="size-4" />
                Reportar una falla
              </Link>
              {gestiona && (
                <Link href="/mantenimiento/registrar" className="boton">
                  <Icono nombre="mas" className="size-4" />
                  Registrar mantenimiento
                </Link>
              )}
            </>
          )
        }
      />

      <MensajeExito mensaje={eliminado ? `«${eliminado}» se eliminó.` : aviso ? avisos[aviso] : undefined} />

      {t.equipos.length === 0 ? (
        <Vacio
          accion={
            gestiona && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/mantenimiento/equipos/rapido" className="boton">Alta rápida de equipos</Link>
                <Link href="/mantenimiento/equipos/nuevo" className="boton-secundario">Uno por uno</Link>
              </div>
            )
          }
        >
          {gestiona
            ? "Todavía no hay máquinas registradas. Con la alta rápida marcas las que tienes (3 caminadoras, 2 elípticas…) y quedan listas en un minuto."
            : "Todavía no hay máquinas registradas. Las da de alta la administración."}
        </Vacio>
      ) : (
        <>
          {gestiona && <SeccionesDeMantenimiento activa="equipos" porPagar={gastos?.pendientes ?? 0} />}

          <Indicadores
            datos={[
              {
                etiqueta: "Funcionando", icono: "check" as const,
                valor: `${cuentas.funcionando} de ${cuentas.activos}`,
                destacada: true,
                avance: { valor: cuentas.funcionando, total: cuentas.activos, tono: "tinta" as const },
                detalle: cuentas.funcionando === cuentas.activos ? "Todo en orden" : "Las demás tienen una falla reportada",
              },
              {
                etiqueta: "Con falla", icono: "alerta" as const,
                valor: cuentas.conFalla + cuentas.fueraDeServicio,
                alerta: cuentas.fueraDeServicio > 0,
                avance: { valor: cuentas.conFalla + cuentas.fueraDeServicio, total: cuentas.activos, tono: "rojo" as const },
                detalle: cuentas.fueraDeServicio > 0 ? `${cuentas.fueraDeServicio} fuera de servicio` : "Ninguna fuera de servicio",
              },
              ...(gestiona && gastos
                ? [
                    {
                      etiqueta: "Preventivos por hacer", icono: "reloj" as const,
                      valor: cuentas.preventivosPorHacer,
                      alerta: cuentas.vencidos > 0,
                      detalle: cuentas.vencidos > 0 ? `${cuentas.vencidos} ${cuentas.vencidos === 1 ? "ya vencido" : "ya vencidos"}` : "En los próximos 14 días",
                    },
                    {
                      etiqueta: "Pagado este mes", icono: "ventas" as const,
                      valor: formatearDinero(gastos.gastadoMes),
                      avance: gastos.gastadoMes + gastos.porPagar > 0 ? { valor: gastos.gastadoMes, total: gastos.gastadoMes + gastos.porPagar, tono: "verde" as const } : undefined,
                      detalle: gastos.porPagar > 0 ? `Se deben ${formatearDinero(gastos.porPagar)}` : "No se debe nada",
                    },
                  ]
                : [{ etiqueta: "Equipos registrados", icono: "llave" as const, valor: cuentas.activos, detalle: "Si una falla, repórtala arriba" }]),
            ]}
          />

          {(t.reportesAbiertos.length > 0 || preventivos.length > 0) && (
            <div className={preventivos.length > 0 && t.reportesAbiertos.length > 0 ? "mitades" : ""}>
              {t.reportesAbiertos.length > 0 && (
                <Panel titulo="Fallas reportadas" descripcion="Lo que recepción avisó que no funciona bien." icono="alerta">
                  <ul className="-mt-1">
                    {t.reportesAbiertos.map((r) => (
                      <li key={r.id} className="grid gap-1.5 border-b border-dashed border-linea py-3 last:border-0">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="flex items-center gap-2.5">
                            <Emblema {...dibujoDeEquipo({ nombre: r.equipoNombre, area: areaDe.get(r.equipoId) ?? "otro" })} tamano="sm" />
                            <Link href={`/mantenimiento/equipos/${r.equipoId}`} className="enlace font-semibold">
                              {r.equipoNombre}
                            </Link>
                          </span>
                          {r.fueraDeServicio ? <Insignia tono="rojo">Fuera de servicio</Insignia> : <Insignia tono="ambar">Se puede usar</Insignia>}
                        </div>
                        <p className="text-[0.92rem]">{r.descripcion}</p>
                        <p className="text-[0.78rem] text-gris">
                          Reportó {r.reportadoPor ?? "recepción"}, {hace(fechaLocal(r.reportadoEn, entorno.zonaHoraria), t.hoy)}
                        </p>
                        {gestiona && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <Link href={`/mantenimiento/registrar?equipo=${r.equipoId}&tipo=correctivo`} className="boton-oscuro boton-chico">
                              Registrar el arreglo
                            </Link>
                            <CerrarReporte reporteId={r.id} equipo={r.equipoNombre} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {preventivos.length > 0 && (
                <Panel titulo="Preventivos por hacer" descripcion="Vencidos o que tocan en los próximos 14 días." icono="reloj">
                  <ul className="-mt-1">
                    {preventivos.map((e) => {
                      const p = textoPreventivo(e.preventivo);
                      return (
                        <li key={e.equipo.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-dashed border-linea py-3 last:border-0">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Emblema {...dibujoDeEquipo(e.equipo)} tamano="sm" />
                            <span className="min-w-0">
                            <Link href={`/mantenimiento/equipos/${e.equipo.id}`} className="enlace block font-semibold">
                              {e.equipo.nombre}
                            </Link>
                            <span className="text-[0.8rem]">
                              <span className={p.clase}>{p.texto}</span>
                              <span className="text-gris"> · {describirFrecuencia(e.equipo.frecuenciaMeses).toLowerCase()}</span>
                            </span>
                            </span>
                          </span>
                          <Link href={`/mantenimiento/registrar?equipo=${e.equipo.id}&tipo=preventivo`} className="boton-secundario boton-chico">
                            Registrar preventivo
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Pestanas
              etiqueta="Filtrar equipos"
              opciones={(Object.keys(FILTROS) as Filtro[])
                .filter((f) => f !== "baja" || dadosDeBaja > 0)
                .map((f) => ({
                  href: f === "todos" ? "/mantenimiento" : `/mantenimiento?filtro=${f}`,
                  texto: FILTROS[f],
                  cuenta: f === "todos" ? cuentas.activos : f === "baja" ? dadosDeBaja : t.equipos.filter(requiereAtencion).length,
                  activa: f === filtro,
                }))}
            />
            {gestiona && (
              <div className="flex flex-wrap gap-2">
                <Link href="/mantenimiento/equipos/rapido" className="boton-secundario boton-chico">Alta rápida</Link>
                <Link href="/mantenimiento/equipos/nuevo" className="boton-secundario boton-chico">
                  <Icono nombre="mas" className="size-3.5" />
                  Nuevo equipo
                </Link>
              </div>
            )}
          </div>

          {visibles.length === 0 ? (
            <Vacio>{filtro === "atencion" ? "Nada pendiente: todas las máquinas funcionan y están al día." : "No hay equipos en esta lista."}</Vacio>
          ) : (
            <div className="superficie overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Área</th>
                    <th>Estado</th>
                    <th>Próximo preventivo</th>
                    <th>Último servicio</th>
                    {gestiona && <th className="numero">Costo 12 meses</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e) => {
                    const detalle = [e.equipo.marca, e.equipo.modelo].filter(Boolean).join(" ");
                    const costo = gastos?.costoPorEquipo.get(e.equipo.id) ?? 0;
                    return (
                      <tr key={e.equipo.id} className={e.equipo.activo ? "" : "text-gris"}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Emblema {...dibujoDeEquipo(e.equipo)} tamano="sm" apagado={!e.equipo.activo} />
                            <span className="min-w-0">
                              <Link href={`/mantenimiento/equipos/${e.equipo.id}`} className="enlace font-medium">
                                {e.equipo.nombre}
                              </Link>
                              {detalle && <span className="block text-sm text-gris">{detalle}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="text-tinta-suave">{AREAS_EQUIPO[e.equipo.area]}</td>
                        <td>
                          <EstadoEquipoInsignia estado={e.estado} />
                        </td>
                        <td className="text-[0.9rem]">
                          <Preventivo p={e.preventivo} />
                        </td>
                        <td className="text-[0.9rem] text-tinta-suave">{e.ultimoServicio ? formatearFecha(e.ultimoServicio) : "—"}</td>
                        {gestiona && <td className="numero">{costo > 0 ? formatearDinero(costo) : <span className="text-gris">—</span>}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
