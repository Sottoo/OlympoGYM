"use client";

import { useActionState, useState } from "react";
import { type AreaEquipo, AREAS_EQUIPO, describirFrecuencia, type EquipoDeCatalogo } from "@/domain/entities/Mantenimiento";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { AvisosDelFormulario, Formulario } from "@/presentation/components/formulario/Formulario";
import { BotonDeRopa } from "@/presentation/components/formulario/marcas";
import { Selector } from "@/presentation/components/formulario/Selector";
import { Icono } from "@/presentation/components/Icono";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeEquipo } from "@/presentation/components/pictogramas/elegir";
import { accionAltaRapida } from "../../acciones";

const FRECUENCIAS = ["", "1", "2", "3", "4", "6", "12"];

interface Eleccion {
  cantidad: number;
  frecuencia: string;
}

export function AltaRapida({ catalogo, yaHay }: { catalogo: EquipoDeCatalogo[]; yaHay: Record<string, number> }) {
  const [estado, accion] = useActionState(accionAltaRapida, estadoInicial);
  const [elegidos, setElegidos] = useState<Record<string, Eleccion>>({});

  const grupos = new Map<AreaEquipo, EquipoDeCatalogo[]>();
  for (const e of catalogo) grupos.set(e.area, [...(grupos.get(e.area) ?? []), e]);

  const lote = catalogo
    .filter((e) => elegidos[e.clave])
    .map((e) => ({ clave: e.clave, cantidad: elegidos[e.clave].cantidad, frecuenciaMeses: elegidos[e.clave].frecuencia ? Number(elegidos[e.clave].frecuencia) : null }));
  const total = lote.reduce((t, e) => t + e.cantidad, 0);

  function alternar(e: EquipoDeCatalogo) {
    setElegidos((m) => {
      if (m[e.clave]) {
        const { [e.clave]: _, ...resto } = m;
        return resto;
      }
      return { ...m, [e.clave]: { cantidad: 1, frecuencia: String(e.frecuenciaMeses) } };
    });
  }
  const cambiar = (clave: string, cambio: Partial<Eleccion>) => setElegidos((m) => ({ ...m, [clave]: { ...m[clave], ...cambio } }));

  /** "Caminadora 1–3" (o 4–5 si ya había 3). */
  function nombres(e: EquipoDeCatalogo, cantidad: number) {
    const ya = yaHay[e.clave] ?? 0;
    if (ya === 0 && cantidad === 1) return e.nombre;
    const desde = ya + 1;
    const hasta = ya + cantidad;
    return desde === hasta ? `${e.nombre} ${desde}` : `${e.nombre} ${desde}–${hasta}`;
  }

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="con-lateral">
      <input type="hidden" name="equipos" value={JSON.stringify(lote)} />
      <div className="bloques">
        {[...grupos.entries()].map(([area, lista]) => (
          <section key={area} aria-label={AREAS_EQUIPO[area]} className="superficie">
            <h2 className="rotulo px-4 pb-1 pt-3.5">{AREAS_EQUIPO[area]}</h2>
            <ul className="divide-y divide-dashed divide-linea">
              {lista.map((e) => {
                const sel = elegidos[e.clave];
                const ya = yaHay[e.clave] ?? 0;
                return (
                  <li key={e.clave} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${sel ? "bg-verde-tenue/40" : ""}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={Boolean(sel)} onChange={() => alternar(e)} className="peer sr-only" />
                      <BotonDeRopa marcado={Boolean(sel)} />
                      <Emblema {...dibujoDeEquipo(e)} tamano="md" />
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{e.nombre}</span>
                        <span className="text-[0.8rem] text-gris">
                          {sel ? `Se darán de alta: ${nombres(e, sel.cantidad)}` : ya > 0 ? (ya === 1 ? "Ya tienes una; la nueva será la 2" : `Ya van hasta la ${ya}; siguen en la ${ya + 1}`) : `Preventivo sugerido: ${describirFrecuencia(e.frecuenciaMeses).toLowerCase()}`}
                        </span>
                      </span>
                    </label>
                    {sel && (
                      <div className="aparece flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-full border border-linea bg-elevado" role="group" aria-label={`Cuántas ${e.nombre}`}>
                          <button type="button" onClick={() => cambiar(e.clave, { cantidad: Math.max(1, sel.cantidad - 1) })} disabled={sel.cantidad <= 1} className="p-2 text-gris hover:text-tinta disabled:opacity-30" aria-label="Una menos">
                            <Icono nombre="menos" className="size-4" />
                          </button>
                          <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{sel.cantidad}</span>
                          <button type="button" onClick={() => cambiar(e.clave, { cantidad: Math.min(50, sel.cantidad + 1) })} className="p-2 text-gris hover:text-tinta" aria-label="Una más">
                            <Icono nombre="mas" className="size-4" />
                          </button>
                        </div>
                        <Selector
                          compacto
                          aria-label={`Preventivo de ${e.nombre}`}
                          valor={sel.frecuencia}
                          alCambiar={(f) => cambiar(e.clave, { frecuencia: f })}
                          opciones={FRECUENCIAS.map((f) => ({ valor: f, texto: f ? describirFrecuencia(Number(f)) : "Sin preventivo" }))}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <aside className="bloques">
        <section className="panel grid gap-4 px-6 py-[22px] xl:sticky xl:top-6">
          <div>
            <h2 className="font-titulos text-[1.3rem] leading-tight">Para dar de alta</h2>
            <p className="mt-1 text-[0.84rem] text-gris">{total === 0 ? "Marca las máquinas que tienes." : `${total} ${total === 1 ? "máquina" : "máquinas"}.`}</p>
          </div>
          {lote.length > 0 && (
            <ul className="grid gap-1 text-[0.86rem]">
              {lote.map((l) => {
                const e = catalogo.find((c) => c.clave === l.clave)!;
                return (
                  <li key={l.clave} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{nombres(e, l.cantidad)}</span>
                    <span className="shrink-0 text-gris">{l.frecuenciaMeses ? describirFrecuencia(l.frecuenciaMeses).toLowerCase() : "sin preventivo"}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[0.8rem] text-gris">El primer preventivo se cuenta desde hoy. Si alguna tuvo servicio hace poco, ajústalo en su ficha.</p>
          <AvisosDelFormulario />
          <BotonEnviar textoEnviando="Dando de alta…" className="w-full py-3" disabled={total === 0}>
            Agregar {total > 0 ? total : ""}
          </BotonEnviar>
        </section>
      </aside>
    </Formulario>
  );
}
