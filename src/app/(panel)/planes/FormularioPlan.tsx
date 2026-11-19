"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { DIAS_POR_UNIDAD, DURACION_MAXIMA, describirDuracion, esPlanDeVisita, type Plan, type UnidadDuracion } from "@/domain/entities/Plan";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero, CampoNumero } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionCrearPlan, accionEditarPlan } from "./acciones";

const EN_TEXTO: Record<UnidadDuracion, [string, string]> = { dias: ["día", "días"], semanas: ["semana", "semanas"], meses: ["mes", "meses"] };
const TIPOS = { membresia: "Membresía", visita: "Visita de un día" };
/** Las duraciones de siempre, a un clic. «Otra» abre cantidad y unidad. */
const RAPIDAS = { "1-semanas": "1 semana", "1-meses": "1 mes", "3-meses": "3 meses", "6-meses": "6 meses", "12-meses": "12 meses", otra: "Otra" };
type Rapida = keyof typeof RAPIDAS;

function rapidaDe(duracion: string, unidad: string): Rapida {
  const clave = `${duracion}-${unidad}`;
  return clave in RAPIDAS ? (clave as Rapida) : "otra";
}

/**
 * Crear un plan nuevo o, con `plan`, cambiar uno que ya existe. Primero se
 * elige qué es (membresía o visita de un día); la visita no pide duración.
 * Si el plan ya se vendió (`vendido`), su nombre y duración quedan fijos: solo
 * cambian precio y descripción (el servidor lo revisa también).
 */
export function FormularioPlan({ plan, vendido = false }: { plan?: Plan; vendido?: boolean }) {
  const [estado, accion] = useActionState(plan ? accionEditarPlan : accionCrearPlan, estadoInicial);
  const fijo = plan !== undefined && vendido;
  const v =
    estado.valores ??
    (plan
      ? { nombre: plan.nombre, descripcion: plan.descripcion ?? "", precio: String(plan.precio), duracion: String(plan.duracion), unidad: plan.unidad }
      : {});
  const vDuracion = v.duracion || "1";
  const vUnidad = (v.unidad as UnidadDuracion) || "meses";
  const eraVisita = vDuracion === "1" && vUnidad === "dias";
  const [tipo, setTipo] = useState<keyof typeof TIPOS>(eraVisita ? "visita" : "membresia");
  const [rapida, setRapida] = useState<Rapida>(eraVisita ? "1-meses" : rapidaDe(vDuracion, vUnidad));
  const [duracion, setDuracion] = useState(!eraVisita && rapidaDe(vDuracion, vUnidad) === "otra" ? vDuracion : "1");
  const [unidad, setUnidad] = useState<UnidadDuracion>(!eraVisita && rapidaDe(vDuracion, vUnidad) === "otra" ? vUnidad : "meses");

  // Tras crear un plan, el formulario queda listo para el siguiente.
  useEffect(() => {
    if (estado.exito && !plan) {
      setTipo("membresia");
      setRapida("1-meses");
      setDuracion("1");
      setUnidad("meses");
    }
  }, [estado, plan]);

  // Lo que se envía: la visita siempre es 1 día; una duración rápida, la suya; «Otra», lo escrito.
  const [envDuracion, envUnidad] =
    tipo === "visita" ? ["1", "dias" as UnidadDuracion] : rapida === "otra" ? [duracion, unidad] : (rapida.split("-") as [string, UnidadDuracion]);
  const dias = (Number(envDuracion) || 0) * DIAS_POR_UNIDAD[envUnidad];

  return (
    <Formulario action={accion} estado={estado} className="grid gap-5">
      {plan && <input type="hidden" name="planId" value={plan.id} />}
      <MensajeExito mensaje={estado.exito} />

      {fijo && plan && (
        <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.88rem] text-tinta-suave">
          <b className="font-semibold text-tinta">Este plan ya se vendió.</b> Su nombre y duración ({esPlanDeVisita(plan) ? "visita de un día" : describirDuracion(plan)})
          no se cambian para no alterar el historial ni los cortes. Si necesitas otro, desactívalo y crea uno nuevo.
        </p>
      )}

      {!fijo && (
      <fieldset>
        <legend className="etiqueta">Tipo</legend>
        <SelectorSegmentado nombre="tipo" opciones={TIPOS} valor={tipo} alCambiar={(t) => setTipo(t as keyof typeof TIPOS)} completo />
        {tipo === "visita" && (
          <>
            <p className="mensaje-campo">Para quien llega sin membresía. Se cobra en el mostrador y dura el día.</p>
            <Ayuda para="duracion" />
          </>
        )}
      </fieldset>
      )}

      <div>
        <Etiqueta para="nombre">Nombre</Etiqueta>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={LIMITES.nombrePlan}
          className="campo"
          placeholder={tipo === "visita" ? "Ej. Visita" : "Ej. Mensualidad"}
          defaultValue={fijo ? plan.nombre : v.nombre}
          readOnly={fijo}
          aria-readonly={fijo || undefined}
          data-regla="texto:3"
          data-falta="Ponle nombre al plan."
        />
        <Ayuda para="nombre" />
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
        <Ayuda para="precio" />
      </div>

      {tipo === "membresia" && !fijo && (
        <fieldset>
          <legend className="etiqueta">Duración</legend>
          <div role="radiogroup" aria-label="Duración" className="flex flex-wrap gap-2">
            {(Object.keys(RAPIDAS) as Rapida[]).map((r) => (
              <label key={r} className={`chip-opcion ${rapida === r ? "chip-elegida" : ""}`}>
                <input type="radio" name="duracion-rapida" value={r} checked={rapida === r} onChange={() => setRapida(r)} className="sr-only" />
                {RAPIDAS[r]}
              </label>
            ))}
          </div>
          {rapida === "otra" && (
            <div className="aparece mt-3 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
              <label htmlFor="duracion" className="sr-only">Cantidad</label>
              <CampoNumero
                id="duracion"
                nombre="duracion"
                min={1}
                max={DURACION_MAXIMA[unidad]}
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
                opciones={(Object.keys(EN_TEXTO) as UnidadDuracion[]).map((u) => ({ valor: u, texto: EN_TEXTO[u][duracion === "1" ? 0 : 1] }))}
              />
            </div>
          )}
          <Ayuda para="duracion">{dias > 1 ? `Dura ${dias} días.` : ""}</Ayuda>
        </fieldset>
      )}
      {fijo ? (
        <>
          <input type="hidden" name="duracion" value={plan.duracion} />
          <input type="hidden" name="unidad" value={plan.unidad} />
          <Ayuda para="duracion" />
        </>
      ) : (
        (tipo === "visita" || rapida !== "otra") && (
          <>
            <input type="hidden" name="duracion" value={envDuracion} />
            <input type="hidden" name="unidad" value={envUnidad} />
          </>
        )
      )}

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
          placeholder="Ej. Acceso completo, de lunes a sábado"
          defaultValue={v.descripcion}
        />
        <Ayuda para="descripcion" maximo={LIMITES.descripcionPlan} />
      </div>

      {plan && <p className="text-[0.82rem] text-gris">Lo ya cobrado no cambia: aplica a los cobros de aquí en adelante.</p>}
      <div className="flex flex-wrap gap-2 border-t border-dashed border-linea pt-4">
        <BotonEnviar textoEnviando={plan ? "Guardando…" : "Creando…"}>{plan ? "Guardar cambios" : "Crear plan"}</BotonEnviar>
        {plan && (
          <Link href="/planes" className="boton-secundario">
            Cancelar
          </Link>
        )}
      </div>
    </Formulario>
  );
}
