"use client";

import { useActionState, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionAsignarPlan } from "../acciones";

interface OpcionPlan {
  id: string;
  nombre: string;
  precio: number;
  duracion: string;
}

interface Props {
  socioId: string;
  planes: OpcionPlan[];
  esRenovacion: boolean;
  /** El plan que tuvo la última vez; se preselecciona para renovar más rápido. */
  planPreferido?: string;
}

export function FormularioAsignarPlan({ socioId, planes, esRenovacion, planPreferido }: Props) {
  const [estado, accion] = useActionState(accionAsignarPlan, estadoInicial);
  const [planId, setPlanId] = useState(() => planes.find((p) => p.id === planPreferido)?.id ?? planes[0]?.id ?? "");
  const [metodo, setMetodo] = useState(estado.valores?.metodoPago ?? "efectivo");
  const plan = planes.find((p) => p.id === planId);

  if (planes.length === 0) {
    return <p className="text-gris">No hay planes activos. Crea uno en la sección Planes.</p>;
  }

  return (
    <form action={accion} className="space-y-5">
      <MensajeError mensaje={estado.error} />
      <input type="hidden" name="socioId" value={socioId} />

      <fieldset>
        <legend className="etiqueta">Plan</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {planes.map((p) => {
            const elegido = p.id === planId;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tinta ${
                  elegido ? "border-tinta bg-hundido" : "border-linea-fuerte hover:border-gris"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="planId" value={p.id} checked={elegido} onChange={() => setPlanId(p.id)} className="sr-only" />
                  <span aria-hidden className={`grid size-4 place-items-center rounded-full border ${elegido ? "border-rojo" : "border-linea-fuerte"}`}>
                    {elegido && <span className="size-2 rounded-full bg-rojo" />}
                  </span>
                  <span>
                    <span className="block font-semibold leading-tight">{p.nombre}</span>
                    <span className="text-sm text-gris">{p.duracion}</span>
                  </span>
                </span>
                <span className="cifra text-xl">{formatearDinero(p.precio)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="etiqueta">Método de pago</legend>
        <SelectorSegmentado nombre="metodoPago" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="monto" className="etiqueta">Monto cobrado</label>
          <input id="monto" name="monto" type="number" min={0} step="0.01" inputMode="decimal" className="campo tabular-nums" key={planId} defaultValue={plan?.precio} />
          <p className="ayuda">Cámbialo solo si aplicaste un descuento.</p>
        </div>
        <div>
          <label htmlFor="nota" className="etiqueta">Nota <span className="font-normal text-gris">(opcional)</span></label>
          <input id="nota" name="nota" className="campo" placeholder="Ej. descuento de estudiante" defaultValue={estado.valores?.nota} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linea pt-5">
        <BotonEnviar textoEnviando="Registrando…">Registrar pago y activar</BotonEnviar>
        {esRenovacion && <p className="text-sm text-gris">El nuevo periodo empieza al terminar el actual; no pierde días.</p>}
      </div>
    </form>
  );
}

