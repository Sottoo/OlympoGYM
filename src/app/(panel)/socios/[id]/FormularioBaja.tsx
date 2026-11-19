"use client";

import { useActionState, useState } from "react";
import { MOTIVOS_BAJA } from "@/domain/entities/Socio";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Selector } from "@/presentation/components/formulario/Selector";
import { LIMITES } from "@/domain/shared/reglas";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionDarDeBaja } from "../acciones";
import { PieDelDialogo } from "./PieDelDialogo";

/**
 * Baja: el socio queda en espera (no se borra nada). Se abre en su propia
 * ventana desde «Más» y pide el motivo antes de confirmar.
 */
export function FormularioBaja({ socioId, tieneMembresiaVigente, alCancelar }: { socioId: string; tieneMembresiaVigente: boolean; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionDarDeBaja, estadoInicial);
  const [motivo, setMotivo] = useState(estado.valores?.motivo ?? "");

  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <p className="text-[0.9rem] text-tinta-suave">
        Queda en espera con todo su historial y se puede reactivar cuando regrese.
        {tieneMembresiaVigente && <strong className="font-semibold text-tinta"> Todavía tiene una membresía vigente.</strong>}
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
          <Ayuda para="detalle" />
        </div>
      </div>
      <PieDelDialogo alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Dando de baja…" variante="boton-oscuro">
          Dar de baja
        </BotonEnviar>
      </PieDelDialogo>
    </Formulario>
  );
}
