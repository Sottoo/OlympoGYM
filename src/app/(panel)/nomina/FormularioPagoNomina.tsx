"use client";

import { useActionState, useEffect, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionPagarNomina } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
  puesto: string | null;
  sueldoSemanal: number | null;
}

/**
 * Pagar la semana a un empleado. Propone la semana que toca (desde el viernes,
 * la actual) y su sueldo semanal. En efectivo, sale de la caja de hoy.
 */
export function FormularioPagoNomina({
  empleados,
  semanas,
  semanaSugerida,
  empleadoSugerido,
}: {
  empleados: Opcion[];
  semanas: { semana: string; texto: string }[];
  semanaSugerida: string;
  /** El primero al que falta pagarle (si hay aviso). */
  empleadoSugerido?: string;
}) {
  const [estado, accion] = useActionState(accionPagarNomina, estadoInicial);
  const [empleadoId, setEmpleadoId] = useState(estado.valores?.empleadoId ?? empleadoSugerido ?? "");
  const [semana, setSemana] = useState(estado.valores?.semana ?? semanaSugerida);
  const [metodo, setMetodo] = useState(estado.valores?.metodoPago ?? "efectivo");
  const empleado = empleados.find((e) => e.id === empleadoId);

  // Tras pagar, queda listo para el siguiente (el aviso de arriba dice a quién falta).
  useEffect(() => {
    if (estado.exito) {
      setEmpleadoId(empleadoSugerido ?? "");
      setMetodo("efectivo");
    }
  }, [estado, empleadoSugerido]);

  if (empleados.length === 0) return <p className="text-[0.9rem] text-gris">Primero da de alta a tus empleados en «Empleados».</p>;

  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <MensajeExito mensaje={estado.exito} />
      <div>
        <Etiqueta para="empleadoId">Empleado</Etiqueta>
        <Selector
          id="empleadoId"
          nombre="empleadoId"
          requerido
          valor={empleadoId}
          alCambiar={setEmpleadoId}
          marcador="Elige a quién se le paga"
          opciones={empleados.map((e) => ({ valor: e.id, texto: e.nombre, detalle: e.puesto ?? undefined }))}
        />
      </div>
      <div>
        <Etiqueta para="semana">Semana (lunes a viernes)</Etiqueta>
        <Selector
          id="semana"
          nombre="semana"
          requerido
          valor={semana}
          alCambiar={setSemana}
          opciones={semanas.map((s) => ({ valor: s.semana, texto: `Semana ${s.texto}`, detalle: s.semana === semanaSugerida ? "La que toca" : undefined }))}
        />
      </div>
      <div>
        <Etiqueta para="monto">Cantidad</Etiqueta>
        <CampoDinero
          id="monto"
          nombre="monto"
          requerido
          // Al cambiar de empleado se propone su sueldo.
          key={empleadoId}
          valorInicial={estado.valores?.monto ?? (empleado?.sueldoSemanal ? String(empleado.sueldoSemanal) : "")}
          atributos={{ "data-regla": "precio", "data-que": "La cantidad", "data-falta": "Escribe cuánto se le paga." }}
        />
        <Ayuda para="monto">{empleado?.sueldoSemanal ? "Su sueldo semanal; cámbialo si esta semana fue distinto." : "Escribe cuánto se le paga esta semana."}</Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Cómo se le pagó</legend>
        <SelectorSegmentado nombre="metodoPago" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
        {metodo === "efectivo" && <p className="mt-1.5 text-[0.8rem] text-gris">Sale del «Efectivo en caja» de hoy.</p>}
      </fieldset>
      <div>
        <Etiqueta para="nota" opcional>
          Nota
        </Etiqueta>
        <input id="nota" name="nota" className="campo" maxLength={LIMITES.nota} placeholder="Ej. incluye 2 horas extra" defaultValue={estado.valores?.nota} key={`nota-${estado.exito ?? ""}`} />
      </div>
      <BotonEnviar textoEnviando="Registrando…" variante="boton-oscuro">
        Registrar pago
      </BotonEnviar>
    </Formulario>
  );
}
