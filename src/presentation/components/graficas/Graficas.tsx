/*
 * Gráficas de Métricas. Se dibujan con HTML (no SVG escalado) para que el
 * texto conserve su tamaño en cualquier ancho. Reglas comunes:
 *   · columnas de máximo 22 px, esquina redondeada de 4 px solo en la punta;
 *   · 2 px de separación entre segmentos apilados;
 *   · se rotula poco (el máximo, el actual); el resto va en el tooltip;
 *   · con dos series siempre hay leyenda; el texto nunca lleva el color de la serie;
 *   · cada gráfica ofrece "Ver datos" como tabla.
 */
import { formatearDinero } from "@/shared/formato";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const fechaCorta = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const mesCorto = (f: string) => MESES[Number(f.slice(5, 7)) - 1];
const compacto = (n: number) => (n >= 1000 ? `$${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}k` : formatearDinero(n));

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

/** Columnas de una sola serie por día. El último día (hoy) va resaltado. */
export function AsistenciaDiaria({ dias }: { dias: { fecha: string; entradas: number }[] }) {
  const maximo = Math.max(1, ...dias.map((d) => d.entradas));
  const iPico = dias.reduce((a, d, i) => (d.entradas > dias[a].entradas ? i : a), 0);
  const ultimo = dias.length - 1;
  return (
    <div className="grid gap-2">
      <div className="grid h-40 items-end gap-[3px] border-b border-linea" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
        {dias.map((d, i) => {
          const rotular = d.entradas > 0 && (i === iPico || i === ultimo);
          return (
            <div key={d.fecha} className="group relative flex h-full items-end justify-center" title={`${fechaCorta(d.fecha)} · ${d.entradas} ${d.entradas === 1 ? "entrada" : "entradas"}`}>
              {rotular && (
                <span className="absolute whitespace-nowrap text-[0.72rem] font-medium tabular-nums" style={{ bottom: `calc(${(d.entradas / maximo) * 100}% + 4px)` }}>
                  {d.entradas}
                </span>
              )}
              <span
                className={`block w-full max-w-[22px] rounded-t-[4px] transition-colors ${i === ultimo ? "bg-vino" : "bg-serie-1-claro group-hover:bg-serie-1/70"}`}
                style={{ height: d.entradas > 0 ? `${Math.max(3, (d.entradas / maximo) * 100)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="grid text-[0.72rem] text-gris tabular-nums" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
        {dias.map((d, i) => (
          <span key={d.fecha} className="overflow-visible whitespace-nowrap text-center">
            {i === ultimo ? "Hoy" : i % 7 === 0 && ultimo - i >= 4 ? fechaCorta(d.fecha) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mapa de calor día × hora con una rampa de un solo tono: más oscuro, más gente. */
export function MapaHorasPico({ celdas, desde = 5, hasta = 23 }: { celdas: number[][]; desde?: number; hasta?: number }) {
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const maximo = Math.max(1, ...celdas.flatMap((fila) => horas.map((h) => fila[h] ?? 0)));
  const rampa = ["var(--color-secuencia-0)", "var(--color-secuencia-1)", "var(--color-secuencia-2)", "var(--color-secuencia-3)", "var(--color-secuencia-4)", "var(--color-secuencia-5)"];
  const tono = (n: number) => (n === 0 ? rampa[0] : rampa[Math.min(5, 1 + Math.floor((n / maximo) * 4.999))]);
  const columnas = { gridTemplateColumns: `2.5rem repeat(${horas.length}, minmax(0, 1fr))` };

  return (
    <div className="grid gap-3">
      <div className="grid gap-[3px]" role="table" aria-label="Entradas por día de la semana y hora">
        {celdas.map((fila, d) => (
          <div key={d} role="row" className="grid items-center gap-[3px]" style={columnas}>
            <span role="rowheader" className="text-[0.76rem] text-gris">{DIAS[d]}</span>
            {horas.map((h) => (
              <span
                key={h}
                role="cell"
                title={`${DIAS[d]} ${h}:00 · ${fila[h] ?? 0} ${fila[h] === 1 ? "entrada" : "entradas"}`}
                className="h-6 rounded-[4px] transition-transform hover:scale-110"
                style={{ background: tono(fila[h] ?? 0) }}
              />
            ))}
          </div>
        ))}
        <div className="grid text-[0.72rem] text-gris tabular-nums" style={columnas}>
          <span />
          {horas.map((h) => (
            <span key={h} className="whitespace-nowrap text-center">{h % 3 === 0 ? `${h}:00` : ""}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[0.76rem] text-gris">
        Menos
        {rampa.map((c) => (
          <span key={c} aria-hidden className="size-3 rounded-[3px]" style={{ background: c }} />
        ))}
        Más
      </div>
    </div>
  );
}

/** Ingresos por mes: membresías y tienda apiladas, con el total en la punta. */
export function IngresosPorMes({ meses }: { meses: { mes: string; membresias: number; tienda: number }[] }) {
  const maximo = Math.max(1, ...meses.map((m) => m.membresias + m.tienda));
  return (
    <div className="grid gap-3">
      <Leyenda series={[{ nombre: "Membresías", color: "var(--color-serie-1)" }, { nombre: "Tienda", color: "var(--color-serie-2)" }]} />
      <div className="grid h-44 grid-flow-col items-end gap-3 border-b border-linea pt-5" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => {
          const total = m.membresias + m.tienda;
          return (
            <div
              key={m.mes}
              className="relative flex h-full flex-col items-center justify-end"
              title={`${mesCorto(m.mes)} · Membresías ${formatearDinero(m.membresias)} · Tienda ${formatearDinero(m.tienda)}`}
            >
              {total > 0 && (
                <span className="absolute whitespace-nowrap text-[0.74rem] font-medium tabular-nums" style={{ bottom: `calc(${(total / maximo) * 100}% + 4px)` }}>
                  {compacto(total)}
                </span>
              )}
              <span className="flex w-full max-w-[26px] flex-col justify-end gap-[2px]" style={{ height: `${(total / maximo) * 100}%` }}>
                {m.tienda > 0 && <span className="block rounded-t-[4px] bg-serie-2" style={{ flexGrow: m.tienda }} />}
                {m.membresias > 0 && (
                  <span className={`block bg-serie-1 ${m.tienda > 0 ? "" : "rounded-t-[4px]"}`} style={{ flexGrow: m.membresias }} />
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-flow-col gap-3 text-center text-[0.76rem] text-gris" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => <span key={m.mes}>{mesCorto(m.mes)}</span>)}
      </div>
    </div>
  );
}

/** Altas hacia arriba y bajas hacia abajo de una misma línea base. */
export function AltasYBajas({ meses }: { meses: { mes: string; altas: number; bajas: number }[] }) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.altas, m.bajas]));
  return (
    <div className="grid gap-3">
      <Leyenda series={[{ nombre: "Altas", color: "var(--color-serie-1)" }, { nombre: "Bajas", color: "var(--color-serie-2)" }]} />
      <div className="grid grid-flow-col gap-3" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => (
          <div key={m.mes} className="grid" title={`${mesCorto(m.mes)} · ${m.altas} altas · ${m.bajas} bajas`}>
            <div className="relative flex h-24 items-end justify-center border-b border-linea-fuerte">
              {m.altas > 0 && (
                <span className="absolute text-[0.74rem] font-medium tabular-nums" style={{ bottom: `calc(${(m.altas / maximo) * 100}% + 4px)` }}>
                  {m.altas}
                </span>
              )}
              <span className="block w-full max-w-[22px] rounded-t-[4px] bg-serie-1" style={{ height: m.altas ? `${(m.altas / maximo) * 100}%` : 0 }} />
            </div>
            <div className="relative flex h-16 items-start justify-center">
              <span className="block w-full max-w-[22px] rounded-b-[4px] bg-serie-2" style={{ height: m.bajas ? `${(m.bajas / maximo) * 100}%` : 0 }} />
              {m.bajas > 0 && (
                <span className="absolute text-[0.74rem] font-medium tabular-nums" style={{ top: `calc(${(m.bajas / maximo) * 100}% + 4px)` }}>
                  {m.bajas}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-flow-col gap-3 text-center text-[0.76rem] text-gris" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {meses.map((m) => <span key={m.mes}>{mesCorto(m.mes)}</span>)}
      </div>
    </div>
  );
}

/** Barras horizontales de una serie con el valor en la punta. */
export function BarrasHorizontales({ filas }: { filas: { nombre: string; valor: number; detalle: string }[] }) {
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
            <div className="h-full rounded-full bg-serie-1" style={{ width: `${(f.valor / maximo) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export const formatos = { fechaCorta, mesCorto };
