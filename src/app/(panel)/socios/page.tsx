import type { Metadata } from "next";
import Link from "next/link";
import { FILTROS_SOCIOS, type FiltroSocios } from "@/application/use-cases/socios/ListarSocios";
import { nombreCompleto } from "@/domain/entities/Socio";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Icono } from "@/presentation/components/Icono";
import { EstadoMembresia } from "@/presentation/components/Insignia";
import { Vacio } from "@/presentation/components/Mensajes";
import { Pestanas } from "@/presentation/components/Pestanas";
import { describirDiasRestantes, formatearFecha, formatearTelefono } from "@/shared/formato";

export const metadata: Metadata = { title: "Socios" };
export const dynamic = "force-dynamic";

const PESTANAS: { filtro: FiltroSocios; texto: string }[] = [
  { filtro: "activos", texto: "Activos" },
  { filtro: "vigente", texto: "Al corriente" },
  { filtro: "por_vencer", texto: "Por vencer" },
  { filtro: "vencida", texto: "Vencidos" },
  { filtro: "sin_plan", texto: "Sin plan" },
  { filtro: "bajas", texto: "Bajas" },
];

export default async function PaginaSocios({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const { q = "", filtro: filtroUrl } = await searchParams;
  const filtro: FiltroSocios = (FILTROS_SOCIOS as readonly string[]).includes(filtroUrl ?? "") ? (filtroUrl as FiltroSocios) : "activos";
  const { socios, conteos } = await (await casosDeUso()).listarSocios.ejecutar({ busqueda: q, filtro });
  const verBajas = filtro === "bajas";

  const hrefFiltro = (f: FiltroSocios, conBusqueda = true) => {
    const p = new URLSearchParams();
    if (f !== "activos") p.set("filtro", f);
    if (q && conBusqueda) p.set("q", q);
    const qs = p.toString();
    return qs ? `/socios?${qs}` : "/socios";
  };

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Socios"
        descripcion={`${conteos.activos} activos · ${conteos.bajas} dados de baja`}
        acciones={
          <>
            <a href="/api/exportar/socios" className="boton-secundario" download>
              <Icono nombre="descargar" className="size-4" />
              Exportar a Excel
            </a>
            <Link href="/socios/nuevo" className="boton">
              <Icono nombre="mas" className="size-4" />
              Registrar socio
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        <Pestanas
          etiqueta="Filtrar socios"
          opciones={PESTANAS.map((p) => ({ href: hrefFiltro(p.filtro), texto: p.texto, cuenta: conteos[p.filtro], activa: p.filtro === filtro }))}
        />

        <form role="search" className="flex max-w-md gap-2">
          {filtro !== "activos" && <input type="hidden" name="filtro" value={filtro} />}
          <label htmlFor="q" className="sr-only">Buscar socio</label>
          <div className="relative flex-1">
            <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gris" />
            <input id="q" name="q" defaultValue={q} placeholder="Nombre o celular" className="campo pl-8" />
          </div>
          <button className="boton-secundario">Buscar</button>
          {q && <Link href={hrefFiltro(filtro, false)} className="boton-secundario">Limpiar</Link>}
        </form>
      </div>

      {socios.length === 0 ? (
        <Vacio accion={!q && filtro === "activos" && <Link href="/socios/nuevo" className="boton">Registrar el primer socio</Link>}>
          {q ? `Nadie coincide con “${q}” en esta lista.` : verBajas ? "No hay socios dados de baja." : "No hay socios en esta lista."}
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
                    <Link href={`/socios/${socio.id}`} className="enlace">{nombreCompleto(socio)}</Link>
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
                        {membresia.fechaFin && membresia.diasRestantes !== null ? (
                          <>
                            <span className="tabular-nums">{formatearFecha(membresia.fechaFin)}</span>
                            <span className={`block ${membresia.estado === "vencida" ? "text-rojo" : "text-gris"}`}>
                              {describirDiasRestantes(membresia.diasRestantes)}
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
