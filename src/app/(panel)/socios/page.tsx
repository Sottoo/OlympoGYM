import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { FILTROS_SOCIOS, type FiltroSocios } from "@/application/use-cases/socios/ListarSocios";
import { nombreCompleto, numeroDeSocio } from "@/domain/entities/Socio";
import { Avatar } from "@/presentation/components/Avatar";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { EstadoMembresia } from "@/presentation/components/Insignia";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { Pestanas } from "@/presentation/components/Pestanas";
import { Suspense } from "react";
import { BuscadorSocios } from "./BuscadorSocios";
import { describirDiasRestantes, formatearFecha, formatearTelefono } from "@/shared/formato";

export const metadata: Metadata = { title: "Socios" };
export const dynamic = "force-dynamic";

const PESTANAS: { filtro: FiltroSocios; texto: string }[] = [
  { filtro: "activos", texto: "Activos" },
  { filtro: "vigente", texto: "Al corriente" },
  { filtro: "por_vencer", texto: "Por vencer" },
  { filtro: "vencida", texto: "Vencidos" },
  { filtro: "sin_plan", texto: "Sin plan" },
  { filtro: "bajas", texto: "En espera (bajas)" },
];

export default async function PaginaSocios({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; eliminado?: string }> }) {
  const { q = "", filtro: filtroUrl, eliminado } = await searchParams;
  const filtro: FiltroSocios = (FILTROS_SOCIOS as readonly string[]).includes(filtroUrl ?? "") ? (filtroUrl as FiltroSocios) : "activos";
  const casos = await casosDeUso();
  const [{ socios, conteos }, exporta, unePersonas] = await Promise.all([
    casos.listarSocios.ejecutar({ busqueda: q, filtro }),
    tienePermiso("exportar"),
    tienePermiso("socios.eliminar"),
  ]);
  const duplicados = unePersonas ? await casos.detectarDuplicados.ejecutar() : [];
  const verBajas = filtro === "bajas";

  const hrefFiltro = (f: FiltroSocios, conBusqueda = true) => {
    const p = new URLSearchParams();
    if (f !== "activos") p.set("filtro", f);
    if (q && conBusqueda) p.set("q", q);
    const qs = p.toString();
    return qs ? `/socios?${qs}` : "/socios";
  };

  return (
    <div className="pagina">
      <Encabezado guia="socios" icono="socios"
        titulo="Socios"
        descripcion={`${conteos.activos} activos · ${conteos.bajas} en espera (dados de baja, se pueden reactivar)`}
        acciones={
          <>
            {exporta && (
              <a href="/api/exportar/socios" className="boton-secundario" download>
                <Icono nombre="descargar" className="size-4" />
                Exportar a Excel
              </a>
            )}
            <Link href="/socios/nuevo" className="boton">
              <Icono nombre="mas" className="size-4" />
              Inscribir socio
            </Link>
          </>
        }
      />

      <MensajeExito mensaje={eliminado ? `${eliminado} se eliminó para siempre. Sus pagos se quedan en los cortes como «Socio eliminado».` : undefined} />

      {duplicados.length > 0 && (
        <section aria-label="Posibles registros dobles" className="grid gap-2 rounded-[12px] bg-ambar-tenue px-4 py-3.5 text-[0.9rem]">
          <p className="flex items-start gap-2">
            <Icono nombre="alerta" className="mt-0.5 size-[18px] shrink-0 text-ambar" />
            <span>
              <b className="font-semibold">
                {duplicados.length === 1 ? "Una persona parece registrada dos veces." : `${duplicados.length} personas parecen registradas dos veces.`}
              </b>{" "}
              Tienen exactamente el mismo nombre. Si son la misma persona, ábrela y une los registros para que su historial quede en uno solo.
            </span>
          </p>
          <ul className="flex flex-wrap gap-2 pl-6">
            {duplicados.map((g) => (
              <li key={g[0].id}>
                <Link href={`/socios/${g[0].id}?unir=1`} className="boton-secundario boton-chico">
                  {g[0].nombre} · {g.map((p) => p.numero).join(" y ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Una sola barra: filtros a la izquierda, búsqueda a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Pestanas
          etiqueta="Filtrar socios"
          opciones={PESTANAS.map((p) => ({ href: hrefFiltro(p.filtro), texto: p.texto, cuenta: conteos[p.filtro], activa: p.filtro === filtro }))}
        />

        <Suspense>
          <BuscadorSocios inicial={q} />
        </Suspense>
      </div>

      {socios.length === 0 ? (
        <Vacio accion={!q && filtro === "activos" && <Link href="/socios/nuevo" className="boton">Inscribir el primer socio</Link>}>
          {q ? `Nadie coincide con “${q}” en esta lista.` : verBajas ? "No hay socios en espera. Los que se dan de baja aparecen aquí y se pueden reactivar cuando regresen." : "No hay socios en esta lista."}
        </Vacio>
      ) : (
        <div className="superficie overflow-x-auto">
          <table className="tabla">
            <thead>
              {verBajas ? (
                <tr><th>Socio</th><th>Contacto</th><th>Fecha de baja</th><th>Motivo</th></tr>
              ) : (
                <tr><th>Socio</th><th>Celular</th><th>Plan</th><th>Estado</th><th>Vencimiento</th></tr>
              )}
            </thead>
            <tbody>
              {socios.map(({ socio, membresia, planNombre }) => (
                <tr key={socio.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {/* Las fotos locales se sirven en /api/fotos (ver AlmacenFotosLocal). */}
                      <Avatar nombre={nombreCompleto(socio)} fotoUrl={socio.foto ? `/api/fotos/${socio.foto}` : null} />
                      <span className="min-w-0">
                        <Link href={`/socios/${socio.id}`} className="enlace block">{nombreCompleto(socio)}</Link>
                        <span className="numero-socio">{numeroDeSocio(socio.numero)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-tinta-suave tabular-nums">
                    {socio.telefono ? formatearTelefono(socio.telefono) : <span className="text-gris">—</span>}
                  </td>
                  {verBajas ? (
                    <>
                      <td className="whitespace-nowrap">{socio.fechaBaja ? formatearFecha(socio.fechaBaja) : "—"}</td>
                      <td className="text-tinta-suave">{socio.motivoBaja ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <td>{planNombre ?? <span className="text-gris">—</span>}</td>
                      <td><EstadoMembresia estado={membresia.estado} activo={socio.activo} /></td>
                      <td className="whitespace-nowrap text-sm">
                        {membresia.fechaDePago && membresia.diasParaPagar !== null ? (
                          <>
                            <span className="tabular-nums">{formatearFecha(membresia.fechaDePago)}</span>
                            <span className={`block ${membresia.estado === "vencida" ? "text-rojo" : "text-gris"}`}>
                              {describirDiasRestantes(membresia.diasParaPagar)}
                            </span>
                          </>
                        ) : (
                          <span className="text-gris">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
