"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PanelFlotante, normalizar, useCerrarAlTocarFuera, usePosicionFlotante } from "./flotante";
import { FlechaHilo, PuntadaX } from "./marcas";

export interface OpcionSelector {
  valor: string;
  texto: string;
  /** Una línea de explicación debajo del texto (opcional). */
  detalle?: string;
}

interface Props {
  /** Para que la `<label htmlFor>` apunte al selector. */
  id?: string;
  /** Nombre del campo al enviar el formulario. */
  nombre?: string;
  opciones: OpcionSelector[];
  /** Controlado: el valor lo lleva quien usa el selector. */
  valor?: string;
  /** Sin controlar: valor con que empieza. */
  valorInicial?: string;
  alCambiar?: (valor: string) => void;
  marcador?: string;
  requerido?: boolean;
  /** Versión chica, para tablas y barras de filtros. */
  compacto?: boolean;
  /** Envía el formulario en cuanto se elige (p. ej. cambiar el perfil de una cuenta). */
  enviarAlElegir?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Selector propio (en lugar del <select> del sistema): se abre como un
 * muestrario cosido, marca lo elegido con una puntada roja y se maneja igual
 * con teclado — flechas, Inicio/Fin, Enter, Esc y escribir para saltar.
 */
export function Selector({
  id,
  nombre,
  opciones,
  valor,
  valorInicial,
  alCambiar,
  marcador = "Elige una opción",
  requerido = false,
  compacto = false,
  enviarAlElegir = false,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const propio = useId();
  const idBoton = id ?? `selector-${propio}`;
  const idLista = `${idBoton}-lista`;
  const [interno, setInterno] = useState(valorInicial ?? "");
  const actual = valor ?? interno;
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [falta, setFalta] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const oculto = useRef<HTMLInputElement>(null);
  const busqueda = useRef({ texto: "", hasta: 0 });
  const elegida = opciones.find((o) => o.valor === actual);
  const altoLista = Math.min(opciones.length * (opciones.some((o) => o.detalle) ? 58 : 40) + 18, 320);
  const conDetalle = opciones.some((o) => o.detalle);
  const pos = usePosicionFlotante(boton, abierto, altoLista, conDetalle ? 300 : 230);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarAlTocarFuera(abierto, [boton, panel], cerrar);

  // Mantener visible la opción activa al moverse con el teclado.
  useEffect(() => {
    if (!abierto || activo < 0) return;
    panel.current?.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  function abrir() {
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === actual)));
    setAbierto(true);
  }

  function elegir(i: number) {
    const opcion = opciones[i];
    if (!opcion) return;
    if (valor === undefined) setInterno(opcion.valor);
    setFalta(false);
    alCambiar?.(opcion.valor);
    setAbierto(false);
    boton.current?.focus();
    if (enviarAlElegir && opcion.valor !== actual) {
      if (oculto.current) oculto.current.value = opcion.valor;
      requestAnimationFrame(() => oculto.current?.form?.requestSubmit());
    }
  }

  function saltarEscribiendo(tecla: string) {
    const ahora = Date.now();
    busqueda.current = { texto: (ahora < busqueda.current.hasta ? busqueda.current.texto : "") + normalizar(tecla), hasta: ahora + 700 };
    const i = opciones.findIndex((o) => normalizar(o.texto).startsWith(busqueda.current.texto));
    if (i >= 0) {
      if (abierto) setActivo(i);
      // Si elegir envía el formulario, escribir solo señala la opción: se confirma con Enter.
      else if (enviarAlElegir) {
        setAbierto(true);
        setActivo(i);
      } else elegir(i);
    }
  }

  function alTeclear(e: React.KeyboardEvent) {
    const ultimo = opciones.length - 1;
    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) saltarEscribiendo(e.key);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActivo((i) => Math.min(ultimo, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActivo((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActivo(0);
        break;
      case "End":
        e.preventDefault();
        setActivo(ultimo);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        elegir(activo);
        break;
      case "Escape":
        e.preventDefault();
        setAbierto(false);
        break;
      case "Tab":
        setAbierto(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) saltarEscribiendo(e.key);
    }
  }

  return (
    <div className={`relative ${compacto ? "inline-block" : "block"} ${className}`}>
      <button
        ref={boton}
        id={idBoton}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={abierto && activo >= 0 ? `${idLista}-${activo}` : undefined}
        aria-label={ariaLabel}
        aria-required={requerido || undefined}
        aria-invalid={falta || undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className={`campo selector ${compacto ? "selector-compacto" : ""} ${abierto ? "selector-abierto" : ""} ${falta ? "campo-error" : ""}`}
      >
        <span className={`min-w-0 flex-1 truncate text-left ${elegida ? "" : "text-[#8a847a]"}`}>{elegida?.texto ?? marcador}</span>
        <span className="selector-flecha">
          <FlechaHilo abierto={abierto} />
        </span>
      </button>
      {/* Lo que viaja con el formulario; el required deja que el navegador avise si falta. */}
      <input
        ref={oculto}
        tabIndex={-1}
        aria-hidden
        name={nombre}
        value={actual}
        required={requerido}
        onChange={() => {}}
        onInvalid={(e) => {
          // En lugar del globo del navegador (que apuntaría a un campo oculto), avisamos aquí mismo.
          e.preventDefault();
          setFalta(true);
          boton.current?.focus();
        }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
      />
      {falta && !abierto && (
        <p role="alert" className="ayuda font-semibold text-rojo!">
          Elige una opción.
        </p>
      )}
      {abierto && (
        <PanelFlotante pos={pos} panel={panel}>
          <ul id={idLista} role="listbox" aria-labelledby={idBoton} className="max-h-[300px] overflow-y-auto overscroll-contain">
            {opciones.map((o, i) => {
              const sel = o.valor === actual;
              return (
                <li
                  key={o.valor}
                  id={`${idLista}-${i}`}
                  data-indice={i}
                  role="option"
                  aria-selected={sel}
                  onPointerEnter={() => setActivo(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => elegir(i)}
                  className={`opcion-muestrario ${i === activo ? "opcion-activa" : ""} ${sel ? "opcion-elegida" : ""}`}
                >
                  <span className="grid size-4 shrink-0 place-items-center">{sel && <PuntadaX tamano={11} />}</span>
                  <span className="min-w-0">
                    <span className="block">{o.texto}</span>
                    {o.detalle && <span className="block text-[0.78rem] font-normal leading-snug text-gris">{o.detalle}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </PanelFlotante>
      )}
    </div>
  );
}
