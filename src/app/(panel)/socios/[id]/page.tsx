import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nombreDelMetodo, type Pago } from "@/domain/entities/Pago";
import type { Suscripcion } from "@/domain/entities/Suscripcion";
import { describirDuracion, esPlanDeVisita } from "@/domain/entities/Plan";
import { nombreCompleto } from "@/domain/entities/Socio";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { BotonWhatsApp } from "@/presentation/components/BotonWhatsApp";
import { Liston } from "@/presentation/components/Liston";
import { Parche } from "@/presentation/components/Parche";
import { Icono, type NombreIcono } from "@/presentation/components/Icono";
import { Panel } from "@/presentation/components/Panel";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { Pasaporte } from "@/presentation/components/Pasaporte";
import { EtiquetaCifra } from "@/presentation/components/Marcador";
import { describirDiasRestantes, fechaLocal, horaLocal, formatearDinero, formatearFecha, formatearFechaLarga, formatearTelefono, plural } from "@/shared/formato";
import { accionReactivarSocio } from "../acciones";
import { FormularioAsignarPlan } from "./FormularioAsignarPlan";
import { BotonCancelarMembresia } from "./BotonCancelarMembresia";
import { AccionesDelSocio } from "./AccionesDelSocio";
import { Guia } from "@/presentation/components/Guia";
import { RegistroDeHuella } from "./RegistroDeHuella";

export const metadata: Metadata = { title: "Socio" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  nuevo: "Socio inscrito: su plan quedó activo y el pago registrado.",
  "nuevo-sin-foto": "Socio inscrito con su plan activo, pero la foto no se pudo guardar. Agrégala desde Editar datos.",
  "nuevo-visita": "Socio registrado: su visita de hoy quedó cobrada y su entrada anotada.",
  "nuevo-visita-sin-foto": "Socio registrado con su visita de hoy cobrada, pero la foto no se pudo guardar. Agrégala desde Editar datos.",
  pagado: "Pago registrado y plan activado.",
  editado: "Datos actualizados.",
  baja: "Listo: quedó en espera (dado de baja).",
  reactivado: "Socio reactivado. Si regresa a entrenar, asígnale un plan.",
  corregido: "Membresía corregida: el plan, el vencimiento y el pago quedaron con los datos correctos.",
  unido: "Registros unidos: todo el historial quedó en este socio y el registro repetido se borró.",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; de?: string; unir?: string }>;
}

