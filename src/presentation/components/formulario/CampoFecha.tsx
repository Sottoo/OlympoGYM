"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PanelFlotante, useCerrarAlTocarFuera, usePosicionFlotante } from "./flotante";
import { IconoCalendario } from "./marcas";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/* ── Fechas como texto "AAAA-MM-DD", sin zonas horarias de por medio ── */
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const partes = (f: string) => f.split("-").map(Number) as [number, number, number];
const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
/** Lunes = 0 … domingo = 6 */
const diaSemana = (f: string) => {
  const [a, m, d] = partes(f);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
};
function moverDias(f: string, n: number): string {
  const [a, m, d] = partes(f);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}
function moverMeses(f: string, n: number): string {
  const [a, m, d] = partes(f);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(na, nm, Math.min(d, diasDelMes(na, nm)));
}
function hoyLocal(): string {
  const x = new Date();
  return iso(x.getFullYear(), x.getMonth() + 1, x.getDate());
}
function esValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [a, m, d] = partes(f);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(a, m);
}
const aTexto = (f: string) => {
  const [a, m, d] = partes(f);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
};
/** "12031994" o "12/3/1994" → "1994-03-12" (o null si no es una fecha). */
function leerTexto(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/) ?? texto.replace(/\D/g, "").match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const f = iso(Number(m[3]), Number(m[2]), Number(m[1]));
  return esValida(f) ? f : null;
}
/** Mientras se escribe, las diagonales aparecen solas: "1203" → "12/03". */
function enmascarar(texto: string): string {
  const n = texto.replace(/\D/g, "").slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join("/");
}

export function describirFecha(f: string): string {
  const [a, m, d] = partes(f);
  return `${DIAS_LARGOS[diaSemana(f)]} ${d} de ${MESES[m - 1]} de ${a}`;
}

interface PropsCampo {
  id?: string;
  nombre?: string;
  valor?: string;
  valorInicial?: string;
  alCambiar?: (fecha: string) => void;
  min?: string;
  max?: string;
  requerido?: boolean;
  /** Texto de ayuda que cambia con la fecha elegida (p. ej. la edad). */
  describir?: (fecha: string) => string;
  /** Con qué vista abre el calendario si no hay fecha: años (para nacimientos) o días. */
  empezarEn?: "dias" | "anios";
}

/**
 * Campo de fecha: se escribe (dd/mm/aaaa, las diagonales se ponen solas) o se
 * elige en el calendario de parches. Envía la fecha como AAAA-MM-DD.
 */
