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
import { Guia } from "@/presentation/components/Guia";
import { Mostrador } from "./Mostrador";
import { FondoDelDia } from "@/presentation/components/caja/FondoDelDia";

export const metadata: Metadata = { title: "Hoy" };
export const dynamic = "force-dynamic";

export default async function PaginaHoy() {
  const casos = await casosDeUso();
  const gestionaMantenimiento = await tienePermiso("mantenimiento.gestionar");
  const gestionaNomina = await tienePermiso("nomina.gestionar");
  const [r, hoy, habituales, gestionaRespaldos, maquinas, gastos, corte, salidas, fondo, corrigeCobros, nomina, avisoNomina] = await Promise.all([
    casos.obtenerResumen.ejecutar(),
    casos.obtenerEntradasDeHoy.ejecutar(),
    casos.obtenerHabituales.ejecutar(5),
    tienePermiso("respaldos.gestionar"),
    casos.obtenerTableroDeMantenimiento.ejecutar(),
    gestionaMantenimiento ? casos.obtenerResumenDeGastos.ejecutar() : null,
    casos.obtenerCorteDelDia.ejecutar(),
    casos.obtenerSalidasDelDia.ejecutar(),
    casos.obtenerFondoDeCaja.ejecutar(),
    tienePermiso("cobros.corregir"),
    casos.obtenerNominaDelDia.ejecutar(),
    gestionaNomina ? casos.obtenerAvisoDeNomina.ejecutar() : null,
  ]);
  // Corte del día: lo que entró por el gimnasio (membresías y visitas) y por la tienda.
  const efectivoCobrado = corte.porMetodo.efectivo.tienda + corte.porMetodo.efectivo.membresias;
  const transferencias = corte.porMetodo.transferencia.tienda + corte.porMetodo.transferencia.membresias;
  // En el cajón: el fondo con que empezó + lo cobrado en efectivo − lo que salió en pagos (mantenimiento y nómina).
  const salioDeCaja = salidas.efectivo + nomina.efectivo;
  const enCaja = Math.round(((fondo.monto ?? 0) + efectivoCobrado - salioDeCaja) * 100) / 100;
  const detalleCaja = [
    fondo.monto !== null ? `Fondo ${formatearDinero(fondo.monto)}` : "Sin fondo anotado",
    `cobrado ${formatearDinero(efectivoCobrado)}`,
    salioDeCaja > 0 ? `salió ${formatearDinero(salioDeCaja)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const fallas = maquinas.cuentas.conFalla + maquinas.cuentas.fueraDeServicio;
  const dia = diaDeLaSemana(r.hoy);

  const pendientes = [
    // Nómina: desde el viernes, a quién falta pagarle la semana (solo quien lleva la nómina).
    ...(avisoNomina
      ? [{ titulo: "Nómina", icono: "billete" as const, detalle: `Semana ${avisoNomina.texto}: faltan ${avisoNomina.faltan.length} de ${avisoNomina.activos}`, cuenta: avisoNomina.faltan.length, href: "/nomina" }]
      : []),
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

  const recientes = [...hoy.entradas].sort((x, y) => y.registradaEn.localeCompare(x.registradaEn));
  const fecha = new Intl.DateTimeFormat("es-MX", { timeZone: entorno.zonaHoraria, weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="pagina">
      <header className="grid gap-3">
        <h1 className="titulo first-letter:uppercase">{fecha}</h1>
        <Guia clave="hoy" />
      </header>

      {/* Lo primero que se ve: cuánto dinero ha entrado hoy y cuánto debe haber en la caja. */}
      <section aria-labelledby="titulo-corte-hoy" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="titulo-corte-hoy" className="rotulo">
            Corte de hoy
          </h2>
          <EnlacePanel href="/ventas#titulo-corte">Ver detalle</EnlacePanel>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <EtiquetaCifra
            cifra={{
              etiqueta: "Total del día",
              icono: "caja",
              destacada: true,
              valor: formatearDinero(corte.total),
              detalle: `Efectivo ${formatearDinero(efectivoCobrado)} · Transferencia ${formatearDinero(transferencias)}`,
            }}
          />
          <EtiquetaCifra
            cifra={{
              etiqueta: "Gimnasio",
              icono: "credencial",
              valor: formatearDinero(corte.totalMembresias),
              avance: corte.total > 0 ? { valor: corte.totalMembresias, total: corte.total, tono: "tinta" } : undefined,
              detalle: corte.cobros.length === 0 ? "Sin cobros todavía" : `${plural(corte.cobros.length, "cobro")} de membresías y visitas`,
            }}
          />
          <EtiquetaCifra
            cifra={{
              etiqueta: "Tienda",
              icono: "ventas",
              valor: formatearDinero(corte.totalTienda),
              avance: corte.total > 0 ? { valor: corte.totalTienda, total: corte.total, tono: "tinta" } : undefined,
              detalle: corte.ventas.length === 0 ? "Sin ventas todavía" : `${plural(corte.ventas.length, "venta")} · ${plural(corte.piezas, "artículo")}`,
            }}
          />
          <EtiquetaCifra
            cifra={{
              etiqueta: "Efectivo en caja",
              icono: "billete",
              valor: enCaja < 0 ? `−${formatearDinero(-enCaja)}` : formatearDinero(enCaja),
              alerta: enCaja < 0,
              detalle: detalleCaja,
            }}
          />
        </dl>
        <FondoDelDia key={fondo.monto ?? "sin-fondo"} monto={fondo.monto} sugerido={fondo.sugerido} puedeCorregir={corrigeCobros} />
      </section>

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
            <p className="text-[0.88rem] text-gris">Todavía no llega nadie.</p>
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
        <dl>
          <EtiquetaCifra
            cifra={{
              etiqueta: "Entradas de hoy",
              icono: "entradas",
              valor: hoy.entradas.length,
              comparacion: compararCon(hoy.entradas.length, hoy.semanaPasadaALaMismaHora, { contra: `vs. el ${dia} pasado a esta hora` }),
              barras: { valores: hoy.porHora.slice(6, 23), resaltar: hoy.horaActual - 6, titulo: "Entradas por hora, de 6:00 a 22:00" },
              detalle: hoy.entradas.length > 0 ? `La última a las ${formatearHora(recientes[0].registradaEn, entorno.zonaHoraria)}` : "Todavía no llega nadie",
            }}
          />
        </dl>

        <Panel
          titulo="Por vencer"
          accion={<EnlacePanel href="/socios?filtro=por_vencer">Ver todos</EnlacePanel>}
        >
          {r.porVencer.length === 0 ? (
            <p className="text-[0.88rem] text-gris">Nadie tiene que renovar en estos días.</p>
          ) : (
            <ul>
              {r.porVencer.slice(0, 5).map((f) => (
                <FilaVence key={f.socioId} fila={f} hoy={r.hoy} />
              ))}
            </ul>
          )}
        </Panel>

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
        </Panel>
      </aside>
      </div>
    </div>
  );
}

function FilaVence({ fila, hoy }: { fila: FilaVencimiento; hoy: string }) {
  // Se muestra el día que le toca pagar (pagó el 21 → «vence el 21»).
  const dias = Math.max(0, fila.diasParaPagar);
  const color = fila.diasParaPagar <= 1 ? "text-hilo" : "text-ambar";
  return (
    <li className="flex items-center gap-3 border-b border-dashed border-linea py-2 last:border-0">
      <span className={`grid size-[38px] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-current font-titulos text-[1.1rem] ${color}`} title={describirDiasRestantes(fila.diasParaPagar)}>
        {dias}
      </span>
      <span className="min-w-0 flex-1">
        <Link href={`/socios/${fila.socioId}`} className="enlace block truncate text-[0.9rem] font-medium">{fila.nombre}</Link>
        <span className={`text-[0.75rem] ${fila.diasParaPagar <= 1 ? "font-semibold text-rojo" : "text-gris"}`}>
          {describirDiasRestantes(fila.diasParaPagar)} · {formatearFecha(fila.fechaDePago)}
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
            diasParaPagar: fila.diasParaPagar,
            fechaDePago: fila.fechaDePago,
            plan: fila.planNombre,
          }}
        />
      )}
    </li>
  );
}
