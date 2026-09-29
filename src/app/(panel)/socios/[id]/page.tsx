import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { describirDuracion } from "@/domain/entities/Plan";
import { nombreCompleto } from "@/domain/entities/Socio";
import { NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { BotonWhatsApp } from "@/presentation/components/BotonWhatsApp";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { EstadoMembresia } from "@/presentation/components/Insignia";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { mensajeRecordatorio } from "@/presentation/whatsapp";
import { describirDiasRestantes, formatearDinero, formatearFecha, formatearFechaLarga, formatearTelefono } from "@/shared/formato";
import { accionReactivarSocio } from "../acciones";
import { FormularioAsignarPlan } from "./FormularioAsignarPlan";
import { FormularioBaja } from "./FormularioBaja";

export const metadata: Metadata = { title: "Socio" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  nuevo: "Socio registrado. Ahora asígnale un plan.",
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
  const planes = await casos.listarPlanes.ejecutar(true);
  const { socio, membresia, planActual, suscripciones, pagos } = detalle;
  const vigente = membresia.estado === "vigente" || membresia.estado === "por_vencer";
  const totalPagado = pagos.reduce((t, p) => t + p.monto, 0);
  const nombre = nombreCompleto(socio);

  return (
    <div className="space-y-7">
      <Encabezado
        titulo={nombre}
        volver={{ href: socio.activo ? "/socios" : "/socios?filtro=bajas", texto: "Socios" }}
        etiquetas={<EstadoMembresia estado={membresia.estado} activo={socio.activo} />}
        descripcion={
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            {socio.telefono && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icono nombre="telefono" className="size-4" />
                {formatearTelefono(socio.telefono)}
              </span>
            )}
            {socio.email && (
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="correo" className="size-4" />
                {socio.email}
              </span>
            )}
          </span>
        }
        acciones={
          <>
            {socio.activo && socio.telefono && (
              <BotonWhatsApp telefono={socio.telefono} mensaje={mensajeRecordatorio(socio.nombre, membresia, entorno.nombreGimnasio)} />
            )}
            <Link href={`/socios/${socio.id}/editar`} className="boton-secundario">
              <Icono nombre="editar" className="size-4" />
              Editar
            </Link>
          </>
        }
      />

      <MensajeExito mensaje={aviso ? AVISOS[aviso] : undefined} />

      {!socio.activo && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-carbon px-5 py-4 text-white">
          <div>
            <p className="font-semibold">Dado de baja{socio.fechaBaja && ` el ${formatearFechaLarga(socio.fechaBaja)}`}</p>
            {socio.motivoBaja && <p className="text-sm text-white/65">Motivo: {socio.motivoBaja}</p>}
          </div>
          <form action={accionReactivarSocio}>
            <input type="hidden" name="socioId" value={socio.id} />
            <BotonEnviar textoEnviando="Reactivando…">Reactivar socio</BotonEnviar>
          </form>
        </section>
      )}

      <section aria-label="Membresía actual" className="superficie grid overflow-hidden sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex gap-4 p-5">
          <span
            aria-hidden
            className={`w-1 shrink-0 rounded-full ${
              { vigente: "bg-verde", por_vencer: "bg-ambar", vencida: "bg-rojo", sin_plan: "bg-linea-fuerte" }[membresia.estado]
            }`}
          />
          <div>
            <p className="rotulo mb-1.5">Membresía</p>
            {membresia.fechaFin && membresia.diasRestantes !== null ? (
              <>
                <p className="text-xl font-semibold">{describirDiasRestantes(membresia.diasRestantes)}</p>
                <p className="text-gris">
                  {planActual} · válido hasta el {formatearFechaLarga(membresia.fechaFin)}
                </p>
              </>
            ) : (
              <p className="text-xl font-semibold">Todavía no tiene un plan</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-linea sm:border-l sm:border-t-0">
          <div className="px-5 py-4">
            <dt className="rotulo">Socio desde</dt>
            <dd className="mt-1.5 font-semibold tabular-nums">{formatearFecha(socio.creadoEn.slice(0, 10))}</dd>
          </div>
          <div className="border-l border-linea px-5 py-4">
            <dt className="rotulo">Total pagado</dt>
            <dd className="mt-1.5 font-semibold tabular-nums">{formatearDinero(totalPagado)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section id="renovar" className="superficie h-fit scroll-mt-6">
          <h2 className="subtitulo border-b border-linea px-5 py-3.5">{vigente ? "Renovar membresía" : "Asignar plan"}</h2>
          <div className="p-5">
            {socio.activo ? (
              <FormularioAsignarPlan
                socioId={socio.id}
                esRenovacion={vigente}
                planPreferido={suscripciones[0]?.planId}
                planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, duracion: describirDuracion(p) }))}
              />
            ) : (
              <p className="text-gris">Reactiva al socio para poder asignarle un plan.</p>
            )}
          </div>
        </section>

        <div className="space-y-7">
          <Historial titulo="Membresías" vacio="Sin membresías todavía.">
            {suscripciones.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="font-semibold">{s.planNombre}</span>
                <span className="text-right text-sm text-gris tabular-nums">
                  {formatearFecha(s.fechaInicio)} – {formatearFecha(s.fechaFin)}
                </span>
              </li>
            ))}
          </Historial>

          <Historial titulo="Pagos" vacio="Sin pagos registrados.">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span>
                  <span className="font-semibold tabular-nums">{formatearDinero(p.monto)}</span>
                  <span className="ml-2 text-sm text-gris">
                    {METODOS_PAGO[p.metodo]}
                    {p.nota && ` · ${p.nota}`}
                  </span>
                </span>
                <span className="text-sm text-gris tabular-nums">{formatearFecha(p.fecha)}</span>
              </li>
            ))}
          </Historial>

          {socio.notas && (
            <section>
              <h2 className="subtitulo mb-3">Notas</h2>
              <p className="superficie whitespace-pre-line px-4 py-3">{socio.notas}</p>
            </section>
          )}
        </div>
      </div>

      {socio.activo && (
        <section className="flex flex-col gap-4 border-t border-linea pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <h2 className="subtitulo">Dar de baja</h2>
            <p className="text-sm text-gris">Para socios que dejan el gimnasio. No borra su historial y se puede revertir.</p>
          </div>
          <div className="sm:max-w-xl sm:flex-1 sm:text-right [&_form]:text-left">
            <FormularioBaja socioId={socio.id} nombre={socio.nombre} tieneMembresiaVigente={vigente} />
          </div>
        </section>
      )}
    </div>
  );
}

function Historial({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className="subtitulo mb-3">{titulo}</h2>
      {children.length === 0 ? (
        <p className="text-gris">{vacio}</p>
      ) : (
        <ul className="superficie divide-y divide-linea">{children}</ul>
      )}
    </section>
  );
}
