"use client";

import { useRef, useState, useTransition } from "react";
import { type Dedo, DEDOS, TOQUES_PARA_REGISTRAR } from "@/domain/entities/Huella";
import { Icono } from "@/presentation/components/Icono";
import { Selector } from "@/presentation/components/formulario/Selector";
import { Etiqueta } from "@/presentation/components/formulario/Formulario";
import { useLectorDeHuellas } from "@/presentation/components/huellas/lectorDeHuellas";
import { AyudaLector } from "@/presentation/components/huellas/AyudaLector";
import { accionBorrarHuella, accionRegistrarHuella } from "./huella-acciones";

interface HuellaRegistrada {
  id: string;
  dedo: Dedo;
  /** Cuándo se registró, ya en texto. */
  fecha: string;
}

type Paso = { tipo: "lista" } | { tipo: "preparar" } | { tipo: "tocando"; dedo: Dedo };

/**
 * Huellas del socio en su ficha: cuáles tiene y registrar una nueva.
 * Registro: se elige el dedo, se confirma que el socio firmó su
 * consentimiento y se toma el mismo dedo 4 veces. Cada toque se revisa al
 * momento; si uno no coincide con los anteriores, se repite.
 */
export function RegistroDeHuella({ socioId, nombre, activo, huellas }: { socioId: string; nombre: string; activo: boolean; huellas: HuellaRegistrada[] }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "lista" });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrando, iniciarBorrado] = useTransition();
  // Se confirma aquí mismo y no con window.confirm: en Electron ese cuadro deja
  // la página "sin foco" y el servicio de HID dejaba de entregar las huellas.
  const [porBorrar, setPorBorrar] = useState<string | null>(null);

  function borrar(h: HuellaRegistrada) {
    setPorBorrar(null);
    setError(null);
    setAviso(null);
    iniciarBorrado(async () => {
      const r = await accionBorrarHuella(h.id);
      if (!r.ok) setError(r.error);
      else setAviso("Huella borrada.");
    });
  }

  if (paso.tipo === "preparar") {
    return (
      <Preparar
        nombre={nombre}
        dedoSugerido={(Object.keys(DEDOS) as Dedo[]).find((d) => !huellas.some((h) => h.dedo === d)) ?? "indice_derecho"}
        yaRegistrados={huellas.map((h) => h.dedo)}
        alEmpezar={(dedo) => setPaso({ tipo: "tocando", dedo })}
        alCancelar={() => setPaso({ tipo: "lista" })}
      />
    );
  }

  if (paso.tipo === "tocando") {
    return (
      <Toques
        socioId={socioId}
        dedo={paso.dedo}
        alTerminar={() => {
          setPaso({ tipo: "lista" });
          setError(null);
          setAviso(`Huella registrada (${DEDOS[paso.dedo].toLowerCase()}). Ya puede entrar poniendo el dedo en el lector.`);
        }}
        alCancelar={() => setPaso({ tipo: "lista" })}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {huellas.length === 0 ? (
        <p className="text-[0.9rem] text-tinta-suave">Sin huella registrada.</p>
      ) : (
        <ul>
          {huellas.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 border-b border-dashed border-linea py-2.5 last:border-0">
              <span className="flex items-center gap-2.5 text-[0.9rem] font-semibold">
                <Icono nombre="check" className="size-4 text-verde" />
                {DEDOS[h.dedo]}
                <span className="font-normal text-gris">· {h.fecha}</span>
              </span>
              {porBorrar === h.id ? (
                <span className="flex items-center gap-3 text-[0.8rem]">
                  <span className="text-tinta-suave">¿Borrarla? Ya no podrá entrar con ese dedo.</span>
                  <button type="button" onClick={() => borrar(h)} disabled={borrando} className="enlace font-semibold text-rojo">
                    Sí, borrar
                  </button>
                  <button type="button" onClick={() => setPorBorrar(null)} disabled={borrando} className="enlace">
                    No
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setPorBorrar(h.id)} disabled={borrando} className="enlace text-[0.8rem]">
                  Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p role="status" className="text-[0.86rem] font-semibold text-verde">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[0.86rem] font-semibold text-rojo">
          {error}
        </p>
      )}
      {activo ? (
        <button type="button" onClick={() => (setAviso(null), setError(null), setPaso({ tipo: "preparar" }))} className="boton-secundario w-fit">
          {huellas.length === 0 ? "Registrar huella" : "Registrar otro dedo"}
        </button>
      ) : (
        <p className="text-[0.84rem] text-gris">Para registrar su huella primero hay que reactivarlo.</p>
      )}
    </div>
  );
}

function Preparar({
  nombre,
  dedoSugerido,
  yaRegistrados,
  alEmpezar,
  alCancelar,
}: {
  nombre: string;
  dedoSugerido: Dedo;
  yaRegistrados: Dedo[];
  alEmpezar: (dedo: Dedo) => void;
  alCancelar: () => void;
}) {
  const [dedo, setDedo] = useState<Dedo>(dedoSugerido);
  const [consentimiento, setConsentimiento] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (consentimiento) alEmpezar(dedo);
      }}
    >
      <div>
        <Etiqueta para="dedo">Dedo</Etiqueta>
        <Selector
          id="dedo"
          nombre="dedo"
          valor={dedo}
          alCambiar={(v) => setDedo(v as Dedo)}
          opciones={(Object.keys(DEDOS) as Dedo[]).map((d) => ({ valor: d, texto: DEDOS[d], detalle: yaRegistrados.includes(d) ? "Ya registrado: se reemplaza" : undefined }))}
        />
      </div>
      <label className="flex items-start gap-2.5 text-[0.88rem]">
        <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} required className="mt-1 size-4 shrink-0" />
        <span>
          {nombre} está de acuerdo en que su huella se use solo para registrar sus entradas al gimnasio.
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={!consentimiento} className="boton">
          Empezar
        </button>
        <button type="button" onClick={alCancelar} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Toques({ socioId, dedo, alTerminar, alCancelar }: { socioId: string; dedo: Dedo; alTerminar: () => void; alCancelar: () => void }) {
  const [toques, setToques] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const [ocupado, setOcupadoEstado] = useState(false);
  // También en una referencia: dos toques muy seguidos no deben procesarse a la vez.
  const enCurso = useRef(false);
  const setOcupado = (valor: boolean) => {
    enCurso.current = valor;
    setOcupadoEstado(valor);
  };

  const { estado: lector, reconectar } = useLectorDeHuellas(async (imagen) => {
    if (enCurso.current) return;
    setOcupado(true);
    const r = await enviarToque(imagen, toques);
    if (!r.ok) {
      setOcupado(false);
      return setMensaje({ texto: r.error, error: true });
    }
    // Si el primer toque salió mal, ninguno va a coincidir con él: se toma este como el primero.
    if (!r.coincide && toques.length === 1) {
      setToques([r.plantilla]);
      setOcupado(false);
      return setMensaje({ texto: "El primer toque no se leyó bien; cuenta este como el primero. Pon el mismo dedo otra vez.", error: true });
    }
    if (!r.coincide) {
      setOcupado(false);
      return setMensaje({ texto: `Ese toque no coincide con los anteriores. ¿Es el ${DEDOS[dedo].toLowerCase()}? Pon el mismo dedo otra vez.`, error: true });
    }
    const nuevos = [...toques, r.plantilla];
    setToques(nuevos);
    if (nuevos.length < TOQUES_PARA_REGISTRAR) {
      setOcupado(false);
      return setMensaje({ texto: `Bien. Levanta el dedo y ponlo otra vez (${nuevos.length} de ${TOQUES_PARA_REGISTRAR}).`, error: false });
    }
    setMensaje({ texto: "Guardando la huella…", error: false });
    const guardado = await accionRegistrarHuella({ socioId, dedo, toques: nuevos, consentimiento: true });
    setOcupado(false);
    if (guardado.ok) return alTerminar();
    setToques([]);
    setMensaje({ texto: `${guardado.error} Empieza otra vez desde el primer toque.`, error: true });
  }, true, (texto) => {
    if (!enCurso.current) setMensaje({ texto, error: true });
  });

  return (
    <div className="grid gap-4">
      <p className="font-titulos text-[1.35rem] leading-tight">Pon el {DEDOS[dedo].toLowerCase()} en el lector</p>
      <p className="text-[0.88rem] text-tinta-suave">
        Plano y centrado, sin moverlo. Levántalo entre cada toque. Son {TOQUES_PARA_REGISTRAR} toques del mismo dedo.
      </p>
      <ol aria-label={`${toques.length} de ${TOQUES_PARA_REGISTRAR} toques`} className="flex gap-2">
        {Array.from({ length: TOQUES_PARA_REGISTRAR }, (_, i) => (
          <li
            key={i}
            className={`grid size-10 place-items-center rounded-full border-[1.5px] border-dashed text-[0.85rem] font-bold ${i < toques.length ? "border-verde bg-verde-tenue text-verde" : "border-linea-fuerte text-gris"}`}
          >
            {i < toques.length ? <Icono nombre="check" className="size-4" /> : i + 1}
          </li>
        ))}
      </ol>
      {mensaje && (
        <p role={mensaje.error ? "alert" : "status"} className={`text-[0.88rem] font-semibold ${mensaje.error ? "text-rojo" : "text-verde"}`}>
          {mensaje.texto}
        </p>
      )}
      {lector === "conectando" && <p className="text-[0.84rem] text-gris">Conectando con el lector…</p>}
      <AyudaLector estado={lector} reconectar={reconectar} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={alCancelar} disabled={ocupado} className="boton-secundario w-fit">
          Cancelar
        </button>
        {/* Salida rápida si el lector está encendido pero no responde al poner el dedo. */}
        {lector === "listo" && (
          <button type="button" onClick={reconectar} className="enlace text-[0.8rem]">
            ¿No responde el lector? Reiniciar
          </button>
        )}
      </div>
    </div>
  );
}

async function enviarToque(imagen: string, anteriores: string[]): Promise<{ ok: true; plantilla: string; coincide: boolean } | { ok: false; error: string }> {
  try {
    const respuesta = await fetch("/api/huellas/toque", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imagen, anteriores }),
      cache: "no-store",
      // Con tiempo límite: si el servidor no contestara, el registro no se queda "ocupado" para siempre.
      signal: AbortSignal.timeout(20_000),
    });
    const datos = await respuesta.json();
    return respuesta.ok ? { ok: true, plantilla: datos.plantilla, coincide: datos.coincide } : { ok: false, error: datos?.error ?? "No se pudo leer la huella." };
  } catch {
    return { ok: false, error: "No hubo respuesta del programa. Intenta de nuevo." };
  }
}