export default async function PaginaSocio({ params, searchParams }: Props) {
  const [{ id }, { aviso, de, unir: abrirUnir }] = await Promise.all([params, searchParams]);
  const casos = await casosDeUso();

  const detalle = await casos.obtenerDetalleSocio.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });
  const [planes, sellos, huellas, gestionaBajas, cambiaMonto, creaPlanes, corrigeCobros, eliminaSocios] = await Promise.all([
    casos.listarPlanes.ejecutar(true),
    casos.obtenerSellosDeSocio.ejecutar(id),
    casos.listarHuellasDeSocio.ejecutar(id),
    tienePermiso("socios.baja"),
    tienePermiso("cobros.otroMonto"),
    tienePermiso("planes.gestionar"),
    tienePermiso("cobros.corregir"),
    tienePermiso("socios.eliminar"),
  ]);
  // Otros registros con el mismo nombre: posibles inscripciones dobles para unir.
  const repetidos = ((await casos.detectarDuplicados.ejecutar()).find((g) => g.some((p) => p.id === id)) ?? []).filter((p) => p.id !== id);
  // La visita de 1 día se cobra en el mostrador, no aquí: no es una membresía.
  const planesDeMembresia = planes.filter((p) => !esPlanDeVisita(p)).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, duracion: describirDuracion(p) }));
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date());
  const { socio, fotoUrl, edad, cumpleHoy, membresia, planActual, deVisita, suscripciones, pagos } = detalle;
  // Una visita pagada hoy no es membresía: se le ofrece asignar plan, no "renovar".
  const vigente = !deVisita && (membresia.estado === "vigente" || membresia.estado === "por_vencer");
  const totalPagado = pagos.reduce((t, p) => t + p.monto, 0);
  // La membresía que se puede corregir: la más reciente (sin contar visitas), con su pago.
  const ultimaMembresia = suscripciones.find((s) => !s.esVisita);
  const corregible = ultimaMembresia;
  const pagoCorregible = corregible ? pagos.find((p) => p.suscripcionId === corregible.id) : undefined;
  // Una membresía a la vez: mientras la que tiene (o la siguiente que ya pagó) no llegue a su último día, no se cobra otra.
  const pagadaHasta = ultimaMembresia && ultimaMembresia.fechaFin > hoy ? ultimaMembresia : undefined;
  // Cobrada por error: la más reciente se puede cancelar si se registró hoy o aún no empieza (misma regla que CancelarMembresia).
  const cancelable =
    corregible && corrigeCobros && socio.activo && (corregible.fechaInicio >= hoy || fechaLocal(corregible.creadoEn, entorno.zonaHoraria) === hoy)
      ? corregible.id
      : undefined;
  const nombre = nombreCompleto(socio);
  const estado: { texto: string; clase: string } = !socio.activo
    ? { texto: "De baja", clase: "bg-gris!" }
    : deVisita
      ? { texto: "Visita de hoy", clase: "bg-tinta-suave!" }
      : membresia.estado === "vencida"
      ? { texto: "Membresía vencida", clase: "bg-rojo!" }
      : membresia.estado === "sin_plan"
        ? { texto: "Sin plan", clase: "bg-tinta-suave!" }
        : membresia.estado === "por_vencer"
          ? { texto: "Por vencer", clase: "bg-ambar!" }
          : { texto: "Al corriente", clase: "" };

  return (
    <div className="pagina">
      <Link
        href={socio.activo ? "/socios" : "/socios?filtro=bajas"}
        className="-mb-3 inline-flex w-fit items-center gap-1 text-[0.84rem] font-bold text-gris hover:text-tinta"
      >
        <Icono nombre="atras" className="size-4" /> Socios
      </Link>

      {/* Aviso arriba de todo: si parece inscrito dos veces, se resuelve antes de cobrarle o anotarle entradas. */}
      {repetidos.length > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.9rem]">
          <Icono nombre="alerta" className="size-[18px] text-ambar" />
          <span className="flex-1">
            <b className="font-semibold">Parece registrado dos veces:</b> también existe {repetidos.map((r) => `${r.nombre} (${r.numero})`).join(", ")}.
            {!eliminaSocios && " Avísale a la administración para que los una."}
          </span>
          {eliminaSocios && (
            <a href="#unir" className="boton-secundario boton-chico">
              Unir registros
            </a>
          )}
        </p>
      )}

      <header className="panel grid items-center gap-x-8 gap-y-5 px-7 py-6 md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* El listón cuelga de la orilla del parche: no tapa la leyenda ni cambia la altura de la ficha. */}
        <div className="relative size-[150px] justify-self-center">
          <Parche
            className="parche-entra"
            tamano={150}
            gimnasio={entorno.nombreGimnasio}
            iniciales={`${socio.nombre[0]}${socio.apellidos[0]}`.toUpperCase()}
            numero={socio.numero}
            desde={fechaLocal(socio.creadoEn, entorno.zonaHoraria).slice(0, 4)}
            fotoUrl={fotoUrl}
            apagado={!socio.activo}
          />
          {cumpleHoy && (
            <div className="absolute top-[128px] left-1/2 -translate-x-1/2">
              <Liston texto="Feliz cumpleaños" ancho={168} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="rotulo">
              Socio <span className="text-hilo">Nº {String(socio.numero).padStart(2, "0")}</span>
            </p>
            <span className={`tejida ${estado.clase}`}>{estado.texto}</span>
          </div>
          <h1 className="titulo mt-2">{nombre}</h1>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.88rem] text-tinta-suave">
            <Dato icono="hoy">Desde {formatearFecha(fechaLocal(socio.creadoEn, entorno.zonaHoraria))}</Dato>
            {socio.telefono && (
              <Dato icono="telefono">
                <span className="tabular-nums">{formatearTelefono(socio.telefono)}</span>
              </Dato>
            )}
            {/* El cumpleaños va en el mismo dato que la edad: una sola línea, sin repetir el listón. */}
            {edad !== null &&
              (cumpleHoy ? (
                <Dato icono="trofeo" hilo>
                  Cumple {edad} años hoy
                </Dato>
              ) : (
                <Dato icono="usuario">{edad} años</Dato>
              ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 md:col-start-2 xl:col-start-auto xl:grid xl:justify-items-stretch">
          <Link href={`/socios/${socio.id}/editar`} className="boton-secundario">
            <Icono nombre="editar" className="size-4" />
            Editar datos
          </Link>
          {socio.activo && socio.telefono && !deVisita && (
            <BotonWhatsApp
              telefono={socio.telefono}
              contexto={{
                socioId: socio.id,
                nombre: socio.nombre.split(" ")[0],
                nombreCompleto: nombre,
                gimnasio: entorno.nombreGimnasio,
                hoy,
                hora: horaLocal(entorno.zonaHoraria),
                situacion: membresia.estado,
                diasRestantes: membresia.diasRestantes,
                fechaFin: membresia.fechaFin,
                plan: planActual,
                visitasDelMes: sellos.dias.length,
                racha: sellos.racha,
                desdeAnio: Number(fechaLocal(socio.creadoEn, entorno.zonaHoraria).slice(0, 4)),
                cumpleHoy,
              }}
            />
          )}
          <AccionesDelSocio
            socioId={socio.id}
            nombre={nombre}
            corregir={
              corregible && pagoCorregible && corrigeCobros && socio.activo
                ? {
                    suscripcionId: corregible.id,
                    planes: [
                      ...planesDeMembresia,
                      // Si su plan ya se desactivó, se queda como opción para no cambiarlo sin querer.
                      ...(planesDeMembresia.some((p) => p.id === corregible.planId)
                        ? []
                        : [{ id: corregible.planId, nombre: corregible.planNombre, precio: pagoCorregible.monto, duracion: "desactivado" }]),
                    ],
                    planActual: corregible.planId,
                    montoActual: pagoCorregible.monto,
                    metodoActual: pagoCorregible.metodo,
                    inicio: formatearFecha(corregible.fechaInicio),
                  }
                : null
            }
            baja={socio.activo && gestionaBajas ? { tieneMembresiaVigente: vigente } : null}
            abrirUnir={abrirUnir === "1"}
            unir={repetidos.length > 0 && eliminaSocios ? { sugeridos: repetidos.map((r) => ({ id: r.id, texto: `${r.nombre} · ${r.numero}${r.activo ? "" : " · en espera"}` })) } : null}
            eliminar={eliminaSocios ? { tienePagos: pagos.length > 0 } : null}
          />
        </div>
      </header>

      <Guia clave="socio" />

      <MensajeExito mensaje={aviso ? (aviso === "unido" && de ? `${AVISOS.unido.replace("el registro repetido", `el registro repetido (${de})`)}` : AVISOS[aviso]) : undefined} />
      {!socio.activo && (
        <section className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-[22px]">
          <div>
            <p className="font-bold">En espera (dado de baja){socio.fechaBaja && ` desde el ${formatearFechaLarga(socio.fechaBaja)}`}</p>
            {socio.motivoBaja && <p className="text-sm text-gris">Motivo: {socio.motivoBaja}</p>}
          </div>
          {gestionaBajas ? (
            <form action={accionReactivarSocio}>
              <input type="hidden" name="socioId" value={socio.id} />
              <BotonEnviar textoEnviando="Reactivando…">Reactivar socio</BotonEnviar>
            </form>
          ) : (
            <p className="text-[0.84rem] text-gris">Solo la administración puede reactivarlo.</p>
          )}
        </section>
      )}

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <EtiquetaCifra
          compacta
          cifra={{ etiqueta: "Plan", icono: "credencial", destacada: true, valor: planActual ?? "Sin plan", detalle: planActual ? "Membresía actual" : "Asígnale uno para que pueda entrar" }}
        />
        <EtiquetaCifra
          compacta
          cifra={{
            etiqueta: membresia.estado === "vencida" ? "Venció" : "Vence",
            icono: "reloj",
            valor: membresia.fechaFin ? formatearFecha(membresia.fechaFin) : "—",
            detalle: membresia.fechaFin && membresia.diasRestantes !== null ? describirDiasRestantes(membresia.diasRestantes) : "Sin membresía",
            alerta: membresia.estado === "vencida",
          }}
        />
        <EtiquetaCifra
          compacta
          cifra={{
            etiqueta: "Racha",
            icono: "fuego",
            valor: sellos.racha > 0 ? `${sellos.racha} ${sellos.racha === 1 ? "día" : "días"}` : "—",
            detalle: sellos.racha > 1 ? "Seguidos viniendo" : `${plural(sellos.dias.length, "visita")} este mes`,
          }}
        />
        <EtiquetaCifra
          compacta
          cifra={{ etiqueta: "Total pagado", icono: "ventas", valor: formatearDinero(totalPagado), detalle: pagos.length === 1 ? "En 1 pago" : `En ${pagos.length} pagos` }}
        />
      </dl>

      <div className="con-lateral">
        <div className="bloques">
          <Panel
            titulo={`Entrenamientos de ${nombreDelMes(sellos.mes)}`}
            accion={
              <p className="text-[0.88rem] text-tinta-suave">
                {sellos.racha > 1 && (
                  <>
                    <b className="font-titulos text-[1.5rem] font-normal text-tinta">{sellos.racha}</b> días seguidos ·{" "}
                  </>
                )}
                {plural(sellos.dias.length, "visita")}
              </p>
            }
          >
            <Pasaporte mes={sellos.mes} dias={sellos.dias} hoy={hoy} />
          </Panel>

          <Panel id="renovar" className="scroll-mt-7" titulo={vigente ? "Renovar membresía" : "Asignar plan"}>
            {socio.activo && pagadaHasta ? (
              <p className="text-[0.92rem] text-tinta-suave">
                {pagadaHasta.fechaInicio > hoy
                  ? `Ya tiene pagada su siguiente membresía (${pagadaHasta.planNombre}, del ${formatearFecha(pagadaHasta.fechaInicio)} al ${formatearFecha(pagadaHasta.fechaFin)}).`
                  : `Tiene su membresía pagada hasta el ${formatearFecha(pagadaHasta.fechaFin)}.`}{" "}
                Se podrá renovar a partir del <b className="font-semibold text-tinta">{formatearFecha(pagadaHasta.fechaFin)}</b>, su último día.
              </p>
            ) : socio.activo ? (
              <FormularioAsignarPlan
                // Si cambia la lista de planes, el formulario empieza de nuevo con ella.
                key={planesDeMembresia.map((p) => p.id).join()}
                socioId={socio.id}
                esRenovacion={vigente}
                planPreferido={suscripciones.find((s) => !s.esVisita)?.planId}
                puedeCambiarMonto={cambiaMonto}
                puedeCambiarFecha={corrigeCobros}
                creaPlanes={creaPlanes}
                visitaHoy={deVisita}
                planes={planesDeMembresia}
              />
            ) : (
              <p className="text-gris">Para asignarle un plan primero hay que reactivarlo{gestionaBajas ? "" : " (lo hace la administración)"}.</p>
            )}
          </Panel>
        </div>

        <aside className="bloques">
          <Panel id="huella" className="scroll-mt-7" titulo="Huella">
            <RegistroDeHuella
              socioId={socio.id}
              nombre={socio.nombre.split(" ")[0]}
              activo={socio.activo}
              huellas={huellas.map((h) => ({ id: h.id, dedo: h.dedo, fecha: formatearFecha(fechaLocal(h.registradaEn, entorno.zonaHoraria)) }))}
            />
          </Panel>

          <HistorialDeCobros socioId={socio.id} suscripciones={suscripciones} pagos={pagos} hoy={hoy} cancelable={cancelable} />

          {socio.notas && (
            <Panel titulo="Notas">
              <p className="whitespace-pre-line text-[0.92rem]">{socio.notas}</p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function Dato({ icono, hilo = false, children }: { icono: NombreIcono; hilo?: boolean; children: React.ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-1.5 whitespace-nowrap ${hilo ? "font-bold text-hilo" : ""}`}>
      <Icono nombre={icono} className={`size-4 ${hilo ? "" : "opacity-70"}`} />
      {children}
    </li>
  );
}

function nombreDelMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
}

/** Cuántos renglones del historial se ven sin desplegar. */
const RENGLONES_VISIBLES = 4;

/**
 * Membresías y pagos en una sola lista: cada renglón es lo que se le vendió
 * (plan y periodo) con lo que pagó por eso. Los pagos sueltos (sin
 * membresía) van como su propio renglón. De lo más reciente a lo más antiguo.
 */
function HistorialDeCobros({
  socioId,
  suscripciones,
  pagos,
  hoy,
  cancelable,
}: {
  socioId: string;
  suscripciones: Suscripcion[];
  pagos: Pago[];
  hoy: string;
  /** La membresía que se puede cancelar por cobrarse por error, si la hay. */
  cancelable?: string;
}) {
  const renglones = [
    ...suscripciones.map((s) => ({ id: s.id, fecha: s.fechaInicio, suscripcion: s, pagos: pagos.filter((p) => p.suscripcionId === s.id) })),
    ...pagos
      .filter((p) => !p.suscripcionId || !suscripciones.some((s) => s.id === p.suscripcionId))
      .map((p) => ({ id: p.id, fecha: p.fecha, suscripcion: null, pagos: [p] })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const renglon = ({ id, suscripcion: s, pagos: ps }: (typeof renglones)[number]) => {
    const monto = ps.reduce((t, p) => t + p.monto, 0);
    const cobro = ps[0];
    const estado = s && !s.esVisita ? (s.fechaInicio > hoy ? "Próxima" : s.fechaFin >= hoy ? "Vigente" : null) : null;
    const periodo = !s ? "" : s.esVisita || s.fechaInicio === s.fechaFin ? formatearFecha(s.fechaInicio) : `${formatearFecha(s.fechaInicio)} – ${formatearFecha(s.fechaFin)}`;
    return (
      <li key={id} className="flex items-start justify-between gap-3 border-b border-dashed border-linea py-2.5 last:border-0">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 text-[0.9rem] font-semibold">
            {s ? s.planNombre : "Pago"}
            {estado && (
              <span className={`text-[0.66rem] font-bold tracking-[0.1em] uppercase ${estado === "Vigente" ? "text-verde" : "text-gris"}`}>{estado}</span>
            )}
          </span>
          <span className="block text-[0.76rem] text-gris tabular-nums">
            {s ? periodo : formatearFecha(cobro.fecha)}
            {/* Si se cobró otro día (renovó antes, o se anotó tarde), se dice cuándo. */}
            {s && cobro && cobro.fecha !== s.fechaInicio && ` · cobrado el ${formatearFecha(cobro.fecha)}`}
            {cobro?.nota && ` · ${cobro.nota}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="cifra block text-[1.2rem] leading-tight">{cobro ? formatearDinero(monto) : "—"}</span>
          <span className="block text-[0.72rem] text-gris">{cobro ? nombreDelMetodo(cobro.metodo) : "Sin pago"}</span>
          {s && s.id === cancelable && (
            <BotonCancelarMembresia
              socioId={socioId}
              suscripcionId={s.id}
              plan={s.planNombre}
              periodo={periodo}
              importe={cobro ? formatearDinero(monto) : null}
              cobradoEl={cobro ? formatearFecha(cobro.fecha) : null}
            />
          )}
        </span>
      </li>
    );
  };

  const resto = renglones.slice(RENGLONES_VISIBLES);
  return (
    <Panel titulo="Membresías y pagos">
      {renglones.length === 0 ? (
        <p className="text-[0.88rem] text-gris">Todavía no tiene membresías ni pagos.</p>
      ) : (
        <>
          <ul>{renglones.slice(0, RENGLONES_VISIBLES).map(renglon)}</ul>
          {resto.length > 0 && (
            <details className="group/mas">
              <summary className="mt-2 w-fit cursor-pointer list-none text-[0.8rem] font-bold text-tinta-suave hover:text-tinta [&::-webkit-details-marker]:hidden">
                <span className="group-open/mas:hidden">Ver {plural(resto.length, "anterior", "anteriores")}</span>
                <span className="hidden group-open/mas:inline">Ver menos</span>
              </summary>
              <ul className="border-t border-dashed border-linea">{resto.map(renglon)}</ul>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
