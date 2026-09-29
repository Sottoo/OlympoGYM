"use client";

import { useActionState, useState } from "react";
import { MOTIVOS_BAJA } from "@/domain/entities/Socio";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
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
    <form action={accion} className="space-y-4">
      <input type="hidden" name="socioId" value={socioId} />
      <MensajeError mensaje={estado.error} />
      <p className="text-[0.95rem]">
        {nombre} dejará de aparecer en la lista de activos y ya no recibirá avisos. Su historial de pagos se conserva y
        puedes reactivarlo cuando quieras.
        {tieneMembresiaVigente && <strong className="font-semibold"> Todavía tiene una membresía vigente.</strong>}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="motivo" className="etiqueta">Motivo</label>
          <select id="motivo" name="motivo" required className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="" disabled>Elige una opción</option>
            {MOTIVOS_BAJA.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="detalle" className="etiqueta">
            Detalle {motivo !== "Otro" && <span className="font-normal text-gris">(opcional)</span>}
          </label>
          <input id="detalle" name="detalle" className="campo" required={motivo === "Otro"} defaultValue={estado.valores?.detalle} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <BotonEnviar textoEnviando="Dando de baja…">Confirmar baja</BotonEnviar>
        <button type="button" className="boton-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}
