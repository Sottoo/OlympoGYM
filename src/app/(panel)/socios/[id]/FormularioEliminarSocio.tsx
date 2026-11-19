"use client";

import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionEliminarSocio } from "../acciones";
import { PieDelDialogo } from "./PieDelDialogo";

/**
 * Borrado para siempre: se escribe la palabra ELIMINAR para confirmar, así
 * nadie lo borra por un clic accidental.
 */
export function FormularioEliminarSocio({ socioId, tienePagos, alCancelar }: { socioId: string; tienePagos: boolean; alCancelar: () => void }) {
  const [estado, accion] = useActionState(accionEliminarSocio, estadoInicial);

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <p className="text-[0.9rem] text-tinta-suave">
        Se borran sus datos y su huella{tienePagos ? "; sus pagos se quedan en los cortes como «Socio eliminado»" : ""}.{" "}
        <strong className="font-semibold text-rojo">No se puede deshacer.</strong>
      </p>
      <div>
        <Etiqueta para="confirmacion">Escribe ELIMINAR para confirmar</Etiqueta>
        <input
          id="confirmacion"
          name="confirmacion"
          required
          autoComplete="off"
          className="campo max-w-56 uppercase tracking-[0.12em]"
          placeholder="ELIMINAR"
          data-falta="Escribe la palabra ELIMINAR para confirmar."
        />
        <Ayuda para="confirmacion" />
      </div>
      <AvisosDelFormulario />
      <PieDelDialogo alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Eliminando…" variante="boton-peligro">
          Eliminar para siempre
        </BotonEnviar>
      </PieDelDialogo>
    </Formulario>
  );
}
