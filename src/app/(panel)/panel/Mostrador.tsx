"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Habitual } from "@/application/use-cases/asistencias/Habituales";
import type { Candidato, FichaDeEntrada } from "@/application/use-cases/asistencias/Mostrador";
import { MINUTOS_PARA_DESHACER } from "@/domain/entities/Asistencia";
import { METODOS_PAGO, type MetodoPago } from "@/domain/entities/Pago";
import { ID_BUSQUEDA_MOSTRADOR } from "@/presentation/components/AtajoMostrador";
import { Liston } from "@/presentation/components/Liston";
import { HuecoDeParche, Parche } from "@/presentation/components/Parche";
import { HuecoDeSello, Sello } from "@/presentation/components/Sello";
import { Avatar } from "@/presentation/components/Avatar";
import { Icono, type NombreIcono } from "@/presentation/components/Icono";
import { EstadoMembresia } from "@/presentation/components/Insignia";
import { type EstadoLector, TEXTO_ESTADO_LECTOR, useLectorDeHuellas } from "@/presentation/components/huellas/lectorDeHuellas";
import { AyudaLector } from "@/presentation/components/huellas/AyudaLector";
import { describirDiasRestantes, fechaLocal, formatearDinero, formatearFecha, formatearHora, plural } from "@/shared/formato";
import { accionCobrarVisita, accionDeshacerEntrada, accionRegistrarEntrada } from "./acciones";

interface Registro {
  id: string;
  nombre: string;
  registradaEn: string;
  /** Número de visita que acaba de cumplir (contando la de hoy). */
  visita: number;
  /** Ya había entrado hoy: la visita es la misma y no se vuelve a festejar. */
  repetida: boolean;
  cumpleHoy: boolean;
  /** Si se le cobró la visita del día, cuánto y cuál (para anularla al deshacer). */
  cobrado?: number;
  visitaId?: string;
  /** Para volver a mostrar su parche ya "cosido". */
  parche: { iniciales: string; numero: number; desde: string; fotoUrl: string | null };
}

/** Lo que el mostrador muestra mientras nadie está en la búsqueda. */
export interface Ultimo {
  nombre: string;
  hora: string;
}

/**
 * El mostrador: identificar → verificar → registrar (→ deshacer).
 * El cursor nunca sale del campo de búsqueda, para que el siguiente escaneo
 * siempre caiga en su lugar; Enter registra al socio que se está mostrando.
 * Funciona igual con teclado que con lector: el lector "teclea" el número
 * de la credencial y presiona Enter, y si el socio puede pasar se registra solo.
 * Con la huella pasa lo mismo: el socio pone el dedo en el lector y, si puede
 * pasar, su entrada se registra sola; si no, aparece su ficha para decidir.
 * Al elegir a un socio aparece su credencial y, a un lado, si puede pasar.
 */
