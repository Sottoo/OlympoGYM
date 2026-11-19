import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saldoDe, TIPOS_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { nombreDelMetodo } from "@/domain/entities/Pago";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Indicadores } from "@/presentation/components/Indicadores";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Panel, PanelTabla } from "@/presentation/components/Panel";
import { formatearDinero, formatearFecha, formatearFechaLarga } from "@/shared/formato";
import { EstadoPagoInsignia } from "../../piezas";
import { AnularPago, EliminarRegistro } from "./Acciones";
import { FormularioAbono } from "./FormularioAbono";

export const metadata: Metadata = { title: "Mantenimiento" };
export const dynamic = "force-dynamic";

export default async function PaginaRegistro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  await exigirPermiso("mantenimiento.gestionar");
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const m = await (await casosDeUso()).obtenerMantenimiento.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });
  const saldo = saldoDe(m);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date());

  return (
    <div className="pagina">
      <Encabezado
        titulo={`${TIPOS_MANTENIMIENTO[m.tipo]} · ${m.equipoNombre}`}
        imagen={<Emblema {...dibujoDeEquipo({ nombre: m.equipoNombre, area: "otro" })} tamano="lg" />}
        volver={m.equipoEliminado ? { href: "/mantenimiento/historial", texto: "Historial" } : { href: `/mantenimiento/equipos/${m.equipoId}`, texto: m.equipoNombre }}
        etiquetas={<EstadoPagoInsignia m={m} />}
        descripcion={
          <span className="first-letter:uppercase">
            {formatearFechaLarga(m.fecha)}
            {m.proveedor && ` · ${m.proveedor}`}
          </span>
        }
      />

      <MensajeExito
        mensaje={
          aviso === "nuevo"
            ? saldo > 0
              ? `Mantenimiento registrado. Quedan ${formatearDinero(saldo)} por pagar${m.proveedor ? ` a ${m.proveedor}` : ""}; aparecen en «Por pagar».`
              : "Mantenimiento registrado."
            : aviso === "liquidado"
              ? "Pago registrado: este mantenimiento quedó pagado por completo."
              : aviso === "anulado"
                ? "Pago anulado. Ese monto volvió a quedar por pagar."
                : undefined
        }
      />

      <Indicadores
        datos={[
          { etiqueta: "Total", icono: "ventas", valor: formatearDinero(m.total), destacada: true, detalle: `Mano de obra ${formatearDinero(m.manoDeObra)} · refacciones ${formatearDinero(m.refacciones)}` },
          { etiqueta: "Pagado", icono: "check", valor: formatearDinero(m.pagado), detalle: m.abonos.length === 0 ? "Sin pagos" : m.abonos.length === 1 ? "En 1 pago" : `En ${m.abonos.length} pagos` },
          { etiqueta: "Por pagar", icono: "reloj", valor: formatearDinero(saldo), alerta: saldo > 0, detalle: saldo > 0 ? (m.proveedor ? `A ${m.proveedor}` : "Pendiente") : m.total > 0 ? "Liquidado" : "Sin costo" },
        ]}
      />

      <div className="con-lateral">
        <div className="bloques">
          <Panel titulo="Qué se hizo">
            <p className="whitespace-pre-line">{m.descripcion}</p>
            {m.nota && <p className="mt-2 text-[0.88rem] text-gris">Nota: {m.nota}</p>}
            {m.resolvio.length > 0 && (
              <div className="mt-4 border-t border-dashed border-linea pt-3">
                <p className="rotulo mb-1.5">Fallas que arregló</p>
                <ul className="grid gap-1 text-[0.9rem]">
                  {m.resolvio.map((r) => (
                    <li key={r.id}>· {r.descripcion}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <PanelTabla titulo="Pagos" descripcion="Lo que se le ha pagado al técnico por este trabajo.">
            {m.abonos.length === 0 ? (
              <div className="px-2 pb-2">
                <Vacio>{m.total > 0 ? "Todavía no se le ha pagado nada." : "Este trabajo no tuvo costo."}</Vacio>
              </div>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Nota</th>
                    <th className="numero">Monto</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {m.abonos.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap tabular-nums text-tinta-suave">
                        <Link href={`/ventas?fecha=${a.fecha}`} className="enlace" title="Ver el corte de ese día">{formatearFecha(a.fecha)}</Link>
                      </td>
                      <td className="whitespace-nowrap">{nombreDelMetodo(a.metodo)}</td>
                      <td className="text-sm text-gris">{a.nota ?? ""}</td>
                      <td className="numero font-semibold">{formatearDinero(a.monto)}</td>
                      <td className="text-right">
                        {/* Los pagos de días anteriores ya están en su corte: solo se anulan el mismo día. */}
                        {a.anulable ? (
                          <AnularPago abonoId={a.id} monto={formatearDinero(a.monto)} />
                        ) : (
                          <span className="text-[0.8rem] text-gris" title="Ya está en el corte de ese día; solo se puede anular el mismo día en que se pagó.">
                            En su corte
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelTabla>
        </div>

        <aside className="bloques">
          {saldo > 0 && (
            <Panel titulo="Registrar un pago" descripcion={`Se deben ${formatearDinero(saldo)}${m.proveedor ? ` a ${m.proveedor}` : ""}.`}>
              <FormularioAbono mantenimientoId={m.id} saldo={saldo} hoy={hoy} desde={m.fecha} />
            </Panel>
          )}
          <Panel titulo="¿Se registró por error?">
            {m.eliminable ? (
              <>
                <p className="mb-3 text-[0.86rem] text-gris">Puedes eliminar este registro con sus pagos. Si arregló una falla, la falla vuelve a quedar abierta.</p>
                <EliminarRegistro mantenimientoId={m.id} titulo={`${TIPOS_MANTENIMIENTO[m.tipo].toLowerCase()} de ${m.equipoNombre}`} pagos={m.abonos.length} />
              </>
            ) : (
              <p className="text-[0.86rem] text-gris">Este registro tiene pagos de días anteriores que ya están en sus cortes; no se puede eliminar.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
