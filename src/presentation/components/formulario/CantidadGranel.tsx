"use client";

import { useEffect, useRef, useState } from "react";
import { pluralizar } from "@/domain/shared/texto";
import { Icono } from "@/presentation/components/Icono";

export interface DatosGranel {
  porcionGramos: number;
  porcionNombre: string;
  envaseGramos: number | null;
}

type Medida = "botes" | "porciones" | "gramos";

const redondear = (n: number, decimales: number) => Math.round(n * 10 ** decimales) / 10 ** decimales;
const miles = (n: number) => Math.round(n).toLocaleString("es-MX");

/** "2 botes", "1.5 botes", "≈ 60 scoops"… para mostrar una cantidad en gramos como la dice la gente. */
export function enPalabras(granel: DatosGranel, gramos: number): string {
  const porciones = Math.floor(gramos / (granel.porcionGramos || 1));
  const nombre = pluralizar(granel.porcionNombre || "porción", porciones);
  if (granel.envaseGramos) {
    const botes = redondear(gramos / granel.envaseGramos, gramos / granel.envaseGramos >= 10 ? 0 : 1);
    return `${botes.toLocaleString("es-MX")} ${botes === 1 ? "bote" : "botes"} · ≈ ${miles(porciones)} ${nombre}`;
  }
  return `≈ ${miles(porciones)} ${nombre}`;
}

/**
 * Cantidad de un producto a granel, dicha como la dice la gente: "2 botes",
 * "15 scoops" o "500 g". Por dentro siempre se guarda en gramos (campo
 * oculto `nombre`), y debajo se ve la equivalencia para que no haya dudas.
 *
 * Valida por su cuenta (vacío, cero, máximo y `validar`) y, si algo no cuadra,
 * impide enviar el formulario y lo explica en rojo bajo el campo.
 */
