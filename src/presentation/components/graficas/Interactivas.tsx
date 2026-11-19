"use client";

/*
 * Gráficas de Métricas que responden al pasar el cursor (o con las flechas
 * del teclado): entradas por día, horas pico e ingresos por mes. Siguen las
 * mismas reglas que el resto: marcas delgadas, rejilla de un trazo apenas
 * visible, se rotula poco (el pico, hoy) y el resto va en el globo y en
 * «Ver datos». El texto nunca lleva el color de la serie.
 */
import { useEffect, useRef, useState } from "react";
import { formatearDinero } from "@/shared/formato";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];

const fechaCorta = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const diaSemana = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString("es-MX")} ${n === 1 ? uno : varios}`;
const compacto = (n: number) => (n >= 1000 ? `$${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}k` : formatearDinero(n));

/** Escala con números redondos: 3 o 4 líneas de rejilla. */
function escala(maximo: number, enteros = true) {
  if (maximo <= 0) return { tope: enteros ? 4 : 1000, paso: enteros ? 1 : 250 };
  const bruto = maximo / 3;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  let paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((s) => s >= bruto) ?? bruto;
  if (enteros) paso = Math.max(1, Math.ceil(paso));
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}

/** Curva suave que no se pasa de los puntos (monótona): nunca dibuja picos que no existen. */
function curvaSuave(p: { x: number; y: number }[]): string {
  const n = p.length;
  if (n === 0) return "";
  if (n === 1) return `M${p[0].x},${p[0].y}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1].x - p[i].x;
    m[i] = (p[i + 1].y - p[i].y) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${p[i].x + h},${p[i].y + t[i] * h} ${p[i + 1].x - h},${p[i + 1].y - t[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`;
  }
  return d;
}

/** El ancho real del contenedor, para dibujar en pixeles y que el texto no se estire. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** El globo con el dato: el valor manda, la etiqueta acompaña. */
function Globo({ x, y, ancho, children }: { x: number; y: number; ancho: number; children: React.ReactNode }) {
  const izquierda = Math.min(Math.max(x, 78), Math.max(78, ancho - 78));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[9px] bg-tinta px-3 py-2 text-[0.8rem] whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)]"
      style={{ left: izquierda, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/* ── Entradas por día ─────────────────────────────────────────────── */

/**
 * Las entradas de los últimos 30 días como una línea con su lavado debajo.
 * Los fines de semana van sombreados, el promedio es una línea de referencia
 * y se rotulan solo el día más fuerte y hoy.
 */
export function GraficaEntradas({ dias, promedio }: { dias: { fecha: string; entradas: number }[]; promedio: number }) {
  const [caja, W] = useAncho<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);
  const H = 250;
  const m = { izq: 34, der: 16, arriba: 26, abajo: 28 };
  const n = dias.length;
  const maximo = Math.max(0, ...dias.map((d) => d.entradas));
  const { tope, paso } = escala(maximo);
  const ancho = Math.max(1, W - m.izq - m.der);
  const alto = H - m.arriba - m.abajo;
  const x = (i: number) => m.izq + (n === 1 ? ancho / 2 : (i / (n - 1)) * ancho);
  const y = (v: number) => m.arriba + (1 - v / tope) * alto;
  const puntos = dias.map((d, i) => ({ x: x(i), y: y(d.entradas) }));
  const linea = curvaSuave(puntos);
  const area = linea ? `${linea} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const iPico = dias.reduce((a, d, i) => (d.entradas > dias[a].entradas ? i : a), 0);
  const hoy = n - 1;
  const medio = n > 1 ? ancho / (n - 1) : ancho;

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.izq) / ancho) * (n - 1));
    setActivo(Math.min(n - 1, Math.max(0, i)));
  }
  function alTeclear(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActivo((a) => Math.min(n - 1, Math.max(0, (a ?? hoy) + (e.key === "ArrowRight" ? 1 : -1))));
  }

  const d = activo !== null ? dias[activo] : null;
  return (
    <div ref={caja} className="relative h-[250px]">
      {W > 0 && (
        <svg
          width={W}
          height={H}
          className="block touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-tinta"
          role="img"
          aria-label={`Entradas por día de los últimos ${n} días. El día más fuerte fue el ${fechaCorta(dias[iPico].fecha)} con ${dias[iPico].entradas}. Usa las flechas para recorrer los días.`}
          tabIndex={0}
          onPointerMove={alMover}
          onPointerLeave={() => setActivo(null)}
          onKeyDown={alTeclear}
          onBlur={() => setActivo(null)}
        >
          <defs>
            <linearGradient id="lavado-entradas" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-tinta)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-tinta)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Fines de semana: una franja apenas más oscura. */}
          {dias.map((dia, i) =>
            [0, 6].includes(diaSemana(dia.fecha)) ? (
              <rect
                key={`fs-${dia.fecha}`}
                x={Math.max(m.izq, x(i) - medio / 2)}
                width={Math.min(x(i) + medio / 2, m.izq + ancho) - Math.max(m.izq, x(i) - medio / 2)}
                y={m.arriba}
                height={alto}
                fill="var(--color-hundido)"
              />
            ) : null,
          )}

          {/* Rejilla y escala. */}
          {Array.from({ length: Math.round(tope / paso) + 1 }, (_, k) => k * paso).map((v) => (
            <g key={v}>
              <line x1={m.izq} x2={m.izq + ancho} y1={y(v)} y2={y(v)} stroke="var(--color-linea)" strokeWidth={1} />
              <text x={m.izq - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-gris text-[11px] tabular-nums">
                {v}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#lavado-entradas)" />
          <path d={linea} fill="none" stroke="var(--color-tinta)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Promedio como referencia. */}
          {promedio > 0 && (
            <g>
              <line x1={m.izq} x2={m.izq + ancho} y1={y(promedio)} y2={y(promedio)} stroke="var(--color-hilo)" strokeOpacity={0.55} strokeWidth={1} />
              <text x={m.izq + 6} y={y(promedio) - 6} textAnchor="start" className="fill-tinta-suave text-[11px] font-semibold" stroke="var(--color-superficie)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                Promedio {promedio.toLocaleString("es-MX", { maximumFractionDigits: 1 })}
              </text>
            </g>
          )}


          {/* El día más fuerte. */}
          {maximo > 0 && iPico !== hoy && (
            <g>
              <circle cx={x(iPico)} cy={y(dias[iPico].entradas)} r={4.5} fill="var(--color-tinta)" stroke="var(--color-superficie)" strokeWidth={2} />
              <text x={x(iPico)} y={y(dias[iPico].entradas) - 10} textAnchor="middle" className="fill-tinta text-[12px] font-semibold tabular-nums" stroke="var(--color-superficie)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                {dias[iPico].entradas}
              </text>
            </g>
          )}
          {/* Hoy, en hilo rojo. */}
          <g>
            <circle cx={x(hoy)} cy={y(dias[hoy].entradas)} r={5.5} fill="var(--color-hilo)" stroke="var(--color-superficie)" strokeWidth={2} />
            <text x={x(hoy) - 2} y={y(dias[hoy].entradas) - 11} textAnchor="end" className="fill-tinta text-[12px] font-semibold tabular-nums" stroke="var(--color-superficie)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
              {dias[hoy].entradas}
            </text>
          </g>

          {/* Eje de días: cada semana y hoy. */}
          {dias.map((dia, i) =>
            i === hoy || (i % 7 === 0 && hoy - i >= 4) ? (
              <text key={`x-${dia.fecha}`} x={x(i)} y={H - 8} textAnchor={i === hoy ? "end" : "middle"} className={`text-[11px] ${i === hoy ? "fill-tinta font-semibold" : "fill-gris"}`}>
                {i === hoy ? "Hoy" : fechaCorta(dia.fecha)}
              </text>
            ) : null,
          )}

          {/* La línea que sigue al cursor. */}
          {d && activo !== null && (
            <g pointerEvents="none">
              <line x1={x(activo)} x2={x(activo)} y1={m.arriba} y2={m.arriba + alto} stroke="var(--color-tinta)" strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={x(activo)} cy={y(d.entradas)} r={5} fill="var(--color-tinta)" stroke="var(--color-superficie)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {d && activo !== null && (
        <Globo x={x(activo)} y={y(d.entradas)} ancho={W}>
          <b className="block text-[0.95rem] font-semibold">{plural(d.entradas, "entrada", "entradas")}</b>
          <span className="text-white/70">
            {activo === hoy ? "Hoy" : `${DIAS_SEMANA[diaSemana(d.fecha)]} ${fechaCorta(d.fecha)}`}
          </span>
        </Globo>
      )}
    </div>
  );
}

/* ── Horas pico ───────────────────────────────────────────────────── */

const CALOR = ["var(--color-calor-1)", "var(--color-calor-2)", "var(--color-calor-3)", "var(--color-calor-4)", "var(--color-calor-5)"];

/**
 * Mapa de calor día × hora en una sola rampa de hilo rojo: más intenso, más
 * gente. Arriba, las entradas por hora; a la derecha, por día. La celda más
 * concurrida lleva un anillo.
 */
export function MapaHorasPico({ celdas, desde = 5, hasta = 22 }: { celdas: number[][]; desde?: number; hasta?: number }) {
  const [activa, setActiva] = useState<{ d: number; h: number } | null>(null);
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const maximo = Math.max(1, ...celdas.flatMap((fila) => horas.map((h) => fila[h] ?? 0)));
  const tono = (n: number) => (n === 0 ? "var(--color-hundido)" : CALOR[Math.min(4, Math.floor((n / maximo) * 4.999))]);
  const porHora = horas.map((h) => celdas.reduce((t, fila) => t + (fila[h] ?? 0), 0));
  const porDia = celdas.map((fila) => horas.reduce((t, h) => t + (fila[h] ?? 0), 0));
  const maxHora = Math.max(1, ...porHora);
  const maxDia = Math.max(1, ...porDia);
  // La hora y el día más fuertes de la semana (sumados), y la celda más llena.
  const horaFuerte = horas[porHora.indexOf(Math.max(...porHora))];
  const diaFuerte = porDia.indexOf(Math.max(...porDia));
  let pico = { d: -1, h: -1, n: 0 };
  celdas.forEach((fila, d) => horas.forEach((h) => (fila[h] ?? 0) > pico.n && (pico = { d, h, n: fila[h] })));
  const columnas = { gridTemplateColumns: `2.75rem repeat(${horas.length}, minmax(0, 1fr)) 5.5rem` };

  return (
    <div className="grid gap-4">
      <div className="grid gap-[3px]" role="table" aria-label="Entradas por día de la semana y hora, últimas 8 semanas">
        {/* Entradas por hora (suma de la semana). */}
        <div aria-hidden className="grid items-end gap-[3px]" style={columnas}>
          <span />
          {horas.map((h, i) => (
            <span key={h} className="flex h-10 items-end justify-center">
              <span
                className="w-full max-w-[18px] rounded-t-[3px]"
                style={{
                  height: `${Math.max(porHora[i] ? 6 : 0, (porHora[i] / maxHora) * 100)}%`,
                  background: h === horaFuerte ? "var(--color-hilo)" : "var(--color-secuencia-2)",
                }}
              />
            </span>
          ))}
          <span />
        </div>

        {celdas.map((fila, d) => (
          <div key={d} role="row" className="grid items-center gap-[3px]" style={columnas}>
            <span role="rowheader" className={`text-[0.78rem] ${d === diaFuerte ? "font-semibold text-tinta" : "text-gris"}`}>
              {DIAS_CORTOS[d]}
            </span>
            {horas.map((h) => {
              const v = fila[h] ?? 0;
              const esPico = d === pico.d && h === pico.h;
              const encendida = activa?.d === d && activa.h === h;
              return (
                <button
                  key={h}
                  type="button"
                  role="cell"
                  aria-label={`${DIAS_LARGOS[d]} a las ${h}:00: ${plural(v, "entrada", "entradas")}`}
                  onPointerEnter={() => setActiva({ d, h })}
                  onPointerLeave={() => setActiva(null)}
                  onFocus={() => setActiva({ d, h })}
                  onBlur={() => setActiva(null)}
                  className={`relative h-7 rounded-[5px] outline-none transition-[transform,box-shadow] duration-150 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-tinta ${
                    encendida ? "z-10 ring-2 ring-tinta" : ""
                  } ${esPico ? "ring-2 ring-tinta ring-offset-2 ring-offset-superficie" : ""}`}
                  style={{ background: tono(v) }}
                >
                  {encendida && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-[9px] bg-tinta px-3 py-2 text-left text-[0.8rem] whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)]">
                      <b className="block text-[0.95rem] font-semibold">{plural(v, "entrada", "entradas")}</b>
                      <span className="text-white/70">
                        {DIAS_LARGOS[d]} · {h}:00 a {h + 1}:00
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
            {/* Entradas por día (suma de sus horas). */}
            <span className="flex items-center gap-2 pl-2" aria-label={`${plural(porDia[d], "entrada", "entradas")} los ${DIAS_LARGOS[d]}`}>
              <span className="h-2 rounded-full" style={{ width: `${(porDia[d] / maxDia) * 3}rem`, background: d === diaFuerte ? "var(--color-hilo)" : "var(--color-secuencia-2)" }} />
              <span className="text-[0.74rem] text-gris tabular-nums">{porDia[d]}</span>
            </span>
          </div>
        ))}

        <div aria-hidden className="grid text-[0.72rem] text-gris tabular-nums" style={columnas}>
          <span />
          {horas.map((h) => (
            <span key={h} className={`text-center whitespace-nowrap ${h === horaFuerte ? "font-semibold text-tinta" : ""}`}>
              {h % 3 === 0 || h === horaFuerte ? `${h}:00` : ""}
            </span>
          ))}
          <span />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.76rem] text-gris">
        <span className="flex items-center gap-1.5">
          Menos
          <span aria-hidden className="size-3.5 rounded-[3px] bg-hundido" />
          {CALOR.map((c) => (
            <span key={c} aria-hidden className="size-3.5 rounded-[3px]" style={{ background: c }} />
          ))}
          Más
        </span>
        <span>
          Arriba, por hora · a la derecha, por día · <span className="inline-block size-2.5 rounded-[2px] bg-hilo align-middle" /> la más fuerte
        </span>
      </div>
    </div>
  );
}

/* ── Ingresos por mes ─────────────────────────────────────────────── */

/** Membresías y tienda apiladas por mes, con rejilla en pesos y el total del mes actual en la punta. */
export function IngresosPorMes({ meses }: { meses: { mes: string; membresias: number; tienda: number }[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const maximo = Math.max(0, ...meses.map((m) => m.membresias + m.tienda));
  const { tope, paso } = escala(maximo, false);
  const lineas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, k) => k * paso);
  const ultimo = meses.length - 1;

  return (
    <div className="grid gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-gris">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-dato-rojo" />
          Membresías
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-dato-mostaza" />
          Tienda
        </li>
      </ul>
      <div className="relative grid grid-cols-[3rem_minmax(0,1fr)]">
        {/* Escala en pesos. */}
        <div className="relative h-48">
          {lineas.map((v) => (
            <span key={v} className="absolute right-2 translate-y-1/2 text-[0.7rem] text-gris tabular-nums" style={{ bottom: `${(v / tope) * 100}%` }}>
              {compacto(v)}
            </span>
          ))}
        </div>
        <div className="relative h-48">
          {lineas.map((v) => (
            <span key={v} aria-hidden className="absolute inset-x-0 border-t border-linea" style={{ bottom: `${(v / tope) * 100}%` }} />
          ))}
          <div className="absolute inset-0 grid grid-flow-col items-end gap-3 px-1" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
            {meses.map((m, i) => {
              const total = m.membresias + m.tienda;
              const encendida = activo === i;
              return (
                <button
                  key={m.mes}
                  type="button"
                  aria-label={`${MESES_LARGOS[Number(m.mes.slice(5, 7)) - 1]}: ${formatearDinero(total)} (membresías ${formatearDinero(m.membresias)}, tienda ${formatearDinero(m.tienda)})`}
                  onPointerEnter={() => setActivo(i)}
                  onPointerLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className="group relative flex h-full flex-col items-center justify-end rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-tinta"
                >
                  {(i === ultimo || encendida) && total > 0 && (
                    <span className="absolute text-[0.76rem] font-semibold whitespace-nowrap tabular-nums" style={{ bottom: `calc(${(total / tope) * 100}% + 5px)` }}>
                      {compacto(total)}
                    </span>
                  )}
                  <span
                    className={`flex w-full max-w-[24px] flex-col justify-end gap-[2px] transition-opacity ${activo !== null && !encendida ? "opacity-45" : ""}`}
                    style={{ height: `${(total / tope) * 100}%` }}
                  >
                    {m.tienda > 0 && <span className="block rounded-t-[4px] bg-dato-mostaza" style={{ flexGrow: m.tienda }} />}
                    {m.membresias > 0 && <span className={`block bg-dato-rojo ${m.tienda > 0 ? "" : "rounded-t-[4px]"}`} style={{ flexGrow: m.membresias }} />}
                  </span>
                  {encendida && (
                    <span className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-[9px] bg-tinta px-3 py-2 text-left text-[0.8rem] whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)]" style={{ bottom: `calc(${(total / tope) * 100}% + 28px)` }}>
                      <b className="block text-[0.95rem] font-semibold">{formatearDinero(total)}</b>
                      <span className="flex items-center gap-1.5 text-white/75">
                        <span aria-hidden className="h-0.5 w-3 rounded-full bg-dato-rojo" />
                        Membresías {formatearDinero(m.membresias)}
                      </span>
                      <span className="flex items-center gap-1.5 text-white/75">
                        <span aria-hidden className="h-0.5 w-3 rounded-full bg-dato-mostaza" />
                        Tienda {formatearDinero(m.tienda)}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <span />
        <div className="grid grid-flow-col gap-3 px-1 pt-2 text-center text-[0.76rem] text-gris" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
          {meses.map((m, i) => (
            <span key={m.mes} className={i === ultimo ? "font-semibold text-tinta" : ""}>
              {MESES[Number(m.mes.slice(5, 7)) - 1]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