export function Mostrador({
  zonaHoraria,
  gimnasio,
  habituales = [],
  ultimo = null,
}: {
  zonaHoraria: string;
  gimnasio: string;
  /** Socios que suelen llegar por estas horas y hoy aún no entran. */
  habituales?: Habitual[];
  /** La última entrada del día, para tener contexto mientras nadie llega. */
  ultimo?: Ultimo | null;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [resaltado, setResaltado] = useState(0);
  const [ficha, setFicha] = useState<FichaDeEntrada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [guardando, iniciar] = useTransition();
  const [consultando, setConsultando] = useState(false);
  const trabajando = guardando || consultando;
  const busquedaEnCurso = useRef<AbortController | null>(null);
  const identificando = useRef(false);

  // Lector de huellas: quien pone el dedo se identifica igual que con la credencial escaneada.
  const { estado: lector, reconectar: reconectarLector } = useLectorDeHuellas(async (imagen) => {
    if (identificando.current || guardando) return;
    identificando.current = true;
    setError(null);
    setConsultando(true);
    const r = await enviar<{ socioId: string }>("/api/huellas/identificar", { imagen });
    setConsultando(false);
    identificando.current = false;
    if (!r.ok) return setError(r.error);
    setTexto("");
    abrirFicha(r.valor.socioId, true);
  }, true, (texto) => {
    if (!identificando.current) setError(texto);
  });

  // Búsqueda mientras se escribe: una pausa corta y, si se sigue escribiendo,
  // la consulta anterior se cancela. Va por GET, así nunca bloquea los botones.
  useEffect(() => {
    const buscado = texto.trim();
    busquedaEnCurso.current?.abort();
    if (!buscado) {
      setCandidatos([]);
      return;
    }
    const control = new AbortController();
    busquedaEnCurso.current = control;
    const espera = setTimeout(async () => {
      const r = await buscar(buscado, control.signal);
      if (control.signal.aborted) return;
      setCandidatos(r.ok ? r.valor : []);
      setResaltado(0);
      // Si la búsqueda falló, se dice (antes se quedaba en blanco y parecía que no buscaba).
      if (!r.ok && r.error) setError(r.error);
    }, 120);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  function limpiar() {
    setTexto("");
    setCandidatos([]);
    setFicha(null);
    setError(null);
    campo.current?.focus();
  }

  async function abrirFicha(socioId: string, registrarSiPuede = false) {
    setError(null);
    setConsultando(true);
    const r = await consultar<FichaDeEntrada>(`/api/mostrador/ficha/${encodeURIComponent(socioId)}`);
    setConsultando(false);
    if (!r.ok) return setError(r.error);
    setCandidatos([]);
    if (registrarSiPuede && r.valor.veredicto.tipo === "puede_pasar") return registrar(r.valor);
    setFicha(r.valor);
  }

  function registrar(f: FichaDeEntrada) {
    setError(null);
    iniciar(async () => {
      // La acción ya avisa al servidor que actualice la pantalla (lista, cifras):
      // no hace falta pedir otra recarga aparte.
      const r = await accionRegistrarEntrada(f.socio.id);
      if (!r.ok) return setError(r.error);
      terminar(f, r.valor);
    });
  }

  function cobrarVisita(f: FichaDeEntrada, metodo: MetodoPago) {
    setError(null);
    iniciar(async () => {
      const r = await accionCobrarVisita(f.socio.id, metodo);
      if (!r.ok) return setError(r.error);
      terminar(f, r.valor);
    });
  }

  function terminar(f: FichaDeEntrada, entrada: { id: string; registradaEn: string; cobrado?: number; visitaId?: string }) {
    setRegistro({
      id: entrada.id,
      nombre: f.nombre,
      registradaEn: entrada.registradaEn,
      // Si ya había entrado hoy, este día ya está contado: es la misma visita.
      visita: f.vinoHoy ? f.visitas : f.visitas + 1,
      repetida: f.vinoHoy,
      cumpleHoy: f.cumpleHoy,
      cobrado: entrada.cobrado,
      visitaId: entrada.visitaId,
      parche: {
        iniciales: `${f.socio.nombre[0]}${f.socio.apellidos[0]}`.toUpperCase(),
        numero: f.socio.numero,
        desde: fechaLocal(f.socio.creadoEn, zonaHoraria).slice(0, 4),
        fotoUrl: f.fotoUrl,
      },
    });
    setTexto("");
    setFicha(null);
    campo.current?.focus();
  }

  function deshacer() {
    if (!registro) return;
    iniciar(async () => {
      const r = await accionDeshacerEntrada(registro.id, registro.visitaId);
      if (!r.ok) return setError(r.error);
      setRegistro(null);
      campo.current?.focus();
    });
  }

  /** Enter o el botón: registra al socio mostrado, abre el elegido o busca el número escaneado. */
  async function confirmar() {
    if (trabajando) return;
    if (ficha?.veredicto.tipo === "puede_pasar" && !texto.trim()) return registrar(ficha);

    const buscado = texto.trim();
    if (!buscado) return campo.current?.focus();
    // Un número exacto es una credencial escaneada: se registra sin más pasos si puede pasar.
    if (/^\d+$/.test(buscado)) {
      setConsultando(true);
      const r = await buscar(buscado);
      setConsultando(false);
      const exacto = r.ok ? r.valor.find((c) => c.numero === Number(buscado)) : undefined;
      if (exacto) {
        setTexto("");
        return abrirFicha(exacto.socioId, true);
      }
      return setError(r.ok ? `No hay ningún socio con el número ${buscado}.` : r.error);
    }
    // Si se presionó Enter antes de que llegaran los resultados, se buscan en ese momento.
    let lista = candidatos;
    if (lista.length === 0) {
      setConsultando(true);
      const r = await buscar(buscado);
      setConsultando(false);
      if (!r.ok) return setError(r.error);
      lista = r.valor;
      if (lista.length === 0) return setError(`No se encontró a nadie con "${buscado}".`);
    }
    const elegido = lista[Math.min(resaltado, lista.length - 1)];
    setTexto("");
    abrirFicha(elegido.socioId);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return limpiar();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setResaltado((i) => (candidatos.length ? (i + paso + candidatos.length) % candidatos.length : 0));
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    confirmar();
  }

  return (
    <section aria-labelledby="titulo-mostrador" className="panel px-6 py-[22px]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-mostrador" className="rotulo">Mostrador</h2>
        <div className="flex items-center gap-4">
          <EstadoDelLector estado={lector} reconectar={reconectarLector} />
          <EtiquetaDeMarca gimnasio={gimnasio} />
        </div>
      </div>

      <div className="relative z-20">
        <div className="mt-2.5 flex items-center gap-3.5 border-b-2 border-tinta pb-2.5">
          <Icono nombre="buscar" className="size-[26px]" />
          <label htmlFor={ID_BUSQUEDA_MOSTRADOR} className="sr-only">Buscar socio para registrar su entrada</label>
          <input
            ref={campo}
            id={ID_BUSQUEDA_MOSTRADOR}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
            onKeyDown={alTeclear}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={candidatos.length > 0}
            aria-controls="mostrador-candidatos"
            aria-activedescendant={candidatos[resaltado] ? `candidato-${candidatos[resaltado].socioId}` : undefined}
            placeholder="¿Quién llegó?"
            className="min-w-0 flex-1 bg-transparent font-titulos text-[2.15rem] leading-tight placeholder:text-[#8c867b] focus:outline-none"
          />
          <span className="hidden text-[0.78rem] font-semibold text-gris lg:inline">{trabajando ? "Consultando…" : "Nombre, celular o número"}</span>
          <kbd aria-hidden className="text-gris">F2</kbd>
        </div>

        {candidatos.length > 0 && (
          <ul
            id="mostrador-candidatos"
            role="listbox"
            aria-label="Socios encontrados"
            className="aparece absolute inset-x-0 top-full z-30 mt-2 grid rounded-[12px] bg-elevado p-1.5 shadow-[0_0_0_1px_var(--color-linea-fuerte),0_24px_40px_-20px_rgb(40_25_10/0.4)]"
          >
            {candidatos.map((c, i) => (
              <li
                key={c.socioId}
                id={`candidato-${c.socioId}`}
                role="option"
                aria-selected={i === resaltado}
                onMouseEnter={() => setResaltado(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setTexto("");
                  abrirFicha(c.socioId);
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-2.5 py-2 ${i === resaltado ? "bg-hundido" : ""}`}
              >
                <Avatar nombre={c.nombre} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.nombre}</span>
                  <span className="text-[0.74rem] text-gris">Socio Nº {String(c.numero).padStart(2, "0")}</span>
                </span>
                <EstadoMembresia estado={c.membresia.estado} activo={c.activo} />
                {i === resaltado && <kbd aria-hidden className="text-gris">Enter</kbd>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="aparece mt-4 flex items-center gap-2.5 rounded-[10px] bg-rojo-tenue px-4 py-3 text-[0.9rem] font-semibold text-rojo">
          <Icono nombre="alerta" className="size-5" />
          {error}
        </p>
      )}

      {!ficha && !registro && <AyudaLector estado={lector} reconectar={reconectarLector} className="mt-4" />}

      {ficha ? (
        <FichaMostrador
          key={ficha.socio.id}
          ficha={ficha}
          gimnasio={gimnasio}
          zonaHoraria={zonaHoraria}
          trabajando={trabajando}
          alRegistrar={() => registrar(ficha)}
          alCobrarVisita={(metodo) => cobrarVisita(ficha, metodo)}
          alCerrar={limpiar}
        />
      ) : (
        <div className="mt-7 grid items-center gap-8 md:grid-cols-[210px_minmax(0,1fr)]">
          {registro ? <Parche key={registro.id} className="parche-entra" gimnasio={gimnasio} {...registro.parche} /> : <HuecoDeParche />}
          {registro ? (
            <div role="status" className="sube">
              <p className="rotulo text-verde!">
                Entrada registrada · {formatearHora(registro.registradaEn, zonaHoraria)}
                {registro.cobrado !== undefined && ` · visita cobrada ${formatearDinero(registro.cobrado)}`}
              </p>
              <p className="mt-2 font-titulos text-[2.3rem] leading-tight">{registro.nombre}</p>
              <p className="mt-1.5 text-tinta-suave">
                {registro.cumpleHoy
                  ? `Hoy es su cumpleaños. Visita número ${registro.visita}.`
                  : esHito(registro.visita) && !registro.repetida
                    ? `¡Visita número ${registro.visita}! Una visita redonda.`
                    : `Visita número ${registro.visita}.`}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={deshacer} disabled={trabajando} className="boton-secundario">
                  <Icono nombre="atras" className="size-4" /> Deshacer
                </button>
                <span className="text-[0.8rem] text-gris">
                  {registro.cobrado !== undefined
                    ? `Deshacer también anula el cobro de la visita (${MINUTOS_PARA_DESHACER} minutos).`
                    : `Se puede deshacer durante ${MINUTOS_PARA_DESHACER} minutos.`}
                </span>
              </div>
            </div>
          ) : habituales.length > 0 ? (
            <div>
              <p className="rotulo">Por estas horas suelen llegar</p>
              <ul className="mt-2.5">
                {habituales.map((h) => (
                  <li key={h.socioId}>
                    <button
                      onClick={() => abrirFicha(h.socioId)}
                      className="group flex w-full items-center gap-3 border-b border-dashed border-linea py-2 text-left last:border-0"
                    >
                      <span className="w-12 font-bold tabular-nums text-gris">{h.horaUsual}</span>
                      <span className="flex-1 truncate font-medium group-hover:underline">{h.nombre}</span>
                      <span className="text-[0.78rem] font-bold tracking-[0.08em] text-hilo tabular-nums">Nº {String(h.numero).padStart(2, "0")}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {ultimo && (
                <p className="mt-3 text-[0.82rem] text-gris">
                  Último en llegar: <b className="font-semibold text-tinta-suave">{ultimo.nombre}</b>, a las {ultimo.hora}.
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-titulos text-[1.9rem] leading-tight">
                {lector === "listo" ? "Pon el dedo en el lector o escribe un nombre." : "Escribe un nombre."}
              </p>
              <p className="mt-2 text-tinta-suave">
                {ultimo ? (
                  <>
                    Último en llegar: <b className="font-semibold">{ultimo.nombre}</b>, a las {ultimo.hora}.
                  </>
                ) : (
                  "Todavía no entra nadie hoy."
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * La etiqueta de marca tejida, como la del cuello de una playera: una tira
 * negra con su costura roja, a la altura del rótulo y dentro de la hoja.
 */
function EtiquetaDeMarca({ gimnasio }: { gimnasio: string }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-[20px] items-center rounded-[3px] bg-carbon px-3 text-[0.56rem] font-extrabold tracking-[0.28em] text-[#f2efe8]"
      style={{ backgroundImage: "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.06) 0 1px, transparent 1px 3px)" }}
    >
      <span className="absolute inset-x-[4px] inset-y-[3px] rounded-[2px] border border-dashed border-hilo/80" />
      {gimnasio.toUpperCase()}
    </span>
  );
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Consulta GET al propio programa; los errores llegan como texto para mostrar. */
async function consultar<T>(url: string, senal?: AbortSignal): Promise<Resultado<T>> {
  try {
    const respuesta = await fetch(url, { signal: senal, cache: "no-store" });
    // La sesión venció (dura 12 horas): se lleva a iniciar sesión en vez de dejar de buscar en silencio.
    if (respuesta.status === 401) {
      window.location.assign("/login");
      return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };
    }
    const datos = await respuesta.json();
    return respuesta.ok ? { ok: true, valor: datos as T } : { ok: false, error: datos?.error ?? "No se pudo consultar." };
  } catch {
    return { ok: false, error: senal?.aborted ? "" : "No hubo respuesta del programa. Intenta de nuevo." };
  }
}

/** Consulta POST al propio programa (para mandar la imagen de la huella). */
async function enviar<T>(url: string, cuerpo: unknown): Promise<Resultado<T>> {
  try {
    // Con tiempo límite: si el servidor no contestara, el lector no se queda "ocupado" para siempre.
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (respuesta.status === 401) {
      window.location.assign("/login");
      return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };
    }
    const datos = await respuesta.json();
    return respuesta.ok ? { ok: true, valor: datos as T } : { ok: false, error: datos?.error ?? "No se pudo consultar." };
  } catch {
    return { ok: false, error: "No hubo respuesta del programa. Intenta de nuevo." };
  }
}

/** Si el lector de huellas está listo para recibir un dedo. */
function EstadoDelLector({ estado, reconectar }: { estado: EstadoLector; reconectar: () => void }) {
  const listo = estado === "listo";
  return (
    <span className="hidden items-center gap-2.5 sm:inline-flex">
      <span role="status" className={`inline-flex items-center gap-1.5 text-[0.74rem] font-semibold ${listo ? "text-verde" : "text-gris"}`}>
        <span aria-hidden className={`size-2 rounded-full ${listo ? "bg-verde" : "bg-linea-fuerte"}`} />
        {TEXTO_ESTADO_LECTOR[estado]}
      </span>
      {/* Salida rápida para recepción si el lector está encendido pero no responde. */}
      {(listo || estado === "sin_lector") && (
        <button type="button" onClick={reconectar} className="enlace text-[0.72rem]" title="Si pones el dedo y no pasa nada, reinicia la conexión con el lector">
          ¿No responde? Reiniciar
        </button>
      )}
    </span>
  );
}

const buscar = (texto: string, senal?: AbortSignal) => consultar<Candidato[]>(`/api/mostrador/buscar?q=${encodeURIComponent(texto)}`, senal);

/** Visitas que merecen una felicitación: 10, 25, 50 y cada 50 después. */
function esHito(visita: number) {
  return visita === 10 || visita === 25 || (visita >= 50 && visita % 50 === 0);
}

function FichaMostrador({
  ficha,
  gimnasio,
  zonaHoraria,
  trabajando,
  alRegistrar,
  alCobrarVisita,
  alCerrar,
}: {
  ficha: FichaDeEntrada;
  gimnasio: string;
  zonaHoraria: string;
  trabajando: boolean;
  alRegistrar: () => void;
  alCobrarVisita: (metodo: MetodoPago) => void;
  alCerrar: () => void;
}) {
  const { socio, membresia, veredicto } = ficha;
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const v = describirVeredicto(ficha, zonaHoraria);
  // Un día especial se nota en el parche: cumpleaños o una visita redonda (la de hoy).
  // Si regresa el mismo día, hoy ya está contado: no se suma otra ni se vuelve a festejar.
  const visitaDeHoy = veredicto.tipo === "puede_pasar" && !ficha.vinoHoy ? ficha.visitas + 1 : ficha.visitas;
  const liston = ficha.cumpleHoy ? "Feliz cumpleaños" : veredicto.tipo === "puede_pasar" && !ficha.vinoHoy && esHito(visitaDeHoy) ? `Visita Nº ${visitaDeHoy}` : null;
  const diaDeHoy = Number(new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, day: "numeric" }).format(new Date()));
  const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  return (
    <div onKeyDown={(e) => e.key === "Escape" && alCerrar()} className="aparece">
      <div className="mt-6 grid items-center gap-8 md:grid-cols-[210px_minmax(0,1fr)]">
        <div className="relative grid justify-items-center">
          <Parche
            className="parche-entra"
            gimnasio={gimnasio}
            iniciales={`${socio.nombre[0]}${socio.apellidos[0]}`.toUpperCase()}
            numero={socio.numero}
            desde={fechaLocal(socio.creadoEn, zonaHoraria).slice(0, 4)}
            fotoUrl={ficha.fotoUrl}
            apagado={veredicto.tipo === "baja"}
          />
          {liston && (
            <div className="sello-nuevo -mt-5">
              <Liston texto={liston} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-titulos text-[2.4rem] leading-[1.05]">
              {socio.nombre} {socio.apellidos}
            </h3>
            <button onClick={alCerrar} className="grid size-9 shrink-0 place-items-center rounded-full text-gris hover:bg-hundido hover:text-tinta" title="Cerrar (Esc)">
              <Icono nombre="cerrar" className="size-[18px]" />
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
          <dl className="mt-3.5 flex flex-wrap gap-x-7 gap-y-2 text-[0.9rem]">
            <div>
              <dt className="text-[0.75rem] font-semibold text-gris">Plan</dt>
              <dd className="font-bold">{ficha.planNombre ?? "Sin plan"}</dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-semibold text-gris">{membresia.estado === "vencida" ? "Venció" : "Vence"}</dt>
              <dd className="font-bold">
                {membresia.fechaFin ? `${formatearFecha(membresia.fechaFin)} · ${describirDiasRestantes(membresia.diasRestantes ?? 0).replace(/^Vence /, "").replace(/^Venció /, "")}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-semibold text-gris">Socio desde</dt>
              <dd className="font-bold">{formatearFecha(fechaLocal(socio.creadoEn, zonaHoraria))}</dd>
            </div>
          </dl>

          <p className="mt-4 text-[0.92rem] text-tinta-suave">{v.detalle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`tejida px-5! py-3! text-[0.95rem]! ${v.tejida}`}>
              <Icono nombre={v.icono} className="size-5" /> {v.etiqueta}
            </span>
            {veredicto.tipo === "puede_pasar" && (
              <button onClick={() => alRegistrar()} disabled={trabajando} className="boton py-3!">
                Registrar entrada <kbd>Enter</kbd>
              </button>
            )}
            {veredicto.tipo === "sin_membresia" && (
              <Link href={`/socios/${socio.id}#renovar`} className="boton-secundario">
                Renovar membresía
              </Link>
            )}
            {veredicto.tipo !== "sin_membresia" && (
              <Link href={`/socios/${socio.id}`} className="enlace text-[0.86rem]">
                Ver ficha
              </Link>
            )}
          </div>

          {/* Sin membresía nadie pasa gratis: se cobra la visita del día y se registra la entrada. */}
          {veredicto.tipo === "sin_membresia" &&
            (ficha.visita ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-linea-fuerte p-3.5">
                <span className="text-[0.86rem] font-semibold text-tinta-suave">Visita del día · pago en</span>
                <div role="radiogroup" aria-label="Método de pago" className="flex gap-1 rounded-[9px] border-[1.5px] border-linea-fuerte bg-elevado p-0.5">
                  {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={metodo === m}
                      onClick={() => setMetodo(m)}
                      className={`rounded-[7px] px-2.5 py-1 text-[0.8rem] font-bold ${metodo === m ? "bg-tinta text-[#f2efe8]" : "text-gris hover:text-tinta"}`}
                    >
                      {METODOS_PAGO[m]}
                    </button>
                  ))}
                </div>
                <button onClick={() => alCobrarVisita(metodo)} disabled={trabajando} className="boton ml-auto">
                  Cobrar {formatearDinero(ficha.visita.precio)} y registrar
                </button>
              </div>
            ) : (
              <p className="mt-4 text-[0.84rem] text-gris">
                Para cobrar visitas sueltas, la administración debe crear un plan de 1 día en Planes.
              </p>
            ))}
        </div>
      </div>

      <div className="mt-7 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5 border-t-[1.5px] border-dashed border-linea pt-5">
        <span className="rotulo">Entrenamientos de {nombreDelMes()}</span>
        <p className="justify-self-end text-[0.88rem] text-tinta-suave">
          {ficha.racha > 1 ? (
            <>
              <b className="mr-1 font-titulos text-[1.9rem] font-normal text-tinta">{ficha.racha}</b> días seguidos
            </>
          ) : (
            <>{plural(ficha.sellosDelMes.length, "visita")} este mes</>
          )}
        </p>
        <div className="col-span-2 flex flex-wrap gap-1.5">
          {Array.from({ length: Math.min(diasDelMes, Math.max(8, diaDeHoy)) }, (_, i) => i + 1).map((d) =>
            ficha.sellosDelMes.includes(d) ? <Sello key={d} texto={d} /> : <HuecoDeSello key={d} texto={d} hoy={d === diaDeHoy} />,
          )}
        </div>
      </div>
    </div>
  );
}

const nombreDelMes = () => new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date());

function describirVeredicto({ veredicto, membresia }: FichaDeEntrada, zonaHoraria: string): {
  etiqueta: string;
  detalle: string;
  /** Clase de color de la etiqueta tejida. */
  tejida: string;
  icono: NombreIcono;
} {
  const dias = describirDiasRestantes(membresia.diasRestantes ?? 0);
  switch (veredicto.tipo) {
    case "puede_pasar":
      return membresia.estado === "por_vencer"
        ? { etiqueta: "Puede pasar", detalle: `${dias}. Buen momento para ofrecerle renovar.`, tejida: "bg-ambar!", icono: "reloj" }
        : { etiqueta: "Puede pasar", detalle: `Membresía al corriente. ${dias}.`, tejida: "", icono: "check" };
    case "ya_entro":
      return {
        etiqueta: "Ya entró hoy",
        detalle: `Se registró a las ${formatearHora(veredicto.registradaEn, zonaHoraria)}, ${veredicto.hace < 1 ? "hace un momento" : `hace ${veredicto.hace} min`}.`,
        tejida: "bg-tinta-suave!",
        icono: "reloj",
      };
    case "sin_membresia":
      return {
        etiqueta: membresia.fechaFin ? "Membresía vencida" : "Sin plan",
        detalle: membresia.fechaFin ? `${dias}. Para entrar hoy paga la visita o renueva su membresía.` : "Nunca ha tenido un plan. Para entrar hoy paga la visita o contrata un plan.",
        tejida: "bg-rojo!",
        icono: "alerta",
      };
    case "baja":
      return { etiqueta: "De baja", detalle: "No puede entrar mientras esté de baja. La administración puede reactivarlo desde su ficha.", tejida: "bg-gris!", icono: "cerrar" };
  }
}
