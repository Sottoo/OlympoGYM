"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  FUERA_DE_CODIGO,
  FUERA_DE_NOMBRE,
  FUERA_DE_USUARIO,
  capitalizarNombre,
  formatearCelularParcial,
  limpiarEspacios,
  normalizarCelular,
  revisarCelular,
  revisarContrasenaNueva,
  revisarDinero,
  revisarEntero,
  revisarNombre,
  revisarUsuario,
} from "@/domain/shared/reglas";
import { Icono } from "../Icono";
import { MensajeError } from "../Mensajes";

/**
 * Formulario con validación de verdad, sin los globos del navegador.
 *
 * Cada campo declara su regla con atributos (data-regla, data-filtro,
 * data-falta…) y este componente:
 *  · quita al escribir lo que no cabe (letras en un celular, números en un nombre)
 *    y lo dice en voz baja bajo el campo;
 *  · marca el campo y explica qué falta en cuanto se sale de él;
 *  · al guardar, señala todo lo pendiente y lleva el cursor al primero;
 *  · muestra los errores que regresa el servidor junto al campo que corresponde.
 *
 * Bajo cada campo va <Ayuda para="nombre">: la pista de qué escribir, que se
 * convierte en el aviso cuando algo no cuadra.
 */

type Regla = (valor: string, formulario: HTMLFormElement) => string | null;
type ReglaRemota = (valor: string) => Promise<string | null>;

interface Contexto {
  errores: Record<string, string>;
  notas: Record<string, string>;
  largos: Record<string, number>;
  intento: boolean;
  errorGeneral?: string;
  tituloError?: string | null;
}

const ContextoFormulario = createContext<Contexto>({ errores: {}, notas: {}, largos: {}, intento: false });

interface Props extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> {
  action: (formData: FormData) => void;
  /** Lo que regresó la acción del servidor: su error se pone junto al campo indicado. */
  estado?: { error?: string; campo?: string };
  /** Reglas propias de este formulario, por nombre de campo. */
  reglas?: Record<string, Regla>;
  /** Revisiones que consultan la base (p. ej. celular repetido); corren al salir del campo. */
  remotas?: Record<string, ReglaRemota>;
  ref?: React.Ref<HTMLFormElement>;
  /** Si es true, el formulario coloca <AvisosDelFormulario /> donde quiera (p. ej. dentro de su relleno). */
  avisosManuales?: boolean;
  /** Título del aviso general de error ("No se pudo guardar." por omisión; null para ninguno). */
  tituloError?: string | null;
}

const QUE_FILTRA: Record<string, { fuera: RegExp; nota: string }> = {
  nombre: { fuera: FUERA_DE_NOMBRE, nota: "Aquí solo van letras." },
  usuario: { fuera: FUERA_DE_USUARIO, nota: "Empieza con letra; solo minúsculas sin acentos, números, punto o guion." },
  codigo: { fuera: FUERA_DE_CODIGO, nota: "Solo letras sin acento, números y guion." },
  telefono: { fuera: /\D/g, nota: "Aquí solo van números." },
};

function esGestionado(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (!el.name || el.dataset.propio !== undefined || el.getAttribute("aria-hidden") === "true") return false;
  return !(el instanceof HTMLInputElement && ["hidden", "checkbox", "radio", "file", "submit", "button"].includes(el.type));
}

