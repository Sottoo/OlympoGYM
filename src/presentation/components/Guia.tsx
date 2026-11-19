import { GUIAS, type ClaveGuia } from "../guias";
import { Icono } from "./Icono";

/**
 * «Cómo funciona esta pantalla»: el procedimiento de la pantalla, plegado
 * junto al título. Se abre y se cierra sin JavaScript (details/summary) y
 * siempre tiene la misma forma: qué es, quién lo usa, paso a paso, qué queda
 * registrado y las reglas a no olvidar.
 */
export function Guia({ clave }: { clave: ClaveGuia }) {
  const g = GUIAS[clave];
  return (
    <details className="guia group/guia">
      <summary className="guia-boton">
        <Icono nombre="bitacora" className="size-[15px]" />
        <span>Cómo funciona</span>
        <span aria-hidden className="guia-flecha">›</span>
      </summary>
      <section aria-label={`Procedimiento ${g.clave}: ${g.titulo}`} className="guia-hoja">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-dashed border-linea pb-3">
          <p className="font-titulos text-[1.15rem] leading-tight">{g.titulo}</p>
          <p className="rotulo">Procedimiento {g.clave}</p>
        </header>
        <div className="grid gap-x-8 gap-y-4 pt-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <dl className="grid content-start gap-3 text-[0.88rem]">
            <div>
              <dt className="guia-rotulo">Qué es</dt>
              <dd>{g.que}</dd>
            </div>
            <div>
              <dt className="guia-rotulo">Quién lo usa</dt>
              <dd>{g.quien}</dd>
            </div>
            <div>
              <dt className="guia-rotulo">Qué queda registrado</dt>
              <dd>{g.registro}</dd>
            </div>
          </dl>
          <div className="grid content-start gap-3">
            <div>
              <p className="guia-rotulo">Paso a paso</p>
              <ol className="grid gap-2 text-[0.88rem]">
                {g.pasos.map((paso, i) => (
                  <li key={paso} className="flex gap-2.5">
                    <span aria-hidden className="guia-numero">{i + 1}</span>
                    <span className="pt-px">{paso}</span>
                  </li>
                ))}
              </ol>
            </div>
            {"reglas" in g && g.reglas && (
              <div className="rounded-[10px] bg-ambar-tenue/70 px-3.5 py-2.5 text-[0.84rem]">
                <p className="guia-rotulo text-ambar!">Importante</p>
                <ul className="grid gap-1">
                  {g.reglas.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span aria-hidden className="text-ambar">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </details>
  );
}
