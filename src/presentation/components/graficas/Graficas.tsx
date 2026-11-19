/*
 * Gráficas de Métricas. Se dibujan con HTML (no SVG escalado) para que el
 * texto conserve su tamaño en cualquier ancho. Reglas comunes:
 *   · columnas de máximo 22 px, esquina redondeada de 4 px solo en la punta;
 *   · 2 px de separación entre segmentos apilados;
 *   · se rotula poco (el máximo, el actual); el resto va en el tooltip;
 *   · con dos series siempre hay leyenda; el texto nunca lleva el color de la serie;
 *   · cada gráfica ofrece "Ver datos" como tabla.
 */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const mesCorto = (f: string) => MESES[Number(f.slice(5, 7)) - 1];

export function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-gris">
      {series.map((s) => (
        <li key={s.nombre} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

export function VerDatos({ encabezados, filas }: { encabezados: string[]; filas: (string | number)[][] }) {
  return (
    <details className="group text-[0.84rem]">
      <summary className="w-fit list-none text-gris hover:text-tinta [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver datos</span>
        <span className="hidden group-open:inline">Ocultar datos</span>
      </summary>
      <div className="aparece mt-3 max-h-64 overflow-auto rounded-[12px] border border-linea">
        <table className="tabla text-[0.84rem]">
          <thead>
            <tr>{encabezados.map((e, i) => <th key={e} className={i > 0 ? "numero" : ""}>{e}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>{f.map((c, j) => <td key={j} className={j > 0 ? "numero" : ""}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Altas hacia arriba (verde) y bajas hacia abajo (rojo) de una misma línea
 * base; debajo, el saldo del mes. La posición y los números dicen lo mismo
 * que el color, así se lee igual sin distinguir colores.
 */
export function AltasYBajas({ meses }: { meses: { mes: string; altas: number; bajas: number }[] }) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.altas, m.bajas]));
  const ultimo = meses.length - 1;
  return (
    <div className="grid gap-3">
      <Leyenda series={[{ nombre: "Altas", color: "var(--color-dato-verde)" }, { nombre: "Bajas", color: "var(--color-dato-rojo)" }]} />
      <div className="grid grid-flow-col gap-3" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => (
          <div key={m.mes} className="grid" title={`${mesCorto(m.mes)} · ${m.altas} altas · ${m.bajas} bajas`}>
            <div className="relative flex h-24 items-end justify-center border-b border-linea-fuerte">
              {m.altas > 0 && (
                <span className="absolute text-[0.76rem] font-semibold tabular-nums" style={{ bottom: `calc(${(m.altas / maximo) * 100}% + 4px)` }}>
                  +{m.altas}
                </span>
              )}
              <span className="block w-full max-w-[24px] rounded-t-[4px] bg-dato-verde" style={{ height: m.altas ? `${(m.altas / maximo) * 100}%` : 0 }} />
            </div>
            <div className="relative flex h-16 items-start justify-center pt-[2px]">
              <span className="block w-full max-w-[24px] rounded-b-[4px] bg-dato-rojo" style={{ height: m.bajas ? `${(m.bajas / maximo) * 100}%` : 0 }} />
              {m.bajas > 0 && (
                <span className="absolute text-[0.76rem] font-semibold tabular-nums" style={{ top: `calc(${(m.bajas / maximo) * 100}% + 6px)` }}>
                  −{m.bajas}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-flow-col gap-3 text-center text-[0.76rem] text-gris" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m, i) => (
          <span key={m.mes} className={i === ultimo ? "font-semibold text-tinta" : ""}>
            {mesCorto(m.mes)}
          </span>
        ))}
      </div>
      <div className="grid grid-flow-col gap-3 border-t border-dashed border-linea pt-2 text-center text-[0.74rem] tabular-nums" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => {
          const saldo = m.altas - m.bajas;
          return (
            <span key={m.mes} className={saldo === 0 ? "text-gris" : "font-semibold text-tinta"} title="Saldo: altas menos bajas">
              {saldo > 0 ? `+${saldo}` : saldo < 0 ? `−${-saldo}` : "0"}
            </span>
          );
        })}
      </div>
      <p className="text-[0.74rem] text-gris">Última fila: saldo del mes (altas menos bajas).</p>
    </div>
  );
}

/** Barras horizontales de una serie con el valor en la punta. */
export function BarrasHorizontales({ filas, color = "var(--color-tinta)" }: { filas: { nombre: string; valor: number; detalle: string }[]; color?: string }) {
  const maximo = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="grid gap-3.5">
      {filas.map((f) => (
        <li key={f.nombre} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[0.9rem]">
            <span className="truncate">{f.nombre}</span>
            <span className="shrink-0 text-[0.82rem] text-gris tabular-nums">{f.detalle}</span>
          </div>
          <div className="h-2 rounded-full bg-hundido">
            <div className="h-full rounded-full" style={{ width: `${(f.valor / maximo) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export const formatos = { fechaCorta, mesCorto };
