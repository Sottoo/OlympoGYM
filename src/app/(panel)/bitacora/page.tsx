import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import Link from "next/link";
import { type EventoBitacora, PERIODOS_BITACORA } from "@/application/use-cases/bitacora/ConsultarBitacora";
import { TABLAS_BITACORA } from "@/domain/entities/RegistroBitacora";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { Pestanas } from "@/presentation/components/Pestanas";
import { formatearHora } from "@/shared/formato";

export const metadata: Metadata = { title: "Bitácora" };
export const dynamic = "force-dynamic";

const OPERACION = { alta: "Alta", cambio: "Cambio", eliminacion: "Eliminación" } as const;

interface Props {
  searchParams: Promise<{ area?: string; periodo?: string; pagina?: string }>;
}

export default async function PaginaBitacora({ searchParams }: Props) {
  await exigirPermiso("bitacora.ver");
  const { area, periodo, pagina } = await searchParams;
  const r = await (await casosDeUso()).consultarBitacora.ejecutar({ area, periodo, pagina: Number(pagina) || 1 });

  const url = (cambios: { area?: string | null; periodo?: string; pagina?: number }) => {
    const p = new URLSearchParams();
    const a = cambios.area === undefined ? r.tabla : cambios.area;
    const per = cambios.periodo ?? r.periodo;
    if (a) p.set("area", a);
    if (per !== "7") p.set("periodo", per);
    if (cambios.pagina && cambios.pagina > 1) p.set("pagina", String(cambios.pagina));
    const qs = p.toString();
    return qs ? `/bitacora?${qs}` : "/bitacora";
  };

  const porDia = new Map<string, EventoBitacora[]>();
  for (const e of r.eventos) {
    const dia = diaLocal(e.ocurridoEn);
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }

  return (
    <div className="pagina">
      <Encabezado icono="bitacora"
        titulo="Bitácora"
        descripcion="Cada cambio, quién lo hizo y cuándo. No se puede editar ni borrar."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pestanas
          etiqueta="Filtrar por área"
          opciones={[
            { href: url({ area: null, pagina: 1 }), texto: "Todo", activa: !r.tabla },
            ...Object.entries(TABLAS_BITACORA)
              .filter(([clave]) => !["suscripciones", "productos", "equipos", "abonos_mantenimiento", "reportes_falla"].includes(clave))
              .map(([clave, texto]) => ({ href: url({ area: clave, pagina: 1 }), texto, activa: r.tabla === clave })),
          ]}
        />
        <Pestanas
          etiqueta="Periodo"
          opciones={Object.entries(PERIODOS_BITACORA).map(([clave, texto]) => ({
            href: url({ periodo: clave, pagina: 1 }),
            texto,
            activa: r.periodo === clave,
          }))}
        />
      </div>

      {r.eventos.length === 0 ? (
        <Vacio>No hay cambios registrados en este periodo.</Vacio>
      ) : (
        <div className="bloques">
          {[...porDia].map(([dia, eventos]) => (
            <section key={dia} aria-label={dia} className="grid gap-2.5">
              <h2 className="rotulo">{dia}</h2>
              <ol className="superficie divide-y divide-linea">
                {eventos.map((e) => (
                  <li key={e.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_11rem_9rem] sm:items-baseline">
                    <span className="text-[0.9rem] font-medium tabular-nums">{formatearHora(e.ocurridoEn, entorno.zonaHoraria)}</span>
                    <span className="min-w-0">
                      <span className="block text-[0.93rem]">{e.descripcion}</span>
                      {e.campos.length > 0 && <span className="block text-[0.82rem] text-gris">Cambió: {e.campos.join(", ")}</span>}
                    </span>
                    <span className="col-start-2 text-[0.84rem] text-gris sm:col-start-auto">
                      {e.area} · {OPERACION[e.operacion]}
                    </span>
                    <span className="col-start-2 truncate text-[0.84rem] text-gris sm:col-start-auto sm:text-right">{e.usuario}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {(r.hayMas || r.pagina > 1) && (
        <nav aria-label="Páginas" className="flex gap-2">
          {r.pagina > 1 && <Link href={url({ pagina: r.pagina - 1 })} className="boton-secundario">Más recientes</Link>}
          {r.hayMas && <Link href={url({ pagina: r.pagina + 1 })} className="boton-secundario">Más antiguos</Link>}
        </nav>
      )}
    </div>
  );
}

/** "martes 29 de septiembre" en la zona del gimnasio. */
function diaLocal(instante: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: entorno.zonaHoraria, weekday: "long", day: "numeric", month: "long" }).format(new Date(instante));
}
