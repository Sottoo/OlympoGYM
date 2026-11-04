"use client";

import { useActionState, useEffect, useState } from "react";
import { DURACION_MAXIMA, type UnidadDuracion } from "@/domain/entities/Plan";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero, CampoNumero } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { accionCrearPlan } from "./acciones";

const EN_TEXTO: Record<UnidadDuracion, [string, string]> = { dias: ["día", "días"], semanas: ["semana", "semanas"], meses: ["mes", "meses"] };

export function FormularioPlan() {
  const [estado, accion] = useActionState(accionCrearPlan, estadoInicial);
  const v = estado.valores ?? {};
  const [duracion, setDuracion] = useState(v.duracion ?? "1");
  const [unidad, setUnidad] = useState<UnidadDuracion>((v.unidad as UnidadDuracion) ?? "meses");
  const uno = duracion === "1";
  const esVisita = uno && unidad === "dias";
  const maximo = DURACION_MAXIMA[unidad];

  // Tras crear un plan, el formulario queda listo para el siguiente.
  useEffect(() => {
    if (estado.exito) {
      setDuracion("1");
      setUnidad("meses");
    }
  }, [estado]);

  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <MensajeExito mensaje={estado.exito} />
      <div>
        <Etiqueta para="nombre">Nombre</Etiqueta>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={LIMITES.nombrePlan}
          className="campo"
          placeholder="Ej. Mensual estudiante"
          defaultValue={v.nombre}
          data-regla="texto:3"
          data-falta="Ponle nombre al plan."
        />
        <Ayuda para="nombre">Así lo verá recepción al cobrar.</Ayuda>
      </div>
      <div>
        <Etiqueta para="descripcion" opcional>
          Descripción
        </Etiqueta>
        <input
          id="descripcion"
          name="descripcion"
          maxLength={LIMITES.descripcionPlan}
          data-contador=""
          className="campo"
          placeholder="Ej. Acceso a pesas y cardio, de lunes a sábado"
          defaultValue={v.descripcion}
        />
        <Ayuda para="descripcion" maximo={LIMITES.descripcionPlan}>
          Qué incluye, en una línea.
        </Ayuda>
      </div>
      <div>
        <Etiqueta para="precio">Precio</Etiqueta>
        <CampoDinero
          id="precio"
          nombre="precio"
          requerido
          valorInicial={v.precio}
          atributos={{ "data-regla": "precio", "data-que": "El precio", "data-falta": "Escribe el precio del plan." }}
        />
        <Ayuda para="precio">En pesos, con centavos si hace falta.</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Duración</legend>
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
          <label htmlFor="duracion" className="sr-only">Cantidad</label>
          <CampoNumero
            id="duracion"
            nombre="duracion"
            min={1}
            max={maximo}
            requerido
            valor={duracion}
            alCambiar={setDuracion}
            atributos={{ "data-que": "La duración", "data-falta": "Escribe cuánto dura." }}
          />
          <Selector
            nombre="unidad"
            aria-label="Unidad"
            valor={unidad}
            alCambiar={(u) => setUnidad(u as UnidadDuracion)}
            opciones={(Object.keys(EN_TEXTO) as UnidadDuracion[]).map((u) => ({ valor: u, texto: EN_TEXTO[u][uno ? 0 : 1] }))}
          />
        </div>
        <Ayuda para="duracion">
          {esVisita
            ? "Un plan de 1 día es la visita: se cobra en el mostrador a quien llega sin membresía."
            : `Hasta ${maximo} ${EN_TEXTO[unidad][1]}.`}
        </Ayuda>
      </fieldset>
      <BotonEnviar textoEnviando="Creando…" className="justify-self-start">
        Crear plan
      </BotonEnviar>
    </Formulario>
  );
}
