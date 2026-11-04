"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type AreaEquipo, AREAS_EQUIPO, type DatosEquipo, describirFrecuencia, LIMITES_MANTENIMIENTO } from "@/domain/entities/Mantenimiento";
import { sumarMeses } from "@/domain/shared/fechas";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoFecha, describirFecha } from "@/presentation/components/formulario/CampoFecha";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { accionGuardarEquipo } from "../acciones";

/** Lo que suele recomendarse según el tipo de equipo. */
const FRECUENCIA_SUGERIDA: Record<AreaEquipo, string> = { cardio: "3", fuerza: "6", peso_libre: "12", instalaciones: "6", otro: "" };
const FRECUENCIAS = ["", "1", "2", "3", "4", "6", "12", "18", "24"];

export function FormularioEquipo({ equipo, hoy }: { equipo?: DatosEquipo & { id: string }; hoy: string }) {
  const [estado, accion] = useActionState(accionGuardarEquipo, estadoInicial);
  const v = estado.valores ?? (equipo ? aTexto(equipo) : {});
  const [area, setArea] = useState<AreaEquipo>((v.area as AreaEquipo) || "cardio");
  const [frecuencia, setFrecuencia] = useState(v.frecuenciaMeses ?? (equipo ? "" : FRECUENCIA_SUGERIDA.cardio));
  const [tocoFrecuencia, setTocoFrecuencia] = useState(Boolean(equipo));
  const [base, setBase] = useState(v.servicioBase ?? "");
  const proximo = frecuencia ? sumarMeses(base || hoy, Number(frecuencia)) : null;

  function cambiarArea(nueva: string) {
    setArea(nueva as AreaEquipo);
    // Mientras no se elija a mano, la frecuencia sigue la sugerida para el área.
    if (!tocoFrecuencia) setFrecuencia(FRECUENCIA_SUGERIDA[nueva as AreaEquipo]);
  }

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="superficie">
      {equipo && <input type="hidden" name="equipoId" value={equipo.id} />}
      <div className="space-y-6 p-5 sm:p-7">
        <AvisosDelFormulario />

        <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Etiqueta para="nombre">Nombre del equipo</Etiqueta>
            <input
              id="nombre"
              name="nombre"
              required
              maxLength={LIMITES_MANTENIMIENTO.nombreEquipo}
              className="campo"
              defaultValue={v.nombre}
              placeholder="Ej. Caminadora 1"
              data-regla="texto:2"
              data-falta="Escribe el nombre del equipo."
            />
            <Ayuda para="nombre">Si tienes varias iguales, numéralas: así recepción reporta la correcta.</Ayuda>
          </div>
          <div>
            <label htmlFor="area" className="etiqueta">Área</label>
            <Selector
              id="area"
              nombre="area"
              valor={area}
              alCambiar={cambiarArea}
              opciones={Object.entries(AREAS_EQUIPO).map(([valor, texto]) => ({ valor, texto }))}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Etiqueta para="marca" opcional>Marca</Etiqueta>
            <input id="marca" name="marca" maxLength={LIMITES_MANTENIMIENTO.marca} className="campo" defaultValue={v.marca} placeholder="Ej. Life Fitness" />
            <Ayuda para="marca" />
          </div>
          <div>
            <Etiqueta para="modelo" opcional>Modelo</Etiqueta>
            <input id="modelo" name="modelo" maxLength={LIMITES_MANTENIMIENTO.marca} className="campo" defaultValue={v.modelo} placeholder="Ej. T5" />
            <Ayuda para="modelo" />
          </div>
          <div>
            <Etiqueta para="numeroSerie" opcional>Número de serie</Etiqueta>
            <input id="numeroSerie" name="numeroSerie" maxLength={LIMITES_MANTENIMIENTO.serie} className="campo uppercase" defaultValue={v.numeroSerie} autoComplete="off" />
            <Ayuda para="numeroSerie">Viene en la placa del equipo; sirve para la garantía.</Ayuda>
          </div>
          <div>
            <Etiqueta para="fechaCompra" opcional>Fecha de compra</Etiqueta>
            <CampoFecha id="fechaCompra" nombre="fechaCompra" max={hoy} valorInicial={v.fechaCompra} />
            <Ayuda para="fechaCompra" />
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Mantenimiento preventivo</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="frecuenciaMeses" className="etiqueta">¿Cada cuánto le toca servicio?</label>
              <Selector
                id="frecuenciaMeses"
                nombre="frecuenciaMeses"
                valor={frecuencia}
                alCambiar={(f) => {
                  setFrecuencia(f);
                  setTocoFrecuencia(true);
                }}
                opciones={FRECUENCIAS.map((f) => ({
                  valor: f,
                  texto: f ? describirFrecuencia(Number(f)) : "Sin programa",
                  detalle: f === FRECUENCIA_SUGERIDA[area] && f ? "Lo que suele recomendarse para este tipo" : !f ? "No avisar; solo registrar cuando se haga" : undefined,
                }))}
              />
              <Ayuda para="frecuenciaMeses">Te avisamos en Hoy cuando ya le toque.</Ayuda>
            </div>
            {frecuencia && (
              <div>
                <Etiqueta para="servicioBase" opcional>
                  ¿Cuándo fue su último servicio?
                </Etiqueta>
                <CampoFecha
                  id="servicioBase"
                  nombre="servicioBase"
                  max={hoy}
                  valor={base}
                  alCambiar={setBase}
                  describir={() => (proximo ? `Siguiente preventivo: ${describirFecha(proximo)}` : "")}
                />
                {!base && proximo && (
                  <p className="mensaje-campo">Si no lo sabes, déjalo vacío: se cuenta desde hoy (siguiente: {describirFecha(proximo)}).</p>
                )}
                <Ayuda para="servicioBase" />
              </div>
            )}
          </div>
        </div>

        <div>
          <Etiqueta para="nota" opcional>Nota</Etiqueta>
          <input id="nota" name="nota" maxLength={LIMITES.nota} data-contador="" className="campo" defaultValue={v.nota} placeholder="Ej. garantía hasta marzo 2027, técnico de la marca" />
          <Ayuda para="nota" maximo={LIMITES.nota} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">{equipo ? "Guardar cambios" : "Dar de alta equipo"}</BotonEnviar>
        <Link href={equipo ? `/mantenimiento/equipos/${equipo.id}` : "/mantenimiento"} className="boton-secundario">Cancelar</Link>
      </div>
    </Formulario>
  );
}

function aTexto(e: DatosEquipo): Record<string, string> {
  return {
    nombre: e.nombre,
    area: e.area,
    marca: e.marca ?? "",
    modelo: e.modelo ?? "",
    numeroSerie: e.numeroSerie ?? "",
    fechaCompra: e.fechaCompra ?? "",
    frecuenciaMeses: e.frecuenciaMeses === null ? "" : String(e.frecuenciaMeses),
    servicioBase: e.servicioBase ?? "",
    nota: e.nota ?? "",
  };
}
