"use client";

import { useActionState, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionDevolverMembresia } from "../acciones";
import { PieDelDialogo } from "./PieDelDialogo";

/**
 * Devolución: regresar dinero de una membresía cobrada otro día. Sale de la
 * caja de HOY (los cortes pasados no cambian), lleva su motivo y la membresía
 * termina: desde hoy ya no entra con ella.
 */
export function FormularioDevolucion({
  socioId,
  suscripcionId,
  plan,
  periodo,
  maximo,
  metodoSugerido,
  alCancelar,
}: {
  socioId: string;
  suscripcionId: string;
  plan: string;
  periodo: string;
  /** Lo más que se le puede devolver: lo que pagó por esa membresía, menos lo ya devuelto. */
  maximo: number;
  metodoSugerido: string;
  alCancelar: () => void;
}) {
  const [estado, accion] = useActionState(accionDevolverMembresia, estadoInicial);
  const [metodo, setMetodo] = useState(estado.valores?.metodoPago ?? metodoSugerido);

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <input type="hidden" name="suscripcionId" value={suscripcionId} />
      <p className="text-[0.9rem] text-tinta-suave">
        {plan} · {periodo}. El dinero sale de la caja de <b className="font-semibold text-tinta">hoy</b> y la membresía termina: desde hoy ya no entra con ella.
      </p>
      <div>
        <Etiqueta para="monto-devolucion">Cuánto se le devuelve</Etiqueta>
        <CampoDinero
          id="monto-devolucion"
          nombre="monto"
          requerido
          valorInicial={estado.valores?.monto ?? String(maximo)}
          atributos={{ "data-regla": "precio", "data-que": "Lo que se devuelve", "data-falta": "Escribe cuánto se le devuelve." }}
        />
        <Ayuda para="monto-devolucion">Pagó {formatearDinero(maximo)} por esta membresía: es lo más que se le puede devolver.</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Cómo se le devuelve</legend>
        <SelectorSegmentado nombre="metodoPago" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
      </fieldset>
      <div>
        <Etiqueta para="motivo-devolucion">Motivo</Etiqueta>
        <input
          id="motivo-devolucion"
          name="motivo"
          className="campo"
          required
          maxLength={LIMITES.nota}
          placeholder="Ej. se lesionó y ya no puede entrenar"
          data-regla="texto:3"
          data-falta="Escribe el motivo de la devolución."
          defaultValue={estado.valores?.motivo}
        />
        <Ayuda para="motivo-devolucion" />
      </div>
      <AvisosDelFormulario />
      <PieDelDialogo alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Registrando…" variante="boton-oscuro">
          Registrar devolución
        </BotonEnviar>
      </PieDelDialogo>
    </Formulario>
  );
}
