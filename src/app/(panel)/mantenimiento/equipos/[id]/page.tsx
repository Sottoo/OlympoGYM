import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AREAS_EQUIPO, describirFrecuencia, TIPOS_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Panel, PanelTabla } from "@/presentation/components/Panel";
import { fechaLocal, formatearDinero, formatearFecha } from "@/shared/formato";
import { CerrarReporte } from "../../CerrarReporte";
import { EstadoEquipoInsignia, EstadoPagoInsignia, hace, textoPreventivo } from "../../piezas";
import { AccionesDelEquipo } from "./AccionesDelEquipo";

export const metadata: Metadata = { title: "Máquina" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  nuevo: "Máquina agregada.",
  editado: "Cambios guardados.",
  baja: "Listo: quedó dada de baja. Su historial se conserva.",
  reactivado: "Máquina reactivada.",
  reportado: "Falla reportada. La administración ya la ve en su lista.",
  escalado: "Esa falla ya estaba reportada; ahora la máquina quedó marcada fuera de servicio.",
  "registro-eliminado": "Se eliminó el registro de mantenimiento y sus pagos.",
};

export default async function PaginaEquipo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const gestiona = await tienePermiso("mantenimiento.gestionar");
  const f = await (await casosDeUso()).obtenerFichaDeEquipo.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });
  const { equipo: e } = f;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date());
  const p = textoPreventivo(f.preventivo);
  const preventivos = f.mantenimientos.filter((m) => m.tipo === "preventivo").length;
  const detalle = [AREAS_EQUIPO[e.area], [e.marca, e.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

  return (
    <div className="pagina">
      <Encabezado
        titulo={e.nombre}
        imagen={<Emblema {...dibujoDeEquipo(e)} tamano="xl" apagado={!e.activo} />}
        volver={{ href: "/mantenimiento", texto: "Máquinas" }}
        etiquetas={<EstadoEquipoInsignia estado={f.estado} />}
        descripcion={detalle}
        acciones={
          <>
            {e.activo && (
              <Link href={`/mantenimiento/reportar?equipo=${e.id}`} className={gestiona ? "boton-secundario" : "boton"}>
                <Icono nombre="alerta" className="size-4" />
                Reportar falla
              </Link>
            )}
            {gestiona && e.activo && (
              <Link href={`/mantenimiento/registrar?equipo=${e.id}`} className="boton">
                <Icono nombre="llave" className="size-4" />
                Registrar mantenimiento
              </Link>
            )}
            {gestiona && <AccionesDelEquipo equipoId={e.id} nombre={e.nombre} activo={e.activo} tieneHistorial={f.tieneHistorial} />}
          </>
        }
      />

      <MensajeExito mensaje={aviso ? AVISOS[aviso] : undefined} />
      {!e.activo && (
        <p role="status" className="flex items-start gap-2.5 rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.92rem]">
          <Icono nombre="alerta" className="mt-0.5 size-[18px] shrink-0 text-ambar" />
          <span>
            <strong className="font-semibold">Dada de baja.</strong> No aparece para reportar fallas ni en los preventivos.
          </span>
        </p>
      )}

      <Indicadores
        datos={[
          {
            etiqueta: "Próximo preventivo", icono: "reloj" as const,
            valor: f.preventivo.estado === "sin_programa" ? "—" : p.texto,
            alerta: f.preventivo.estado === "vencido",
            destacada: true,
            detalle:
              f.preventivo.estado === "sin_programa"
                ? "Sin programa de preventivo"
                : `${describirFrecuencia(e.frecuenciaMeses)} · ${formatearFecha(f.preventivo.proximo)}`,
          },
          {
            etiqueta: "Último servicio", icono: "llave" as const,
            valor: f.ultimoServicio ? formatearFecha(f.ultimoServicio) : "—",
            detalle: f.ultimoServicio ? TIPOS_MANTENIMIENTO[f.mantenimientos[0].tipo] : "Todavía sin registros",
          },
          ...(gestiona
            ? [
                { etiqueta: "Costo en 12 meses", icono: "ventas" as const, valor: formatearDinero(f.costo12Meses), detalle: `Desde que se registra: ${formatearDinero(f.costoTotal)}` },
                {
                  etiqueta: "Mantenimientos", icono: "bitacora" as const,
                  valor: f.mantenimientos.length,
                  detalle: `${preventivos} ${preventivos === 1 ? "preventivo" : "preventivos"} · ${f.mantenimientos.length - preventivos} ${f.mantenimientos.length - preventivos === 1 ? "reparación" : "reparaciones"}`,
                },
              ]
            : [{
                etiqueta: "Fallas abiertas", icono: "alerta" as const, valor: f.reportes.length, alerta: f.reportes.some((r) => r.fueraDeServicio),
                detalle: f.reportes.length === 0 ? "Sin fallas reportadas" : f.reportes.some((r) => r.fueraDeServicio) ? "Fuera de servicio" : "Todavía se puede usar",
              }]),
        ]}
      />

      {f.reportes.length > 0 && (
        <Panel titulo="Fallas reportadas" icono="alerta">
          <ul className="-mt-1">
            {f.reportes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-linea py-3 last:border-0">
                <span className="min-w-0">
                  <span className="block">{r.descripcion}</span>
                  <span className="text-[0.78rem] text-gris">
                    Reportó {r.reportadoPor ?? "recepción"}, {hace(fechaLocal(r.reportadoEn, entorno.zonaHoraria), hoy)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {r.fueraDeServicio ? <Insignia tono="rojo">Fuera de servicio</Insignia> : <Insignia tono="ambar">Se puede usar</Insignia>}
                  {gestiona && (
                    <>
                      <Link href={`/mantenimiento/registrar?equipo=${e.id}&tipo=correctivo`} className="boton-oscuro boton-chico">
                        Registrar el arreglo
                      </Link>
                      <CerrarReporte reporteId={r.id} equipo={e.nombre} />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="con-lateral">
        <PanelTabla titulo="Mantenimientos">
          {f.mantenimientos.length === 0 ? (
            <div className="px-2 pb-2">
              <Vacio>
                {gestiona && e.activo ? "Todavía no hay mantenimientos. Registra el primero con el botón de arriba." : "Todavía no hay mantenimientos registrados."}
              </Vacio>
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Qué se hizo</th>
                  {gestiona && <th className="numero">Costo</th>}
                  {gestiona && <th>Pago</th>}
                </tr>
              </thead>
              <tbody>
                {f.mantenimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap tabular-nums text-tinta-suave">
                      {gestiona ? (
                        <Link href={`/mantenimiento/registro/${m.id}`} className="enlace">{formatearFecha(m.fecha)}</Link>
                      ) : (
                        formatearFecha(m.fecha)
                      )}
                    </td>
                    <td className="whitespace-nowrap">{TIPOS_MANTENIMIENTO[m.tipo]}</td>
                    <td>
                      <span className="block text-[0.93rem]">{m.descripcion}</span>
                      {m.proveedor && <span className="block text-sm text-gris">{m.proveedor}</span>}
                    </td>
                    {gestiona && <td className="numero font-semibold">{m.total > 0 ? formatearDinero(m.total) : <span className="font-normal text-gris">—</span>}</td>}
                    {gestiona && (
                      <td>
                        <EstadoPagoInsignia m={m} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelTabla>

        <aside className="bloques">
          <Panel titulo="Datos de la máquina">
            <dl className="grid gap-3 text-[0.9rem]">
              {[
                ["Área", AREAS_EQUIPO[e.area]],
                ["Marca y modelo", [e.marca, e.modelo].filter(Boolean).join(" ") || "—"],
                ["Número de serie", e.numeroSerie ?? "—"],
                ["Fecha de compra", e.fechaCompra ? formatearFecha(e.fechaCompra) : "—"],
                ["Preventivo", describirFrecuencia(e.frecuenciaMeses)],
                ...(e.nota ? [["Nota", e.nota]] : []),
              ].map(([k, valor]) => (
                <div key={k} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b border-dashed border-linea pb-2.5 last:border-0 last:pb-0">
                  <dt className="text-gris">{k}</dt>
                  <dd className="min-w-0 break-words">{valor}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {f.reportesCerrados.length > 0 && (
            <Panel titulo="Fallas resueltas">
              <ul className="grid gap-2.5 text-[0.86rem]">
                {f.reportesCerrados.slice(0, 6).map((r) => (
                  <li key={r.id} className="border-b border-dashed border-linea pb-2.5 last:border-0 last:pb-0">
                    <span className="block">{r.descripcion}</span>
                    <span className="text-[0.78rem] text-gris">
                      {r.atendidoEn ? formatearFecha(fechaLocal(r.atendidoEn, entorno.zonaHoraria)) : ""}
                      {" · "}
                      {r.mantenimientoId ? "se arregló con un mantenimiento" : r.cierre}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
