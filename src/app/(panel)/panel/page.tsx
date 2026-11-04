import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import type { FilaVencimiento } from "@/application/use-cases/dashboard/ObtenerResumen";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { carpetaExtra } from "@/infrastructure/respaldo/respaldo";
import { BotonWhatsApp } from "@/presentation/components/BotonWhatsApp";
import { Icono } from "@/presentation/components/Icono";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { EnlacePanel, Panel } from "@/presentation/components/Panel";
import { compararCon, EtiquetaCifra } from "@/presentation/components/Marcador";
import { describirDiasRestantes, diaDeLaSemana, formatearDinero, formatearFecha, formatearHora, horaLocal, plural } from "@/shared/formato";
import { Mostrador } from "./Mostrador";

export const metadata: Metadata = { title: "Hoy" };
export const dynamic = "force-dynamic";

export default async function PaginaHoy() {
  const casos = await casosDeUso();
  const gestionaMantenimiento = await tienePermiso("mantenimiento.gestionar");
  const [r, hoy, rachas, habituales, veDineroDelMes, gestionaRespaldos, maquinas, gastos] = await Promise.all([
    casos.obtenerResumen.ejecutar(),
    casos.obtenerEntradasDeHoy.ejecutar(),
    casos.obtenerRachas.ejecutar(3),
    casos.obtenerHabituales.ejecutar(5),
    tienePermiso("dinero.historial"),
    tienePermiso("respaldos.gestionar"),
    casos.obtenerTableroDeMantenimiento.ejecutar(),
    gestionaMantenimiento ? casos.obtenerResumenDeGastos.ejecutar() : null,
  ]);
  const fallas = maquinas.cuentas.conFalla + maquinas.cuentas.fueraDeServicio;
  const { membresiasMes, ventasMes, ventasHoy, membresiasHoy } = r.ingresos;
  const dia = diaDeLaSemana(r.hoy);
  const diferencia = hoy.entradas.length - hoy.semanaPasadaALaMismaHora;

  const pendientes = [
    { titulo: "Socios por recuperar", icono: "socios" as const, detalle: "Vencieron en los últimos 30 días", cuenta: r.vencidosRecientes.length, href: "/socios?filtro=vencida" },
    { titulo: "Productos por resurtir", icono: "inventario" as const, detalle: "Agotados o en su mínimo", cuenta: r.stockBajo.length, href: "/inventario?filtro=bajo" },
    ...(maquinas.cuentas.activos > 0
      ? [
          {
            titulo: "Máquinas con falla", icono: "alerta" as const,
            detalle: maquinas.cuentas.fueraDeServicio > 0 ? `${maquinas.cuentas.fueraDeServicio} fuera de servicio` : "Reportadas, se pueden usar con cuidado",
            cuenta: fallas,
            href: "/mantenimiento?filtro=atencion",
          },
          ...(gestionaMantenimiento
            ? [
                {
                  titulo: "Mantenimiento preventivo", icono: "llave" as const,
                  detalle: maquinas.cuentas.vencidos > 0 ? `${maquinas.cuentas.vencidos} ${maquinas.cuentas.vencidos === 1 ? "ya vencido" : "ya vencidos"}` : "Toca en los próximos 14 días",
                  cuenta: maquinas.cuentas.preventivosPorHacer,
                  href: "/mantenimiento?filtro=atencion",
                },
              ]
            : []),
        ]
      : []),
    ...(gastos && gastos.pendientes > 0
      ? [{ titulo: "Pagos a técnicos", icono: "ventas" as const, detalle: `Se deben ${formatearDinero(gastos.porPagar)}`, cuenta: gastos.pendientes, href: "/mantenimiento/por-pagar" }]
      : []),
    // Si la computadora falla, sin esta copia se pierde todo: se recuerda hasta que se configure.
    ...(carpetaExtra() || !gestionaRespaldos ? [] : [{ titulo: "Copia de respaldo", icono: "respaldos" as const, detalle: "Configura Google Drive o una USB", cuenta: 1, href: "/respaldos" }]),
  ];

  const porHacer = pendientes.filter((p) => p.cuenta > 0);
  const alDia = pendientes.filter((p) => p.cuenta === 0);

  const recientes = [...hoy.entradas].sort((x, y) => y.registradaEn.localeCompare(x.registradaEn));
  const fecha = new Intl.DateTimeFormat("es-MX", { timeZone: entorno.zonaHoraria, weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="pagina">
      <header>
        <h1 className="titulo first-letter:uppercase">{fecha}</h1>
        <p className="mt-1.5 text-[0.95rem] text-gris">
          {plural(hoy.entradas.length, "entrada")} hasta ahora · <Comparacion diferencia={diferencia} dia={dia} />
        </p>
      </header>

      <div className="con-lateral">
      <div className="bloques">
        <Mostrador
          zonaHoraria={entorno.zonaHoraria}
          gimnasio={entorno.nombreGimnasio}
          habituales={habituales}
          ultimo={recientes[0] ? { nombre: recientes[0].nombre, hora: formatearHora(recientes[0].registradaEn, entorno.zonaHoraria) } : null}
        />

        <Panel
          titulo="Lista de hoy"
          accion={recientes.length > 0 && <EnlacePanel href="/asistencias">{recientes.length > 6 ? `Ver las ${recientes.length}` : "Ver en Entradas"}</EnlacePanel>}
        >
          {recientes.length === 0 ? (
            <p className="rounded-[10px] border-[1.5px] border-dashed border-linea-fuerte px-4 py-6 text-center text-gris">Todavía no llega nadie.</p>
          ) : (
            <table className="-mt-1 w-full text-[0.92rem]">
              <tbody>
                {recientes.slice(0, 6).map((e) => (
                  <tr key={e.id} className="border-b border-dashed border-linea last:border-0">
                    <td className="w-[4.5rem] py-2.5 font-bold tabular-nums">{formatearHora(e.registradaEn, entorno.zonaHoraria)}</td>
                    <td className="py-2.5">
                      <Link href={`/socios/${e.socioId}`} className="enlace font-medium">{e.nombre}</Link>
                    </td>
                    <td className="py-2.5 text-[0.8rem] font-bold tracking-[0.06em] text-hilo tabular-nums">Nº {String(e.numero).padStart(2, "0")}</td>
                    <td className="py-2.5 text-right text-[0.8rem]">
                      {e.excepcion ? (
                        <span className="font-bold text-ambar">Excepción</span>
                      ) : (
                        <Icono nombre="check" className="ml-auto size-4 text-gris" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <aside className="bloques">
        <dl className="grid grid-cols-2 gap-4">
          <EtiquetaCifra
            className="col-span-2"
            cifra={{
              etiqueta: "Entradas de hoy",
              icono: "entradas",
              destacada: true,
              valor: hoy.entradas.length,
              comparacion: compararCon(hoy.entradas.length, hoy.semanaPasadaALaMismaHora, { contra: `vs. el ${dia} pasado a esta hora` }),
              barras: { valores: hoy.porHora.slice(6, 23), resaltar: hoy.horaActual - 6, titulo: "Entradas por hora, de 6:00 a 22:00" },
              detalle: `${hoy.entradas.length > 0 ? `La última a las ${formatearHora(recientes[0].registradaEn, entorno.zonaHoraria)}` : "Todavía no llega nadie"} · vs. el ${dia} pasado a esta hora`,
            }}
          />
          <EtiquetaCifra
            cifra={{
              etiqueta: "Vigentes", icono: "credencial", valor: r.vigentes,
              avance: { valor: r.vigentes, total: r.totalSocios, tono: "verde" },
              detalle: `${r.vigentes === 1 ? "Membresía" : "Membresías"} de ${plural(r.totalSocios, "socio")}`,
            }}
          />
          {veDineroDelMes ? (
            <EtiquetaCifra
              cifra={{ etiqueta: "Este mes", icono: "ventas", valor: formatearDinero(membresiasMes + ventasMes), detalle: `Ingresos · hoy ${formatearDinero(membresiasHoy + ventasHoy)}` }}
            />
          ) : (
            <EtiquetaCifra
              cifra={{
                etiqueta: "Cobrado hoy",
                icono: "ventas",
                valor: formatearDinero(membresiasHoy + ventasHoy),
                detalle: `${formatearDinero(membresiasHoy)} membresías · ${formatearDinero(ventasHoy)} tienda`,
              }}
            />
          )}
        </dl>

        <Panel titulo="Por vencer" accion={<EnlacePanel href="/socios?filtro=por_vencer">Ver todos</EnlacePanel>}>
          {r.porVencer.length === 0 ? (
            <p className="text-[0.88rem] text-gris">Nadie vence en los próximos 7 días.</p>
          ) : (
            <ul>
              {r.porVencer.slice(0, 5).map((f) => (
                <FilaVence key={f.socioId} fila={f} hoy={r.hoy} />
              ))}
            </ul>
          )}
        </Panel>

        {rachas.length > 0 && (
          <Panel titulo="Rachas más largas">
            <ol>
              {rachas.map((x) => (
                <li key={x.socioId} className="border-b border-dashed border-linea py-2.5 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/socios/${x.socioId}`} className="enlace min-w-0 truncate font-medium">{x.nombre}</Link>
                    <span className="shrink-0 text-[0.8rem] text-gris">
                      <b className="cifra mr-1 text-[1.25rem] text-tinta">{x.dias}</b>
                      {x.dias === 1 ? "día" : "días"}
                    </span>
                  </div>
                  {/* Un punto de cruz por cada día seguido, como se marca a mano. */}
                  <p aria-hidden className="mt-0.5 truncate font-bold leading-none tracking-[0.18em] text-hilo/80">
                    {"×".repeat(Math.min(x.dias, 21))}
                    {x.dias > 21 && <span className="text-[0.7rem] tracking-normal text-gris"> +{x.dias - 21}</span>}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel titulo="Pendientes del turno">
          {porHacer.length === 0 ? (
            <p className="text-[0.88rem] text-gris">Todo al día. Buen turno.</p>
          ) : (
            <ul>
              {porHacer.map((p) => (
                <li key={p.titulo}>
                  <Link href={p.href} className="group flex items-center justify-between gap-3 border-b border-dashed border-linea py-2.5 last:border-0">
                    <Emblema icono={p.icono} hilo={p.icono === "alerta" ? "rojo" : "carbon"} tamano="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.88rem] font-semibold group-hover:underline">{p.titulo}</span>
                      <span className="block text-[0.75rem] text-gris">{p.detalle}</span>
                    </span>
                    <span className="cifra text-[1.45rem]">{p.cuenta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {alDia.length > 0 && porHacer.length > 0 && (
            <p className="mt-2.5 text-[0.75rem] text-gris">Al día: {alDia.map((p) => p.titulo.toLowerCase()).join(", ")}.</p>
          )}
        </Panel>
      </aside>
      </div>
    </div>
  );
}

function Comparacion({ diferencia, dia }: { diferencia: number; dia: string }) {
  if (diferencia === 0) return <>igual que el {dia} pasado a esta hora</>;
  const sube = diferencia > 0;
  return (
    <>
      {Math.abs(diferencia)} {sube ? "más" : "menos"} que el {dia} pasado
    </>
  );
}

function FilaVence({ fila, hoy }: { fila: FilaVencimiento; hoy: string }) {
  const dias = Math.max(0, fila.diasRestantes);
  const color = fila.diasRestantes <= 1 ? "text-hilo" : "text-ambar";
  return (
    <li className="flex items-center gap-3 border-b border-dashed border-linea py-2 last:border-0">
      <span className={`grid size-[38px] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-current font-titulos text-[1.1rem] ${color}`} title={describirDiasRestantes(fila.diasRestantes)}>
        {dias}
      </span>
      <span className="min-w-0 flex-1">
        <Link href={`/socios/${fila.socioId}`} className="enlace block truncate text-[0.9rem] font-medium">{fila.nombre}</Link>
        <span className={`text-[0.75rem] ${fila.diasRestantes <= 1 ? "font-semibold text-rojo" : "text-gris"}`}>
          {describirDiasRestantes(fila.diasRestantes)} · {formatearFecha(fila.fechaFin)}
        </span>
      </span>
      {fila.telefono && (
        <BotonWhatsApp
          compacto
          telefono={fila.telefono}
          contexto={{
            socioId: fila.socioId,
            nombre: fila.nombre.split(" ")[0],
            nombreCompleto: fila.nombre,
            gimnasio: entorno.nombreGimnasio,
            hoy,
            hora: horaLocal(entorno.zonaHoraria),
            situacion: "por_vencer",
            diasRestantes: fila.diasRestantes,
            fechaFin: fila.fechaFin,
            plan: fila.planNombre,
          }}
        />
      )}
    </li>
  );
}
