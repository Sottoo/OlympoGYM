import { Panel } from "@/presentation/components/Panel";
import { SaltoDeDia } from "./SaltoDeDia";
import type { Metadata } from "next";
import Link from "next/link";
import { numeroDeSocio } from "@/domain/entities/Socio";
import { esFechaValida, sumarDias } from "@/domain/shared/fechas";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { EntradasPorHora } from "@/presentation/components/graficas/EntradasPorHora";
import { Icono } from "@/presentation/components/Icono";
import { Insignia } from "@/presentation/components/Insignia";
import { compararCon, Marcador } from "@/presentation/components/Marcador";
import { Vacio } from "@/presentation/components/Mensajes";
import { diaDeLaSemana, fechaLocal, formatearFechaLarga, formatearHora } from "@/shared/formato";

export const metadata: Metadata = { title: "Entradas" };
export const dynamic = "force-dynamic";

export default async function PaginaAsistencias({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia: diaUrl } = await searchParams;
  const casos = await casosDeUso();
  const hoy = await casos.obtenerEntradasDeHoy.ejecutar();
  const hoyFecha = hoy.fecha;
  const dia = diaUrl && esFechaValida(diaUrl) && diaUrl <= hoyFecha ? diaUrl : hoyFecha;
  const esHoy = dia === hoyFecha;
  const [datos, semana, semanaPasada, resumen] = await Promise.all([
    esHoy ? hoy : casos.listarEntradas.ejecutar(dia),
    // Los 7 días que terminan en el día elegido, para las barritas.
    casos.listarEntradas.ejecutar(sumarDias(dia, -6), dia),
    esHoy ? null : casos.listarEntradas.ejecutar(sumarDias(dia, -7)),
    casos.obtenerResumen.ejecutar(),
  ]);

  const horaPico = datos.porHora.reduce((a, n, h) => (n > datos.porHora[a] ? h : a), 0);
  // Comparación justa: hoy contra el mismo día de la semana pasada hasta esta hora; otro día, contra el día completo.
  const antes = esHoy ? hoy.semanaPasadaALaMismaHora : (semanaPasada?.entradas.length ?? 0);
  const dias7 = Array.from({ length: 7 }, (_, i) => sumarDias(dia, i - 6));
  const porDia = new Map<string, number>();
  for (const e of semana.entradas) {
    const f = fechaLocal(e.registradaEn, entorno.zonaHoraria);
    porDia.set(f, (porDia.get(f) ?? 0) + 1);
  }
  const ultima = datos.entradas[0];

  return (
    <div className="pagina">
      <Encabezado guia="entradas" icono="entradas"
        titulo="Entradas"
        descripcion="Quién entró cada día y a qué hora."
        acciones={
          <Link href="/panel" className="boton">
            Registrar entrada <kbd>F2</kbd>
          </Link>
        }
      />

      <nav aria-label="Elegir día" className="-mt-1 flex flex-wrap items-center gap-2">
        <Link href={`/asistencias?dia=${sumarDias(dia, -1)}`} className="boton-secundario boton-chico" aria-label="Día anterior">
          <Icono nombre="atras" className="size-4" />
        </Link>
        <p className="min-w-60 px-2 text-[1.05rem] font-medium first-letter:uppercase">
          {esHoy ? "Hoy · " : ""}
          {diaDeLaSemana(dia)} {formatearFechaLarga(dia)}
        </p>
        {!esHoy && (
          <>
            <Link href={`/asistencias?dia=${sumarDias(dia, 1)}`} className="boton-secundario boton-chico" aria-label="Día siguiente">
              <Icono nombre="adelante" className="size-4" />
            </Link>
            <Link href="/asistencias" className="boton-secundario boton-chico">Ir a hoy</Link>
          </>
        )}
        <SaltoDeDia dia={dia} hoy={hoyFecha} />
      </nav>

      <Marcador
        cifras={[
          {
            etiqueta: "Entradas", icono: "entradas", valor: datos.entradas.length,
            comparacion: compararCon(datos.entradas.length, antes, { contra: `vs. el ${diaDeLaSemana(dia)} pasado` }),
            barras: { valores: dias7.map((f) => porDia.get(f) ?? 0), resaltar: 6, titulo: "Entradas de los últimos 7 días" },
            detalle: `El ${diaDeLaSemana(dia)} pasado${esHoy ? " a esta hora" : ""}: ${antes} · junto, los últimos 7 días`,
          },
          {
            etiqueta: "Socios distintos", icono: "socios", valor: datos.sociosDistintos,
            avance: { valor: datos.sociosDistintos, total: Math.max(resumen.vigentes, datos.sociosDistintos), tono: "verde" },
            detalle: resumen.vigentes > 0
              ? `${Math.round((datos.sociosDistintos / Math.max(resumen.vigentes, datos.sociosDistintos)) * 100)} % de ${resumen.vigentes === 1 ? "la membresía vigente" : `las ${resumen.vigentes} membresías vigentes`}`
              : "Sin contar si alguien volvió",
          },
          {
            etiqueta: "Hora pico", icono: "fuego",
            valor: datos.entradas.length ? `${horaPico}:00` : "—",
            barras: datos.entradas.length ? { valores: datos.porHora.slice(6, 23), resaltar: horaPico - 6, titulo: "Entradas por hora, de 6:00 a 22:00" } : undefined,
            detalle: datos.entradas.length
              ? `${datos.porHora[horaPico]} ${datos.porHora[horaPico] === 1 ? "entrada" : "entradas"} en esa hora`
              : "Todavía sin entradas",
          },
          {
            etiqueta: "Primera entrada", icono: "reloj",
            valor: datos.entradas.length ? formatearHora(datos.entradas[datos.entradas.length - 1].registradaEn, entorno.zonaHoraria) : "—",
            detalle: datos.entradas.length
              ? `${datos.entradas[datos.entradas.length - 1].nombre}${ultima && datos.entradas.length > 1 ? ` · la última a las ${formatearHora(ultima.registradaEn, entorno.zonaHoraria)}` : ""}`
              : "Todavía sin entradas",
          },
        ]}
      />

      {datos.entradas.length === 0 ? (
        <Vacio>{esHoy ? "Todavía no hay entradas hoy." : "No se registraron entradas ese día."}</Vacio>
      ) : (
        <div className="bloques">
          <Panel titulo="Entradas por hora">
            <EntradasPorHora porHora={datos.porHora} horaActual={esHoy ? hoy.horaActual : 24} />
          </Panel>
          <section aria-label="Entradas del día" className="superficie min-w-0 overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Número</th>
                  <th>Socio</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {datos.entradas.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium tabular-nums">{formatearHora(e.registradaEn, entorno.zonaHoraria)}</td>
                    <td className="text-[0.86rem] text-gris tabular-nums">{numeroDeSocio(e.numero)}</td>
                    <td>
                      <Link href={`/socios/${e.socioId}`} className="enlace font-normal">{e.nombre}</Link>
                    </td>
                    <td>
                      {e.excepcion ? (
                        <Insignia tono="ambar">Excepción · {e.excepcion}</Insignia>
                      ) : (
                        <span className="text-gris">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