/** Mensaje claro a partir de lo que el navegador ya sabe del campo. */
function mensajeNativo(el: HTMLInputElement | HTMLTextAreaElement): string | null {
  const v = el.validity;
  const que = el.dataset.que ?? "El valor";
  const dinero = el.dataset.dinero !== undefined;
  if (v.valueMissing) return el.dataset.falta ?? "Completa este dato.";
  if (v.badInput) return "Escribe solo números.";
  if (v.rangeUnderflow) {
    const min = Number((el as HTMLInputElement).min);
    return dinero ? `${que} no puede ser menor a $${min}.` : `${que} debe ser al menos ${min}.`;
  }
  if (v.rangeOverflow) return `${que} no puede pasar de ${dinero ? "$" : ""}${Number((el as HTMLInputElement).max).toLocaleString("es-MX")}.`;
  if (v.stepMismatch) return dinero ? "Usa máximo 2 decimales." : "Escribe un número entero, sin decimales.";
  if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres; llevas ${el.value.length}.`;
  if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
  if (v.patternMismatch) return el.dataset.patron ?? "Revisa el formato.";
  if (v.typeMismatch) return "Revisa el formato.";
  return null;
}

/** Reglas que se piden con data-regla="…". */
function reglaIntegrada(regla: string, valor: string, el: HTMLInputElement | HTMLTextAreaElement, form: HTMLFormElement): string | null {
  const [nombre, extra] = regla.split(":");
  const que = el.dataset.que;
  switch (nombre) {
    case "nombre":
      return revisarNombre(valor, "nombre");
    case "apellidos":
      return revisarNombre(valor, "apellidos");
    case "telefono":
      return revisarCelular(valor);
    case "usuario":
      return revisarUsuario(valor);
    case "contrasena":
      return revisarContrasenaNueva(valor);
    case "coincide": {
      const otro = form.elements.namedItem(extra) as HTMLInputElement | null;
      return otro && otro.value && valor !== otro.value ? "No coincide con la de al lado. Escríbelas igual." : null;
    }
    case "dinero":
      return revisarDinero(Number(valor), { que });
    case "precio":
      return revisarDinero(Number(valor), { minExclusivo: true, que });
    case "entero":
      return revisarEntero(Number(valor), { min: Number(el.getAttribute("min") ?? 0), max: el.getAttribute("max") ? Number(el.getAttribute("max")) : undefined, que });
    case "texto": {
      const limpio = limpiarEspacios(valor);
      const minimo = Number(extra ?? 2);
      if (limpio.length < minimo) return `Escribe al menos ${minimo} caracteres.`;
      return /[\p{L}\d]/u.test(limpio) ? null : "Escribe algo con letras o números.";
    }
    default:
      return null;
  }
}

export function Formulario({ action, estado, reglas, remotas, children, ref, onSubmit, avisosManuales = false, tituloError, ...resto }: Props) {
  const formulario = useRef<HTMLFormElement | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [largos, setLargos] = useState<Record<string, number>>({});
  const [intento, setIntento] = useState(false);
  const tocados = useRef(new Set<string>());
  const remotos = useRef<Record<string, { valor: string; mensaje: string | null }>>({});
  const relojes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const asignarRef = useCallback(
    (el: HTMLFormElement | null) => {
      formulario.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.RefObject<HTMLFormElement | null>).current = el;
    },
    [ref],
  );

  /** Calcula el mensaje del campo y lo deja como su validez (eso bloquea el envío). */
  const revisar = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement): string | null => {
      const form = formulario.current;
      if (!form) return null;
      el.setCustomValidity("");
      const valor = el.value;
      let mensaje: string | null = null;
      if (valor.trim() === "") {
        mensaje = el.required ? (el.dataset.falta ?? "Completa este dato.") : null;
      } else {
        if (el.dataset.regla) mensaje = reglaIntegrada(el.dataset.regla, valor, el, form);
        if (!mensaje && reglas?.[el.name]) mensaje = reglas[el.name](valor, form);
        const remoto = remotos.current[el.name];
        if (!mensaje && remoto && remoto.valor === valor) mensaje = remoto.mensaje;
        if (!mensaje) mensaje = mensajeNativo(el);
      }
      el.setCustomValidity(mensaje ?? "");
      return mensaje;
    },
    [reglas],
  );

  const mostrar = useCallback((nombre: string, mensaje: string | null) => {
    setErrores((previos) => {
      if ((previos[nombre] ?? null) === mensaje) return previos;
      const nuevos = { ...previos };
      if (mensaje) nuevos[nombre] = mensaje;
      else delete nuevos[nombre];
      return nuevos;
    });
  }, []);

  const anotar = useCallback((nombre: string, nota: string) => {
    setNotas((p) => ({ ...p, [nombre]: nota }));
    clearTimeout(relojes.current[nombre]);
    relojes.current[nombre] = setTimeout(() => setNotas(({ [nombre]: _, ...resto }) => resto), 2600);
  }, []);

  const campos = useCallback(() => Array.from(formulario.current?.elements ?? []).filter(esGestionado), []);

  /** Revisa todo (se llama justo antes de enviar, para que el navegador decida con datos frescos). */
  const revisarTodo = useCallback(() => {
    for (const el of campos()) {
      const mensaje = revisar(el);
      tocados.current.add(el.name);
      mostrar(el.name, mensaje);
    }
  }, [campos, revisar, mostrar]);

  // Validez inicial (valores precargados al editar) y descripción accesible de cada campo.
  useEffect(() => {
    for (const el of campos()) {
      revisar(el);
      const ayuda = document.getElementById(`ayuda-${el.name}`);
      if (ayuda && !el.getAttribute("aria-describedby")) el.setAttribute("aria-describedby", ayuda.id);
      if (el.maxLength > 0 && el.dataset.contador !== undefined) setLargos((p) => ({ ...p, [el.name]: el.value.length }));
    }
  }, [campos, revisar]);

  // Marca en rojo los campos con error (también los compuestos, por su contenedor).
  useEffect(() => {
    for (const el of campos()) {
      if (errores[el.name]) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }
  }, [errores, campos]);

  // Error del servidor sobre un campo concreto: se marca y se lleva ahí el cursor.
  useEffect(() => {
    if (!estado?.error || !estado.campo) return;
    const el = formulario.current?.elements.namedItem(estado.campo);
    mostrar(estado.campo, estado.error);
    if (el instanceof HTMLElement) {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [estado, mostrar]);

  function alEscribir(e: React.FormEvent<HTMLFormElement>) {
    const el = e.target as Element;
    if (!esGestionado(el)) return;
    const filtro = el.dataset.filtro;
    if (filtro && QUE_FILTRA[filtro]) {
      const { fuera, nota } = QUE_FILTRA[filtro];
      const original = el.value;
      const texto = filtro === "usuario" ? original.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "") : original;
      const antes = texto.slice(0, el.selectionStart ?? texto.length);
      let limpio: string;
      let cursor: number;
      if (filtro === "telefono" && /^\s*\+/.test(texto)) {
        // Con lada internacional (+52…) se deja escribir libre; al salir queda en 10 dígitos.
        const fueraDeLada = /[^\d\s()+-]/g;
        limpio = texto.replace(fueraDeLada, "");
        if (limpio !== texto) anotar(el.name, nota);
        cursor = antes.replace(fueraDeLada, "").length;
      } else if (filtro === "telefono") {
        // El celular se acomoda solo mientras se escribe: 55 1234 5678.
        let digitos = texto.replace(/\D/g, "");
        if (digitos.length > 10) {
          const normal = normalizarCelular(texto);
          digitos = normal.length === 10 ? normal : digitos.slice(0, 10);
          anotar(el.name, "El celular lleva 10 dígitos (sin el +52).");
        } else if (/[^\d\s()+-]/.test(texto)) anotar(el.name, nota);
        limpio = formatearCelularParcial(digitos);
        const digitosAntes = Math.min(antes.replace(/\D/g, "").length, digitos.length);
        cursor = 0;
        for (let vistos = 0; cursor < limpio.length && vistos < digitosAntes; cursor++) if (/\d/.test(limpio[cursor])) vistos++;
      } else {
        limpio = texto.replace(fuera, "");
        if (limpio !== texto) anotar(el.name, nota);
        cursor = antes.replace(fuera, "").length;
      }
      if (limpio !== original) {
        el.value = limpio;
        el.setSelectionRange(cursor, cursor);
      }
    }
    if (el.dataset.contador !== undefined) setLargos((p) => ({ ...p, [el.name]: el.value.length }));
    const mensaje = revisar(el);
    // Mientras se corrige, el aviso desaparece en cuanto el dato ya es válido.
    if (tocados.current.has(el.name) || errores[el.name]) mostrar(el.name, mensaje);
    // Si otro campo depende de este (repetir contraseña), también se vuelve a revisar.
    for (const otro of campos()) {
      if (otro !== el && otro.dataset.regla === `coincide:${el.name}`) {
        const m = revisar(otro);
        if (tocados.current.has(otro.name)) mostrar(otro.name, m);
      }
    }
  }

  async function alSalir(e: React.FocusEvent<HTMLFormElement>) {
    const el = e.target as Element;
    if (!esGestionado(el)) return;
    if (el.dataset.formato === "nombre" && el.value.trim()) el.value = capitalizarNombre(el.value);
    else if (el.dataset.filtro === "telefono" && normalizarCelular(el.value).length === 10) el.value = formatearCelularParcial(normalizarCelular(el.value));
    else if (el.value !== el.value.trim() && el.type !== "password") el.value = limpiarEspacios(el.value);
    if (el.value.trim()) tocados.current.add(el.name);
    let mensaje = revisar(el);
    if (tocados.current.has(el.name)) mostrar(el.name, mensaje);
    const remota = remotas?.[el.name];
    if (remota && !mensaje && el.value.trim()) {
      const valor = el.value;
      const resultado = await remota(valor).catch(() => null);
      remotos.current[el.name] = { valor, mensaje: resultado };
      if (el.value === valor) {
        mensaje = revisar(el);
        mostrar(el.name, mensaje);
      }
    }
  }

  function alTeclear(e: React.KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLInputElement;
    // En los campos numéricos el navegador deja escribir "e", "+" o "-": aquí no.
    if (el instanceof HTMLInputElement && el.type === "number" && ["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
      anotar(el.name, "Aquí solo van números.");
    }
  }

  function antesDeEnviar(e: React.MouseEvent<HTMLFormElement>) {
    // Los botones − y + cambian el número sin teclear: se revisa en cuanto se pinta el valor nuevo.
    const paso = (e.target as Element).closest("button.paso");
    const campo = paso?.closest(".campo-compuesto")?.querySelector("input");
    if (campo && esGestionado(campo)) {
      setTimeout(() => {
        const mensaje = revisar(campo);
        if (tocados.current.has(campo.name)) mostrar(campo.name, mensaje);
      });
      return;
    }
    const boton = (e.target as Element).closest("button");
    if (!boton || boton.type !== "submit" || boton.form !== formulario.current) return;
    revisarTodo();
    const form = formulario.current;
    if (form && !form.checkValidity()) {
      setIntento(true);
      const primero = Array.from(form.elements).find((x) => x instanceof HTMLInputElement || x instanceof HTMLTextAreaElement ? !x.validity.valid : false);
      if (primero && esGestionado(primero)) {
        primero.focus();
        primero.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  return (
    <ContextoFormulario.Provider value={{ errores, notas, largos, intento, errorGeneral: estado?.campo ? undefined : estado?.error, tituloError }}>
      <form
        {...resto}
        ref={asignarRef}
        action={action}
        onInputCapture={alEscribir}
        onBlurCapture={alSalir}
        onKeyDownCapture={alTeclear}
        onClickCapture={antesDeEnviar}
        onInvalidCapture={(e) => {
          // Sin globo del navegador: el aviso ya está escrito bajo el campo.
          const el = e.target as Element;
          if (esGestionado(el)) {
            e.preventDefault();
            mostrar(el.name, el.validationMessage || revisar(el));
          }
        }}
        onSubmit={(e) => {
          setIntento(false);
          onSubmit?.(e);
        }}
      >
        {!avisosManuales && <AvisosDelFormulario />}
        {children}
      </form>
    </ContextoFormulario.Provider>
  );
}

/** El error general del servidor y, tras intentar guardar, cuántos campos faltan. */
export function AvisosDelFormulario() {
  const { errores, intento, errorGeneral, tituloError } = useContext(ContextoFormulario);
  const pendientes = Object.keys(errores).length;
  return (
    <>
      <MensajeError mensaje={errorGeneral} titulo={tituloError} />
      {intento && pendientes > 0 && (
        <p role="alert" className="aparece aviso-pendientes">
          <Icono nombre="alerta" className="mt-0.5 size-[18px] shrink-0 text-rojo" />
          <span>
            <strong className="font-semibold text-rojo">Faltan datos por corregir.</strong>{" "}
            {pendientes === 1 ? "Revisa el campo marcado en rojo." : `Revisa los ${pendientes} campos marcados en rojo.`}
          </span>
        </p>
      )}
    </>
  );
}

/**
 * La línea bajo el campo: pista discreta de qué escribir; si algo no cuadra,
 * ahí mismo aparece el aviso. Con `maximo`, cuenta los caracteres.
 */
export function Ayuda({ para, children, maximo, className = "" }: { para: string; children?: React.ReactNode; maximo?: number; className?: string }) {
  const { errores, notas, largos } = useContext(ContextoFormulario);
  const error = errores[para];
  const nota = notas[para];
  const largo = largos[para] ?? 0;
  const contador = maximo !== undefined && largo > 0 && (
    <span className={`ml-auto shrink-0 tabular-nums ${largo >= maximo ? "font-semibold text-rojo" : ""}`}>
      {largo}/{maximo}
    </span>
  );
  if (error) {
    return (
      <p id={`ayuda-${para}`} className={`mensaje-campo mensaje-error ${className}`} aria-live="polite">
        <Icono nombre="alerta" className="mt-px size-[15px] shrink-0" />
        <span>{error}</span>
        {contador}
      </p>
    );
  }
  if (nota) {
    return (
      <p id={`ayuda-${para}`} className={`mensaje-campo mensaje-nota ${className}`} aria-live="polite">
        <span>{nota}</span>
        {contador}
      </p>
    );
  }
  if (!children && !contador) return <p id={`ayuda-${para}`} className="sr-only" aria-live="polite" />;
  return (
    <p id={`ayuda-${para}`} className={`mensaje-campo ${className}`} aria-live="polite">
      {children && <span>{children}</span>}
      {contador}
    </p>
  );
}

/** Etiqueta de un campo, con "(opcional)" discreto cuando aplica. */
export function Etiqueta({ para, children, opcional = false }: { para: string; children: React.ReactNode; opcional?: boolean }) {
  return (
    <label htmlFor={para} className="etiqueta">
      {children}
      {opcional && <span className="font-normal text-gris"> (opcional)</span>}
    </label>
  );
}
