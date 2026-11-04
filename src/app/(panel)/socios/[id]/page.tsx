import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nombreDelMetodo } from "@/domain/entities/Pago";
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
import { FormularioBaja } from "./FormularioBaja";

export const metadata: Metadata = { title: "Socio" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  nuevo: "Socio inscrito: su plan quedó activo y el pago registrado.",
  "nuevo-sin-foto": "Socio inscrito con su plan activo, pero la foto no se pudo guardar. Agrégala desde Editar datos.",
  "nuevo-visita": "Socio registrado: su visita de hoy quedó cobrada y su entrada anotada.",
  "nuevo-visita-sin-foto": "Socio registrado con su visita de hoy cobrada, pero la foto no se pudo guardar. Agrégala desde Editar datos.",
  pagado: "Pago registrado y plan activado.",
  editado: "Datos actualizados.",
  baja: "El socio quedó dado de baja. Su historial se conserva.",
  reactivado: "Socio reactivado. Si regresa a entrenar, asígnale un plan.",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}

export default async function PaginaSocio({ params, searchParams }: Props) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const casos = await casosDeUso();

  const detalle = await casos.obtenerDetalleSocio.ejecutar(id).catch((e) => {
    if (e instanceof NoEncontrado) notFound();
    throw e;
  });
  const [planes, sellos, gestionaBajas, cambiaMonto, creaPlanes] = await Promise.all([
    casos.listarPlanes.ejecutar(true),
    casos.obtenerSellosDeSocio.ejecutar(id),
    tienePermiso("socios.baja"),
    tienePermiso("cobros.otroMonto"),
    tienePermiso("planes.gestionar"),
  ]);
  // La visita de 1 día se cobra en el mostrador, no aquí: no es una membresía.
  const planesDeMembresia = planes.filter((p) => !esPlanDeVisita(p)).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, duracion: describirDuracion(p) }));
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: entorno.zonaHoraria }).format(new Date());
  const { socio, fotoUrl, edad, cumpleHoy, membresia, planActual, deVisita, suscripciones, pagos } = detalle;
  // Una visita pagada hoy no es membresía: se le ofrece asignar plan, no "renovar".
  const vigente = !deVisita && (membresia.estado === "vigente" || membresia.estado === "por_vencer");
  const totalPagado = pagos.reduce((t, p) => t + p.monto, 0);
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
        </div>
      </header>

      <MensajeExito mensaje={aviso ? AVISOS[aviso] : undefined} />

      {!socio.activo && (
        <section className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-[22px]">
          <div>
            <p className="font-bold">De baja{socio.fechaBaja && ` desde el ${formatearFechaLarga(socio.fechaBaja)}`}</p>
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
            titulo={`Parches de ${nombreDelMes(sellos.mes)}`}
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

          <Panel id="renovar" className="scroll-mt-7" titulo={vigente ? "Renovar membresía" : "Asignar plan"} descripcion={vigente ? "Registra el pago y extiende su vigencia." : "Elige el plan y registra el pago."}>
            {socio.activo ? (
              <FormularioAsignarPlan
                // Si cambia la lista de planes, el formulario empieza de nuevo con ella.
                key={planesDeMembresia.map((p) => p.id).join()}
                socioId={socio.id}
                esRenovacion={vigente}
                planPreferido={suscripciones.find((s) => !s.esVisita)?.planId}
                puedeCambiarMonto={cambiaMonto}
                creaPlanes={creaPlanes}
                planes={planesDeMembresia}
              />
            ) : (
              <p className="text-gris">Para asignarle un plan primero hay que reactivarlo{gestionaBajas ? "" : " (lo hace la administración)"}.</p>
            )}
          </Panel>
        </div>

        <aside className="bloques">
          <Historial titulo="Pagos" vacio="Sin pagos registrados.">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-dashed border-linea py-2.5 last:border-0">
                <span className="text-[0.9rem] font-medium">
                  {formatearFecha(p.fecha)}
                  <span className="block text-[0.76rem] font-normal text-gris">
                    {nombreDelMetodo(p.metodo)}
                    {p.nota && ` · ${p.nota}`}
                  </span>
                </span>
                <span className="cifra text-[1.25rem]">{formatearDinero(p.monto)}</span>
              </li>
            ))}
          </Historial>

          <Historial titulo="Membresías" vacio="Sin membresías todavía.">
            {suscripciones.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 border-b border-dashed border-linea py-2.5 text-[0.9rem] last:border-0">
                <span className="font-semibold">{x.planNombre}</span>
                <span className="text-right text-[0.78rem] text-gris tabular-nums">
                  {formatearFecha(x.fechaInicio)} – {formatearFecha(x.fechaFin)}
                </span>
              </li>
            ))}
          </Historial>

          {socio.notas && (
            <Panel titulo="Notas">
              <p className="whitespace-pre-line text-[0.92rem]">{socio.notas}</p>
            </Panel>
          )}

          {socio.activo && gestionaBajas && (
            <Panel titulo="Dar de baja" descripcion="No borra su historial y se puede revertir.">
              <FormularioBaja socioId={socio.id} nombre={socio.nombre} tieneMembresiaVigente={vigente} />
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

function Historial({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode[] }) {
  return (
    <Panel titulo={titulo}>
      {children.length === 0 ? <p className="text-[0.88rem] text-gris">{vacio}</p> : <ul>{children}</ul>}
    </Panel>
  );
}
