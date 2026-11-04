"use client";

import { useActionState, useState } from "react";
import { LIMITES_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { type OpcionSelector, Selector } from "@/presentation/components/formulario/Selector";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionReportarFalla } from "../acciones";

const USO = { no: "Sí, con cuidado", si: "No, ya no se puede usar" };

export function FormularioReporte({
  equipos,
  equipoInicial,
  volverAFicha,
  abiertos,
}: {
  equipos: OpcionSelector[];
  equipoInicial?: string;
  volverAFicha: boolean;
  /** Fallas que ya están reportadas por equipo, para no repetirlas. */
  abiertos: Record<string, string[]>;
}) {
  const [estado, accion] = useActionState(accionReportarFalla, estadoInicial);
  const v = estado.valores ?? {};
  const [equipo, setEquipo] = useState(v.equipoId ?? equipoInicial ?? "");
  const [fuera, setFuera] = useState(v.fueraDeServicio ?? "no");
  const yaReportadas = abiertos[equipo] ?? [];

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="superficie">
      <input type="hidden" name="volver" value={volverAFicha ? "ficha" : ""} />
      <div className="grid gap-6 p-5 sm:p-7">
        <AvisosDelFormulario />
        <div>
          <Etiqueta para="equipoId">¿Qué máquina?</Etiqueta>
          <Selector id="equipoId" nombre="equipoId" requerido opciones={equipos} valor={equipo} alCambiar={setEquipo} marcador="Elige la máquina" />
          <Ayuda para="equipoId">Escribe las primeras letras para encontrarla rápido.</Ayuda>
          {yaReportadas.length > 0 && (
            <p className="aparece mt-2 rounded-[10px] bg-ambar-tenue px-4 py-2.5 text-[0.86rem]">
              Ya está reportada: <strong className="font-semibold">{yaReportadas.join(" · ")}</strong>. Si es otra cosa, descríbela abajo.
            </p>
          )}
        </div>
        <div>
          <Etiqueta para="descripcion">¿Qué le pasa?</Etiqueta>
          <textarea
            id="descripcion"
            name="descripcion"
            required
            rows={3}
            maxLength={LIMITES_MANTENIMIENTO.reporte}
            data-contador=""
            className="campo resize-none"
            placeholder="Ej. la banda se atora al subir la velocidad y hace un ruido fuerte"
            defaultValue={v.descripcion}
            data-regla="texto:3"
            data-falta="Describe qué le pasa a la máquina."
          />
          <Ayuda para="descripcion" maximo={LIMITES_MANTENIMIENTO.reporte}>
            Qué hace, desde cuándo y si alguien se lastimó.
          </Ayuda>
        </div>
        <fieldset>
          <legend className="etiqueta">¿Se puede seguir usando?</legend>
          <SelectorSegmentado nombre="fueraDeServicio" opciones={USO} valor={fuera} alCambiar={setFuera} />
          <p className="mensaje-campo">
            {fuera === "si"
              ? "Se marcará «Fuera de servicio». Pon un letrero en la máquina para que nadie la use."
              : "Queda como «Con falla»: se puede usar mientras se arregla."}
          </p>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Enviando…">Reportar falla</BotonEnviar>
      </div>
    </Formulario>
  );
}
