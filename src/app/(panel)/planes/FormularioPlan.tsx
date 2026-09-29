"use client";

import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCrearPlan } from "./acciones";

export function FormularioPlan() {
  const [estado, accion] = useActionState(accionCrearPlan, estadoInicial);
  const v = estado.valores ?? {};

  return (
    <form action={accion} className="space-y-4">
      <MensajeError mensaje={estado.error} />
      <div>
        <label htmlFor="nombre" className="etiqueta">Nombre</label>
        <input id="nombre" name="nombre" required className="campo" placeholder="Ej. Mensual estudiante" defaultValue={v.nombre} />
      </div>
      <div>
        <label htmlFor="descripcion" className="etiqueta">Descripción <span className="font-normal text-gris">(opcional)</span></label>
        <input id="descripcion" name="descripcion" className="campo" defaultValue={v.descripcion} />
      </div>
      <div>
        <label htmlFor="precio" className="etiqueta">Precio (MXN)</label>
        <input id="precio" name="precio" type="number" min={0} step="0.01" required className="campo" defaultValue={v.precio} />
      </div>
      <fieldset>
        <legend className="etiqueta">Duración</legend>
        <div className="flex gap-2">
          <label htmlFor="duracion" className="sr-only">Cantidad</label>
          <input id="duracion" name="duracion" type="number" min={1} step={1} required className="campo w-24" defaultValue={v.duracion ?? "1"} />
          <label htmlFor="unidad" className="sr-only">Unidad</label>
          <select id="unidad" name="unidad" className="campo" defaultValue={v.unidad ?? "meses"}>
            <option value="dias">días</option>
            <option value="semanas">semanas</option>
            <option value="meses">meses</option>
          </select>
        </div>
      </fieldset>
      <BotonEnviar textoEnviando="Creando…">Crear plan</BotonEnviar>
    </form>
  );
}
