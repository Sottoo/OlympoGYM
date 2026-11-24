"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { accionGuardarEmpleado } from "./acciones";

/** Alta o cambio de datos de un empleado (nombre, puesto y sueldo semanal). */
export function FormularioEmpleado({ empleado }: { empleado?: { id: string; nombre: string; puesto: string | null; sueldoSemanal: number | null } }) {
  const [estado, accion] = useActionState(accionGuardarEmpleado, estadoInicial);
  const v = estado.valores ?? (empleado ? { nombre: empleado.nombre, puesto: empleado.puesto ?? "", sueldoSemanal: empleado.sueldoSemanal === null ? "" : String(empleado.sueldoSemanal) } : {});
  // Tras dar de alta, el formulario queda limpio para el siguiente.
  const vez = estado.exito ?? "";

  return (
    <Formulario action={accion} estado={estado} className="grid gap-4">
      <MensajeExito mensaje={estado.exito} />
      {empleado && <input type="hidden" name="empleadoId" value={empleado.id} />}
      <div>
        <Etiqueta para="nombre-empleado">Nombre</Etiqueta>
        <input
          id="nombre-empleado"
          name="nombre"
          className="campo"
          required
          maxLength={LIMITES.nombrePlan}
          placeholder="Ej. Ana López"
          data-regla="texto:2"
          data-falta="Escribe el nombre del empleado."
          defaultValue={v.nombre}
          key={`n-${vez}`}
        />
        <Ayuda para="nombre-empleado" />
      </div>
      <div>
        <Etiqueta para="puesto" opcional>
          Puesto
        </Etiqueta>
        <input id="puesto" name="puesto" className="campo" maxLength={LIMITES.nombrePlan} placeholder="Ej. Recepción, Instructor, Limpieza" defaultValue={v.puesto} key={`p-${vez}`} />
      </div>
      <div>
        <Etiqueta para="sueldoSemanal" opcional>
          Sueldo semanal
        </Etiqueta>
        <CampoDinero id="sueldoSemanal" nombre="sueldoSemanal" valorInicial={v.sueldoSemanal} key={`s-${vez}`} atributos={{ "data-regla": "dinero", "data-que": "El sueldo" }} />
        <Ayuda para="sueldoSemanal">Se propone al pagarle; se puede cambiar cada semana.</Ayuda>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">
          {empleado ? "Guardar cambios" : "Dar de alta"}
        </BotonEnviar>
        {empleado && (
          <Link href="/nomina" className="boton-secundario">
            Cancelar
          </Link>
        )}
      </div>
    </Formulario>
  );
}
