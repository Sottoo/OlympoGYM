"use client";

import { useEffect, useRef, useState } from "react";
import { IconoArchivo, IconoOjo } from "./marcas";

/** Atributos extra para el campo real (reglas de validación data-*, descripción…). */
export type AtributosCampo = Record<`data-${string}`, string | undefined> & { "aria-describedby"?: string; autoFocus?: boolean };

/* ── Cantidades: con botones de menos y más a los lados ───────────── */

interface PropsNumero {
  id?: string;
  nombre?: string;
  valor?: string;
  valorInicial?: string;
  alCambiar?: (valor: string) => void;
  min?: number;
  max?: number;
  paso?: number;
  /** Cuánto suman o restan los botones − y + (por omisión, el paso). Ej.: un bote completo de 907 g. */
  salto?: number;
  requerido?: boolean;
  /** Unidad que se lee junto al número ("piezas", "días"…). */
  unidad?: string;
  className?: string;
  atributos?: AtributosCampo;
}

/** Campo para contar (piezas, duración): se escribe o se ajusta con − y +. */
export function CampoNumero({ id, nombre, valor, valorInicial = "", alCambiar, min, max, paso = 1, salto, requerido = false, unidad, className = "", atributos }: PropsNumero) {
  const [interno, setInterno] = useState(valorInicial);
  const actual = valor ?? interno;
  const fijar = (v: string) => {
    if (valor === undefined) setInterno(v);
    alCambiar?.(v);
  };
  const n = Number(actual || 0);
  const mover = (d: number) => {
    let x = (Number.isFinite(n) ? n : 0) + d;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    fijar(String(x));
  };
  return (
    <div className={`campo campo-compuesto ${className}`}>
      <button type="button" className="paso" aria-label="Uno menos" tabIndex={-1} disabled={min !== undefined && n <= min} onClick={() => mover(-(salto ?? paso))}>
        <svg aria-hidden viewBox="0 0 14 14" className="size-3.5"><path d="M3 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <input
        id={id}
        name={nombre}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={paso}
        required={requerido}
        value={actual}
        onChange={(e) => fijar(e.target.value)}
        data-regla="entero"
        {...atributos}
        className="min-w-0 text-center tabular-nums"
      />
      {unidad && <span className="adorno-fin" aria-hidden>{unidad}</span>}
      <button type="button" className="paso paso-fin" aria-label="Uno más" tabIndex={-1} disabled={max !== undefined && n >= max} onClick={() => mover(salto ?? paso)}>
        <svg aria-hidden viewBox="0 0 14 14" className="size-3.5"><path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

/* ── Dinero: signo de pesos al frente y la moneda al final ────────── */

interface PropsDinero {
  id?: string;
  nombre?: string;
  valor?: string;
  valorInicial?: string | number;
  alCambiar?: (valor: string) => void;
  requerido?: boolean;
  paso?: string;
  placeholder?: string;
  className?: string;
  atributos?: AtributosCampo;
}

export function CampoDinero({ id, nombre, valor, valorInicial, alCambiar, requerido = false, paso = "0.01", placeholder = "0.00", className = "", atributos }: PropsDinero) {
  return (
    <div className={`campo campo-compuesto ${className}`}>
      <span className="adorno-inicio" aria-hidden>$</span>
      <input
        id={id}
        name={nombre}
        type="number"
        min={0}
        step={paso}
        max={100000}
        inputMode="decimal"
        required={requerido}
        placeholder={placeholder}
        data-dinero=""
        data-regla="dinero"
        {...atributos}
        {...(valor !== undefined ? { value: valor, onChange: (e: React.ChangeEvent<HTMLInputElement>) => alCambiar?.(e.target.value) } : { defaultValue: valorInicial, onChange: (e: React.ChangeEvent<HTMLInputElement>) => alCambiar?.(e.target.value) })}
        className="min-w-0 pl-1! font-titulos text-[1.12rem] tabular-nums"
      />
      <span className="moneda" aria-hidden>MXN</span>
    </div>
  );
}

/* ── Contraseña: con botón para verla ─────────────────────────────── */

export function CampoContrasena({
  id,
  nombre,
  nueva = false,
  requerido = true,
  minimo,
  placeholder,
  className = "",
  autoFocus,
  atributos,
}: {
  id?: string;
  nombre: string;
  /** Contraseña nueva (el navegador no sugiere la guardada). */
  nueva?: boolean;
  requerido?: boolean;
  minimo?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  atributos?: AtributosCampo;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`campo campo-compuesto ${className}`}>
      <input
        id={id}
        name={nombre}
        type={visible ? "text" : "password"}
        required={requerido}
        minLength={minimo}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={nueva ? "new-password" : "current-password"}
        maxLength={72}
        {...atributos}
        className="min-w-0"
      />
      <button
        type="button"
        className="paso paso-fin text-gris"
        aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <IconoOjo tachado={visible} />
      </button>
    </div>
  );
}

/* ── Casilla: se marca con una puntada en cruz ────────────────────── */

export function Casilla({
  nombre,
  valor = "si",
  marcada,
  alCambiar,
  children,
}: {
  nombre?: string;
  valor?: string;
  marcada?: boolean;
  alCambiar?: (marcada: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="casilla">
      <input
        type="checkbox"
        name={nombre}
        value={valor}
        {...(marcada !== undefined ? { checked: marcada } : {})}
        onChange={(e) => alCambiar?.(e.target.checked)}
        className="peer sr-only"
      />
      <span className="caja-casilla" aria-hidden>
        <svg viewBox="0 0 20 20" className="size-full">
          <path className="puntada" d="M5 5l10 10" />
          <path className="puntada puntada-2" d="M15 5 5 15" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}

/* ── Archivo: zona punteada donde se suelta o se elige ────────────── */

export function CampoArchivo({
  id,
  nombre,
  acepta,
  requerido = false,
  texto = "Suelta aquí el archivo o haz clic para elegirlo",
  detalle,
}: {
  id?: string;
  nombre: string;
  acepta?: string;
  requerido?: boolean;
  texto?: string;
  detalle?: string;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [encima, setEncima] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  // Si el formulario se reinicia, también se olvida el archivo mostrado.
  useEffect(() => {
    const form = campo.current?.form;
    if (!form) return;
    const limpiar = () => setArchivo(null);
    form.addEventListener("reset", limpiar);
    return () => form.removeEventListener("reset", limpiar);
  }, []);
  return (
    <div className={`zona-archivo ${encima ? "zona-encima" : ""} ${archivo ? "zona-lista" : ""}`}>
      <input
        ref={campo}
        id={id}
        name={nombre}
        type="file"
        accept={acepta}
        required={requerido}
        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        onDragEnter={() => setEncima(true)}
        onDragLeave={() => setEncima(false)}
        onDrop={() => setEncima(false)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      <span className="text-tinta-suave">
        <IconoArchivo />
      </span>
      {archivo ? (
        <span className="min-w-0">
          <b className="block truncate text-[0.92rem]">{archivo.name}</b>
          <span className="text-[0.8rem] text-gris">
            {(archivo.size / 1024 / 1024).toFixed(archivo.size > 1024 * 1024 ? 1 : 2)} MB · haz clic para cambiarlo
          </span>
        </span>
      ) : (
        <span className="min-w-0">
          <b className="block text-[0.92rem]">{texto}</b>
          {detalle && <span className="text-[0.8rem] text-gris">{detalle}</span>}
        </span>
      )}
    </div>
  );
}
