"use client";

import { useActionState, useState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { AvisosDelFormulario, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionUnirSocios } from "../acciones";
import { PieDelDialogo } from "./PieDelDialogo";

/**
 * Unir un socio registrado dos veces. Solo se ofrece cuando el programa
 * detecta otro registro con el mismo nombre (desde el aviso de arriba de la
 * ficha): todo el historial del repetido pasa a este y el repetido se borra.
 */
export function FormularioUnir({
  socioId,
  nombre,
  sugeridos,
  alCancelar,
}: {
  socioId: string;
  nombre: string;
  sugeridos: { id: string; texto: string }[];
  alCancelar: () => void;
}) {
  const [estado, accion] = useActionState(accionUnirSocios, estadoInicial);
  const [elegido, setElegido] = useState(estado.valores?.duplicado ?? sugeridos[0]?.id ?? "");

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="grid gap-4">
      <input type="hidden" name="socioId" value={socioId} />
      <input type="hidden" name="duplicado" value={elegido} />
      {sugeridos.length === 1 ? (
        <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.92rem]">
          <span className="block text-[0.72rem] font-bold tracking-[0.1em] text-gris uppercase">Registro repetido</span>
          {sugeridos[0].texto}
        </p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="etiqueta">¿Cuál es el registro repetido?</legend>
          {sugeridos.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-[0.9rem]">
              <input type="radio" name="duplicado-opcion" checked={elegido === s.id} onChange={() => setElegido(s.id)} className="size-4 accent-tinta" />
              {s.texto}
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-[0.9rem] text-tinta-suave">
        Todo su historial pasa a {nombre} y el otro registro se borra. <strong className="font-semibold text-tinta">No se puede deshacer.</strong>
      </p>
      <AvisosDelFormulario />
      <PieDelDialogo alCancelar={alCancelar}>
        <BotonEnviar textoEnviando="Uniendo…" variante="boton-oscuro">
          Unir registros
        </BotonEnviar>
      </PieDelDialogo>
    </Formulario>
  );
}
