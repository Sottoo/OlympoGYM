"use client";

import { useActionState, useState } from "react";
import { MOTIVOS_BAJA } from "@/domain/entities/Socio";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Selector } from "@/presentation/components/formulario/Selector";
import { LIMITES } from "@/domain/shared/reglas";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionDarDeBaja } from "../acciones";

/**
 * Baja en dos pasos: primero se abre el panel, luego se elige el motivo y
 * se confirma. Evita dar de baja a alguien por un clic accidental.
 */
export function FormularioBaja({ socioId, nombre, tieneMembresiaVigente }: { socioId: string; nombre: string; tieneMembresiaVigente: boolean }) {
  const [estado, accion] = useActionState(accionDarDeBaja, estadoInicial);
  const [abierto, setAbierto] = useState(Boolean(estado.error));
  const [motivo, setMotivo] = useState(estado.valores?.motivo ?? "");

  if (!abierto) {
    return (
      <button type="button" className="boton-peligro" onClick={() => setAbierto(true)}>
        Dar de baja
      </button>
    );
  }

  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <p className="text-[0.95rem]">
        {nombre} dejará de aparecer en la lista de activos. Su historial de pagos se conserva y
        puedes reactivarlo cuando quieras.
        {tieneMembresiaVigente && <strong className="font-semibold"> Todavía tiene una membresía vigente.</strong>}
      </p>
      <div className="grid gap-4">
        <div>
          <Etiqueta para="motivo">Motivo</Etiqueta>
          <Selector
            id="motivo"
            nombre="motivo"
            requerido
            valor={motivo}
            alCambiar={setMotivo}
            marcador="Elige uno"
            opciones={MOTIVOS_BAJA.map((m) => ({ valor: m, texto: m }))}
          />
        </div>
        <div>
          <Etiqueta para="detalle" opcional={motivo !== "Otro"}>
            Detalle
          </Etiqueta>
          <input
            id="detalle"
            name="detalle"
            className="campo"
            maxLength={LIMITES.nota}
            required={motivo === "Otro"}
            placeholder={motivo === "Otro" ? "Cuéntanos brevemente por qué" : "Ej. se muda a Monterrey en diciembre"}
            data-regla="texto:3"
            data-falta="Describe brevemente el motivo."
            defaultValue={estado.valores?.detalle}
          />
          <Ayuda para="detalle">Sirve para saber después por qué se van los socios.</Ayuda>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <BotonEnviar textoEnviando="Dando de baja…">Confirmar baja</BotonEnviar>
        <button type="button" className="boton-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </Formulario>
  );
}