export function CantidadGranel({
  id,
  nombre,
  granel,
  gramos,
  alCambiar,
  etiqueta,
  permitirCero = true,
  requerido = false,
  maximo = 1_000_000,
  validar,
  pista,
  compacto = false,
  placeholder = "0",
}: {
  id: string;
  /** Nombre del campo oculto que viaja con el formulario (en gramos). */
  nombre?: string;
  granel: DatosGranel;
  /** Valor actual en gramos. */
  gramos: number;
  /** Recibe los gramos y si hay algo escrito (para distinguir "vacío" de "0"). */
  alCambiar: (gramos: number, escrito: boolean) => void;
  /** Texto para lectores de pantalla (si no hay <label htmlFor={id}>). */
  etiqueta?: string;
  permitirCero?: boolean;
  requerido?: boolean;
  /** Máximo en gramos. */
  maximo?: number;
  /** Regla extra, con la cantidad ya en gramos (p. ej. "no hay tanto para dar de baja"). */
  validar?: (gramos: number) => string | null;
  /** Lo que se ve debajo mientras el campo está vacío. */
  pista?: string;
  /** Versión compacta para listas (sin la línea de ayuda cuando está vacío). */
  compacto?: boolean;
  placeholder?: string;
}) {
  const factores: Record<Medida, number> = {
    botes: granel.envaseGramos ?? 0,
    porciones: granel.porcionGramos || 1,
    gramos: 1,
  };
  const medidas: Medida[] = granel.envaseGramos ? ["botes", "porciones", "gramos"] : ["porciones", "gramos"];
  // Si ya trae un valor, se muestra en la medida en que queda redondo (1 bote, 10 scoops, 250 g).
  const [inicio] = useState(() => {
    const natural: Medida = !gramos
      ? medidas[0]
      : granel.envaseGramos && gramos % granel.envaseGramos === 0
        ? "botes"
        : gramos % factores.porciones === 0
          ? "porciones"
          : "gramos";
    return { medida: natural, texto: gramos ? String(redondear(gramos / factores[natural], 2)) : "" };
  });
  const [medida, setMedida] = useState<Medida>(inicio.medida);
  // Lo escrito se conserva tal cual (para poder teclear "1." o "0,5"); los gramos se calculan de ahí.
  const [texto, setTexto] = useState(inicio.texto);
  const [mostrarError, setMostrarError] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // Si cambia el tamaño del bote o de la porción (al editar el producto), los gramos se recalculan.
  // (Solo si cambia el tamaño; al cambiar de medida la cantidad ya se convirtió y no debe moverse.)
  const factorActual = factores[medida];
  const previo = useRef({ medida, factor: factorActual });
  useEffect(() => {
    const antes = previo.current;
    previo.current = { medida, factor: factorActual };
    if (antes.medida !== medida || antes.factor === factorActual) return;
    const n = Number(texto);
    if (texto !== "" && Number.isFinite(n) && factorActual > 0) alCambiar(Math.round(n * factorActual), true);
  }, [medida, factorActual, texto, alCambiar]);
  // Si el bote deja de existir, se pasa a otra medida.
  const hayBote = Boolean(granel.envaseGramos);
  useEffect(() => {
    if (medida !== "botes" || hayBote) return;
    setMedida("porciones");
    setTexto((t) => (t === "" ? t : String(redondear(gramos / factores.porciones, 2))));
  }, [hayBote, medida, gramos, factores.porciones]);
  // Y si aparece el bote mientras el campo sigue vacío, se propone contar en botes (lo más natural).
  const habiaBote = useRef(hayBote);
  useEffect(() => {
    if (hayBote && !habiaBote.current && texto === "") setMedida("botes");
    habiaBote.current = hayBote;
  }, [hayBote, texto]);

  const nombres: Record<Medida, string> = {
    botes: "botes",
    porciones: pluralizar(granel.porcionNombre || "porción"),
    gramos: "gramos",
  };

  const numero = Number(texto);
  const legible = texto === "" || (Number.isFinite(numero) && /\d/.test(texto));
  let error: string | null = null;
  if (texto === "") error = requerido ? `Escribe la cantidad en ${nombres[medida]}.` : null;
  else if (!legible) error = "Escribe solo un número, por ejemplo 2 o 1.5.";
  else if (gramos <= 0 && !permitirCero) error = "La cantidad debe ser mayor a cero.";
  else if (gramos > maximo) error = `Es demasiado: el máximo es ${miles(maximo)} g.`;
  else error = validar?.(gramos) ?? null;

  // La validez del campo bloquea el envío del formulario, igual que en los demás campos.
  useEffect(() => {
    campo.current?.setCustomValidity(error ?? "");
  }, [error]);

  function escribir(valor: string) {
    const limpio = valor.replace(/,/g, ".").replace(/[^\d.]/g, "");
    setTexto(limpio);
    const n = Number(limpio);
    alCambiar(Number.isFinite(n) ? Math.round(n * factores[medida]) : 0, limpio !== "");
  }

  function cambiarMedida(nueva: Medida) {
    setMedida(nueva);
    // Se conserva la cantidad real: 2 botes pasan a ser 1,814 g, no 2 g.
    setTexto(gramos ? String(redondear(gramos / factores[nueva], nueva === "gramos" ? 0 : 2)) : "");
    campo.current?.focus();
  }

  const equivalencia = [
    medida !== "gramos" && `${miles(gramos)} g`,
    medida !== "porciones" && `≈ ${miles(Math.floor(gramos / factores.porciones))} ${pluralizar(granel.porcionNombre || "porción", Math.floor(gramos / factores.porciones))}`,
    medida !== "botes" && granel.envaseGramos && (() => {
      const b = redondear(gramos / granel.envaseGramos!, 1);
      return `${b.toLocaleString("es-MX")} ${b === 1 ? "bote" : "botes"}`;
    })(),
  ]
    .filter(Boolean)
    .join(" · ");

  const enRojo = mostrarError && error;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          ref={campo}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          placeholder={placeholder}
          onChange={(e) => {
            escribir(e.target.value);
            if (mostrarError) setMostrarError(true);
          }}
          onBlur={() => texto !== "" && setMostrarError(true)}
          onInvalid={(e) => {
            // Sin globo del navegador: el aviso se escribe bajo el campo.
            e.preventDefault();
            setMostrarError(true);
            // El cursor va al primer campo con problema del formulario (si es este).
            const el = e.currentTarget;
            const primero = Array.from(el.form?.elements ?? []).find((x) => x instanceof HTMLInputElement && !x.validity.valid);
            if (primero === el) {
              el.focus();
              el.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          }}
          aria-label={etiqueta}
          aria-invalid={enRojo ? true : undefined}
          aria-describedby={`${id}-equivale`}
          className="campo w-28 text-center tabular-nums"
          data-propio
          data-lector-propio
        />
        <div role="radiogroup" aria-label="Medida" className="inline-flex gap-1 rounded-[10px] border-[1.5px] border-linea-fuerte bg-elevado p-1">
          {medidas.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={medida === m}
              onClick={() => cambiarMedida(m)}
              className={`rounded-[7px] px-3 py-1 text-[0.82rem] font-bold ${medida === m ? "bg-tinta text-[#f2efe8]" : "text-gris hover:text-tinta"}`}
            >
              {nombres[m]}
            </button>
          ))}
        </div>
      </div>
      {nombre && <input type="hidden" name={nombre} value={texto === "" ? "" : String(gramos)} />}
      <p id={`${id}-equivale`} className={`mensaje-campo mt-0! ${enRojo ? "mensaje-error" : ""}`} aria-live="polite">
        {enRojo ? (
          <>
            <Icono nombre="alerta" className="mt-px size-[15px] shrink-0" />
            <span>{error}</span>
          </>
        ) : texto === "" || !legible ? (
          compacto ? null : <span>{pista ?? `Escribe la cantidad en ${nombres[medida]}; si prefieres, cambia la medida.`}</span>
        ) : (
          <span>
            = <strong className="font-semibold text-tinta">{equivalencia}</strong>
          </span>
        )}
      </p>
    </div>
  );
}
