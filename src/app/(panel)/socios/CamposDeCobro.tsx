"use client";

import { useState } from "react";
import { DIAS_PARA_COBRO_ATRASADO, METODOS_PAGO } from "@/domain/entities/Pago";
import { sumarDias } from "@/domain/shared/fechas";
import { LIMITES } from "@/domain/shared/reglas";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { CampoFecha, describirFecha } from "@/presentation/components/formulario/CampoFecha";
import { Ayuda, Etiqueta } from "@/presentation/components/formulario/Formulario";
import { BotonDeRopa } from "@/presentation/components/formulario/marcas";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { precioOGratis } from "@/shared/formato";

export interface OpcionPlan {
  id: string;
  nombre: string;
  precio: number;
  duracion: string;
  /** El plan de 1 día: se cobra la visita y se anota la entrada de hoy. */
  esVisita?: boolean;
}

interface Props {
  planes: OpcionPlan[];
  planPreferido?: string;
  puedeCambiarMonto: boolean;
  /** Si puede anotar un cobro de otro día (cambia cortes pasados: solo con permiso de corregir cobros). */
  puedeCambiarFecha: boolean;
  /** Lo que se había escrito si el servidor regresó un error. */
  valores?: Record<string, string>;
  /** Avisa qué plan quedó elegido (para el texto del botón). */
  alElegir?: (plan: OpcionPlan | undefined) => void;
  /** Pista bajo los planes cuando se elige una membresía. */
  ayudaMembresia?: string;
}

/** Plan, método de pago, monto y nota: lo mismo al inscribir que al renovar. */
export function CamposDeCobro({ planes, planPreferido, puedeCambiarMonto, puedeCambiarFecha, valores, alElegir, ayudaMembresia = "La membresía empieza hoy." }: Props) {
  const [elegido, setElegido] = useState(() => valores?.planId ?? planPreferido ?? "");
  const [metodo, setMetodo] = useState(valores?.metodoPago ?? "efectivo");
  // Si se olvidó registrar un cobro, se anota con su fecha real (hasta 31 días atrás).
  const [otroDia, setOtroDia] = useState(puedeCambiarFecha && Boolean(valores?.fecha));
  // Si la lista cambia con la pantalla abierta (se creó o desactivó un plan),
  // nunca queda "ninguno": se toma el preferido o el primero.
  const plan = planes.find((p) => p.id === elegido) ?? planes.find((p) => p.id === planPreferido) ?? planes[0];
  const planId = plan?.id ?? "";

  function elegir(p: OpcionPlan) {
    setElegido(p.id);
    alElegir?.(p);
  }

  return (
    <div className="grid gap-5">
      <input type="hidden" name="planId" value={planId} />
      <fieldset>
        <legend className="etiqueta">Plan</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {planes.map((p) => {
            const marcado = p.id === planId;
            return (
              <label key={p.id} className={`tarjeta-opcion justify-between ${p.esVisita ? "border-dashed" : ""}`}>
                <input type="radio" name="planId-opcion" value={p.id} checked={marcado} onChange={() => elegir(p)} className="sr-only" />
                <BotonDeRopa marcado={marcado} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-tight">{p.nombre}</span>
                  <span className="text-sm text-gris">{p.esVisita ? "Solo hoy · entra en este momento" : p.duracion}</span>
                </span>
                <span className="cifra text-xl">{precioOGratis(p.precio)}</span>
              </label>
            );
          })}
        </div>
        <Ayuda para="planId">
          {plan?.esVisita
            ? "Se cobra la visita y su entrada de hoy queda anotada."
            : otroDia && ayudaMembresia === "La membresía empieza hoy."
              ? "La membresía empieza el día en que se cobró."
              : ayudaMembresia}
        </Ayuda>
      </fieldset>

      {/* Pregunta a la vista (no una casilla escondida): olvidarla manda al corte de hoy
          dinero de otro día y hace que la membresía empiece y venza tarde. */}
      {puedeCambiarFecha && !plan?.esVisita && (
        <fieldset className="grid gap-2.5">
          <legend className="etiqueta">¿Cuándo pagó?</legend>
          <SelectorSegmentado
            nombre="cuandoPago"
            opciones={{ hoy: "Hoy", otro: "Otro día (se registra tarde)" }}
            valor={otroDia ? "otro" : "hoy"}
            alCambiar={(v) => setOtroDia(v === "otro")}
          />
          {otroDia ? (
            <FechaDelCobro inicial={valores?.fecha} />
          ) : (
            <p className="mensaje-campo">
              El dinero entra en el <b className="font-semibold text-tinta">corte de hoy</b>. Si pagó otro día, elige «Otro día» para que su membresía y el corte tomen esa
              fecha.
            </p>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className="etiqueta">Método de pago</legend>
        <SelectorSegmentado nombre="metodoPago" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {puedeCambiarMonto && !plan?.esVisita ? (
          <div>
            <Etiqueta para="monto">Monto cobrado</Etiqueta>
            <CampoDinero
              id="monto"
              nombre="monto"
              requerido
              key={planId}
              // Si hubo un error se conserva lo que se escribió (por ejemplo, con descuento).
              valorInicial={valores?.planId === planId && valores.monto ? valores.monto : plan?.precio}
              atributos={{ "data-que": "El monto", "data-falta": "Escribe cuánto se cobró." }}
            />
            <Ayuda para="monto">Precio del plan: {plan ? precioOGratis(plan.precio) : "—"}.</Ayuda>
          </div>
        ) : (
          <div>
            <p className="etiqueta">Monto a cobrar</p>
            <p className="cifra text-[1.9rem] leading-[2.75rem]">{plan ? precioOGratis(plan.precio) : "—"}</p>
            <p className="mensaje-campo">{plan?.esVisita ? "El precio de la visita." : "El precio del plan. Los descuentos los autoriza la administración."}</p>
          </div>
        )}
        <div>
          <Etiqueta para="nota" opcional>
            Nota
          </Etiqueta>
          <input
            id="nota"
            name="nota"
            className="campo"
            maxLength={LIMITES.nota}
            data-contador=""
            placeholder={puedeCambiarMonto ? "Ej. descuento de estudiante" : "Ej. pagó con billete de $1,000"}
            defaultValue={valores?.nota}
          />
          <Ayuda para="nota" maximo={LIMITES.nota} />
        </div>
      </div>
    </div>
  );
}

/**
 * La fecha real del cobro. Se pinta solo al marcar la casilla (en el
 * navegador), así el día de hoy sale de la computadora del gimnasio.
 */
function FechaDelCobro({ inicial }: { inicial?: string }) {
  const [hoy] = useState(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
  const minimo = sumarDias(hoy, -DIAS_PARA_COBRO_ATRASADO);
  return (
    <div className="aparece max-w-xs">
      <Etiqueta para="fecha">Fecha en que pagó</Etiqueta>
      <CampoFecha
        id="fecha"
        nombre="fecha"
        requerido
        min={minimo}
        max={hoy}
        valorInicial={inicial || sumarDias(hoy, -1)}
        describir={(f) => `Se cobró el ${describirFecha(f)}.`}
      />
      <Ayuda para="fecha">
        Su membresía empieza ese día y el dinero entra en el corte de ese día, no en el de hoy. Hasta {DIAS_PARA_COBRO_ATRASADO} días atrás.
      </Ayuda>
    </div>
  );
}
