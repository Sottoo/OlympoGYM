"use client";

import { useActionState, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { precioOGratis } from "@/shared/formato";
import { accionCorregirMembresia } from "../acciones";
import { PieDelDialogo } from "./PieDelDialogo";

interface OpcionPlan {
  id: string;
  nombre: string;
  precio: number;
  duracion: string;
}

/**
 * Corregir la membresía más reciente cuando se registró con el plan
 * equivocado: el vencimiento se recalcula desde el mismo día de inicio y el
 * pago queda con el monto y método correctos (en el corte de su día).
 */
export function FormularioCorregirMembresia({
  socioId,
  suscripcionId,
  planes,
  planActual,
  montoActual,
  metodoActual,
  inicio,
  alCancelar,
}: {
  socioId: string;
  suscripcionId: string;
  planes: OpcionPlan[];
  planActual: string;
  montoActual: number;
  metodoActual: string;
  inicio: string;
  alCancelar: () => void;
}) {
  const [estado, accion] = useActionState(accionCorregirMembresia, estadoInicial);
  const [planId, setPlanId] = useState(estado.valores?.planId ?? planActual);
  const [metodo, setMetodo] = useState(estado.valores?.metodoPago ?? metodoActual);
  const plan = planes.find((p) => p.id === planId);

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <input type="hidden" name="suscripcionId" value={suscripcionId} />
      <p className="text-[0.9rem] text-tinta-suave">Sigue empezando el {inicio}; el vencimiento y el pago se recalculan.</p>
      <div>
        <Etiqueta para="planId">Plan correcto</Etiqueta>
        <Selector
          id="planId"
          nombre="planId"
          requerido
          valor={planId}
          alCambiar={setPlanId}
          opciones={planes.map((p) => ({ valor: p.id, texto: `${p.nombre} · ${p.duracion} · ${precioOGratis(p.precio)}` }))}
        />
      </div>
      <div>
        <Etiqueta para="monto-correcto">Monto que se cobró</Etiqueta>
        <CampoDinero
          id="monto-correcto"
          nombre="monto"
          requerido
          key={planId}
          valorInicial={estado.valores?.monto ?? (planId === planActual ? String(montoActual) : String(plan?.precio ?? ""))}
          atributos={{ "data-que": "El monto", "data-falta": "Escribe cuánto se cobró." }}
        />
        <Ayuda para="monto-correcto">Precio del plan: {plan ? precioOGratis(plan.precio) : "—"}.</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Método de pago</legend>
        <SelectorSegmentado nombre="metodoPago" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
      </fieldset>
      <AvisosDelFormulario />
      <PieDelDialogo alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
          Guardar corrección
        </BotonEnviar>
      </PieDelDialogo>
    </Formulario>
  );
}