export function CampoFecha({ id, nombre, valor, valorInicial = "", alCambiar, min, max, requerido = false, describir, empezarEn = "dias" }: PropsCampo) {
  const propio = useId();
  const idCampo = id ?? `fecha-${propio}`;
  const [interno, setInterno] = useState(valorInicial);
  const actual = valor ?? interno;
  const [texto, setTexto] = useState(actual ? aTexto(actual) : "");
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const botonCal = useRef<HTMLButtonElement>(null);
  const pos = usePosicionFlotante(caja, abierto, 380, 312);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarAlTocarFuera(abierto, [caja, panel], cerrar);

  // Si el valor cambia desde fuera, el texto lo sigue.
  useEffect(() => {
    setTexto(actual ? aTexto(actual) : "");
  }, [actual]);

  function fijar(f: string) {
    if (valor === undefined) setInterno(f);
    alCambiar?.(f);
    setError(null);
  }

  function revisarTexto() {
    if (!texto.trim()) {
      fijar("");
      return;
    }
    const f = leerTexto(texto);
    if (!f) return setError("Escríbela como día/mes/año, por ejemplo 07/03/1994.");
    if ((min && f < min) || (max && f > max)) return setError("Esa fecha queda fuera del rango permitido.");
    fijar(f);
    setTexto(aTexto(f));
  }

  return (
    <div className="relative">
      <div ref={caja} className={`campo campo-compuesto ${error ? "campo-error" : ""}`}>
        <input
          id={idCampo}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={texto}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${idCampo}-ayuda`}
          onChange={(e) => {
            setError(null);
            setTexto(/[^\d/]/.test(e.target.value) ? e.target.value : enmascarar(e.target.value));
          }}
          onBlur={revisarTexto}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              revisarTexto();
            }
            if (e.key === "ArrowDown" && e.altKey) setAbierto(true);
          }}
          className="tabular-nums tracking-[0.04em]"
        />
        <button
          ref={botonCal}
          type="button"
          className="paso paso-fin"
          aria-label="Abrir calendario"
          aria-expanded={abierto}
          aria-haspopup="dialog"
          onClick={() => setAbierto((a) => !a)}
        >
          <IconoCalendario />
        </button>
      </div>
      <input
        tabIndex={-1}
        aria-hidden
        name={nombre}
        // Con una fecha mal escrita no se envía nada: se pide corregirla.
        value={error ? "" : actual}
        required={requerido || Boolean(error)}
        onChange={() => {}}
        onInvalid={(e) => {
          e.preventDefault();
          setError((previo) => previo ?? "Falta la fecha.");
          document.getElementById(idCampo)?.focus();
        }}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <p id={`${idCampo}-ayuda`} className={`ayuda ${error ? "font-semibold text-rojo!" : ""}`} aria-live="polite">
        {error ?? (actual && describir ? describir(actual) : actual ? <span className="first-letter:uppercase">{describirFecha(actual)}</span> : null)}
      </p>
      {abierto && (
        <PanelFlotante pos={pos} panel={panel} etiqueta="Calendario" className="w-[312px]!">
          <Calendario
            valor={actual}
            min={min}
            max={max}
            vistaInicial={actual ? "dias" : empezarEn}
            alElegir={(f) => {
              fijar(f);
              setAbierto(false);
              botonCal.current?.focus();
            }}
            alCerrar={() => {
              setAbierto(false);
              botonCal.current?.focus();
            }}
            alBorrar={requerido ? undefined : () => {
              fijar("");
              setAbierto(false);
            }}
          />
        </PanelFlotante>
      )}
    </div>
  );
}

/** Solo el botón (sin campo de texto): para saltar a un día, como en Entradas. */
export function BotonFecha({ valor, max, min, alElegir, texto = "Elegir fecha" }: { valor: string; max?: string; min?: string; alElegir: (f: string) => void; texto?: string }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pos = usePosicionFlotante(boton, abierto, 380, 312);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarAlTocarFuera(abierto, [boton, panel], cerrar);
  return (
    <>
      <button ref={boton} type="button" className="boton-secundario boton-chico" aria-expanded={abierto} aria-haspopup="dialog" onClick={() => setAbierto((a) => !a)}>
        <IconoCalendario className="size-4" />
        {texto}
      </button>
      {abierto && (
        <PanelFlotante pos={pos ? { ...pos, left: Math.max(8, Math.min(pos.left + pos.width - 312, window.innerWidth - 320)) } : null} panel={panel} etiqueta="Calendario" className="w-[312px]!">
          <Calendario
            valor={valor}
            min={min}
            max={max}
            alElegir={(f) => {
              setAbierto(false);
              alElegir(f);
            }}
            alCerrar={() => {
              setAbierto(false);
              boton.current?.focus();
            }}
          />
        </PanelFlotante>
      )}
    </>
  );
}

type Vista = "dias" | "meses" | "anios";

/**
 * El calendario: cada día es un hueco de parche; el de hoy va punteado en
 * hilo rojo y el elegido queda cosido en negro. El título abre los meses y
 * los años, para llegar rápido a una fecha de nacimiento.
 */
export function Calendario({
  valor,
  min,
  max,
  vistaInicial = "dias",
  alElegir,
  alCerrar,
  alBorrar,
}: {
  valor: string;
  min?: string;
  max?: string;
  vistaInicial?: Vista;
  alElegir: (f: string) => void;
  alCerrar: () => void;
  alBorrar?: () => void;
}) {
  const hoy = hoyLocal();
  const inicio = valor || (max && hoy > max ? max : min && hoy < min ? min : hoy);
  const [foco, setFoco] = useState(inicio);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [primerAnio, setPrimerAnio] = useState(() => partes(inicio)[0] - (vistaInicial === "anios" ? 25 : 6));
  const rejilla = useRef<HTMLDivElement>(null);
  const [anio, mes] = partes(foco);
  const fuera = (f: string) => Boolean((min && f < min) || (max && f > max));
  const minAnio = min ? partes(min)[0] : 1900;
  const maxAnio = max ? partes(max)[0] : 2100;

  // El foco del teclado sigue al día marcado.
  useEffect(() => {
    const objetivo =
      vista === "dias"
        ? rejilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${foco}"]`)
        : rejilla.current?.querySelector<HTMLButtonElement>("[data-foco='si']");
    (objetivo ?? rejilla.current?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  }, [foco, vista]);

  function teclaDia(e: React.KeyboardEvent) {
    const pasos: Record<string, () => string> = {
      ArrowLeft: () => moverDias(foco, -1),
      ArrowRight: () => moverDias(foco, 1),
      ArrowUp: () => moverDias(foco, -7),
      ArrowDown: () => moverDias(foco, 7),
      PageUp: () => moverMeses(foco, e.shiftKey ? -12 : -1),
      PageDown: () => moverMeses(foco, e.shiftKey ? 12 : 1),
      Home: () => moverDias(foco, -diaSemana(foco)),
      End: () => moverDias(foco, 6 - diaSemana(foco)),
    };
    if (pasos[e.key]) {
      e.preventDefault();
      setFoco(pasos[e.key]());
    } else if (e.key === "Escape") {
      e.preventDefault();
      alCerrar();
    }
  }

  const totalDias = diasDelMes(anio, mes);
  const desfase = diaSemana(iso(anio, mes, 1));
  const mesAnteriorFuera = fuera(iso(anio, mes, 1)) && Boolean(min && iso(anio, mes, 1) < min);
  const mesSiguienteFuera = Boolean(max && iso(anio, mes, totalDias) >= max);

  return (
    <div
      className="calendario"
      onKeyDown={(e) => e.key === "Escape" && alCerrar()}
      // Al salir con Tab, el calendario se cierra y el foco vuelve al campo.
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) alCerrar();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          className="paso-redondo"
          aria-label={vista === "anios" ? "Años anteriores" : vista === "meses" ? "Año anterior" : "Mes anterior"}
          disabled={vista === "dias" ? mesAnteriorFuera : vista === "meses" ? anio <= minAnio : primerAnio <= minAnio}
          onClick={() => (vista === "dias" ? setFoco(moverMeses(foco, -1)) : vista === "meses" ? setFoco(moverMeses(foco, -12)) : setPrimerAnio((a) => a - 20))}
        >
          <svg aria-hidden viewBox="0 0 14 14" className="size-3.5"><path d="M8.8 3 4.8 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          className="titulo-calendario"
          aria-live="polite"
          onClick={() => {
            if (vista === "dias") setVista("meses");
            else if (vista === "meses") {
              setPrimerAnio(anio - 10);
              setVista("anios");
            } else setVista("dias");
          }}
        >
          {vista === "anios" ? (
            <>
              {Math.max(primerAnio, minAnio)}–{Math.min(primerAnio + 19, maxAnio)}
            </>
          ) : vista === "meses" ? (
            anio
          ) : (
            <>
              <span className="first-letter:uppercase">{MESES[mes - 1]}</span> <span className="text-gris">{anio}</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="paso-redondo"
          aria-label={vista === "anios" ? "Años siguientes" : vista === "meses" ? "Año siguiente" : "Mes siguiente"}
          disabled={vista === "dias" ? mesSiguienteFuera : vista === "meses" ? anio >= maxAnio : primerAnio + 19 >= maxAnio}
          onClick={() => (vista === "dias" ? setFoco(moverMeses(foco, 1)) : vista === "meses" ? setFoco(moverMeses(foco, 12)) : setPrimerAnio((a) => a + 20))}
        >
          <svg aria-hidden viewBox="0 0 14 14" className="size-3.5"><path d="M5.2 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div ref={rejilla}>
        {vista === "dias" && (
          <div role="group" aria-label={`${MESES[mes - 1]} de ${anio}. Usa las flechas para moverte entre los días.`} className="grid grid-cols-7 gap-y-0.5" onKeyDown={teclaDia}>
            {DIAS.map((d, i) => (
              <span key={i} aria-hidden className="pb-1.5 text-center text-[0.66rem] font-bold tracking-[0.14em] text-gris">
                {d}
              </span>
            ))}
            {Array.from({ length: desfase }, (_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: totalDias }, (_, i) => iso(anio, mes, i + 1)).map((f) => {
              const elegido = f === valor;
              return (
                <span key={f} className="grid place-items-center py-0.5">
                  <button
                    type="button"
                    data-fecha={f}
                    tabIndex={f === foco ? 0 : -1}
                    disabled={fuera(f)}
                    aria-pressed={elegido}
                    aria-current={f === hoy ? "date" : undefined}
                    aria-label={describirFecha(f)}
                    onClick={() => alElegir(f)}
                    className={`dia-parche ${elegido ? "dia-elegido" : ""} ${f === hoy ? "dia-hoy" : ""}`}
                  >
                    {Number(f.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {vista === "meses" && (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {MESES.map((m, i) => {
              const f = iso(anio, i + 1, 1);
              const deshabilitado = Boolean((max && f > max) || (min && iso(anio, i + 1, diasDelMes(anio, i + 1)) < min));
              return (
                <button
                  key={m}
                  type="button"
                  disabled={deshabilitado}
                  data-foco={i + 1 === mes ? "si" : undefined}
                  className={`celda-calendario ${i + 1 === mes ? "celda-actual" : ""}`}
                  onClick={() => {
                    const d = Math.min(partes(foco)[2], diasDelMes(anio, i + 1));
                    let nuevo = iso(anio, i + 1, d);
                    if (max && nuevo > max) nuevo = max;
                    if (min && nuevo < min) nuevo = min;
                    setFoco(nuevo);
                    setVista("dias");
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}

        {vista === "anios" && (
          <div className="grid grid-cols-4 gap-1.5 py-1">
            {Array.from({ length: 20 }, (_, i) => primerAnio + i).map((a) => (
              <button
                key={a}
                type="button"
                disabled={a < minAnio || a > maxAnio}
                data-foco={a === anio ? "si" : undefined}
                className={`celda-calendario tabular-nums ${a === anio ? "celda-actual" : ""}`}
                onClick={() => {
                  setFoco(iso(a, mes, Math.min(partes(foco)[2], diasDelMes(a, mes))));
                  setVista("meses");
                }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t-[1.5px] border-dashed border-linea px-1 pt-2.5">
        <button type="button" className="enlace text-[0.8rem] font-bold" disabled={fuera(hoy)} onClick={() => alElegir(hoy)}>
          Hoy
        </button>
        {alBorrar && (
          <button type="button" className="text-[0.8rem] font-semibold text-gris hover:text-tinta" onClick={alBorrar}>
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}
