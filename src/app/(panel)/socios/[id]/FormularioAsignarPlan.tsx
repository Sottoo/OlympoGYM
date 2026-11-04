"use client";

import Link from "next/link";
import { useActionState } from "react";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Formulario } from "@/presentation/components/formulario/Formulario";
import { accionAsignarPlan } from "../acciones";
import { CamposDeCobro, type OpcionPlan } from "../CamposDeCobro";

interface Props {
  socioId: string;
  planes: OpcionPlan[];
  esRenovacion: boolean;
  /** El plan que tuvo la última vez; se preselecciona para renovar más rápido. */
  planPreferido?: string;
  /** Si quien cobra puede poner otro monto (descuentos). Recepción cobra el precio del plan. */
  puedeCambiarMonto?: boolean;
  /** Si quien usa el programa puede crear planes (para el aviso cuando no hay ninguno). */
  creaPlanes?: boolean;
}

export function FormularioAsignarPlan({ socioId, planes, esRenovacion, planPreferido, puedeCambiarMonto = true, creaPlanes = false }: Props) {
  const [estado, accion] = useActionState(accionAsignarPlan, estadoInicial);

  if (planes.length === 0) {
    return (
      <p className="text-gris">
        Todavía no hay planes de membresía activos.{" "}
        {creaPlanes ? (
          <Link href="/planes" className="enlace font-semibold text-tinta">
            Crea uno en Planes
          </Link>
        ) : (
          "Pide a la administración que cree uno en Planes"
        )}{" "}
        y aquí aparecerá para asignarlo.
      </p>
    );
  }

  return (
    <Formulario action={accion} estado={estado} className="grid gap-5">
      <input type="hidden" name="socioId" value={socioId} />
      <CamposDeCobro
        planes={planes}
        planPreferido={planPreferido}
        puedeCambiarMonto={puedeCambiarMonto}
        valores={estado.valores}
        ayudaMembresia={esRenovacion ? "El nuevo periodo empieza al terminar el actual: no pierde días." : "La membresía empieza hoy."}
      />
      <div className="border-t border-linea pt-5">
        <BotonEnviar textoEnviando="Registrando…">{esRenovacion ? "Registrar pago y renovar" : "Registrar pago y activar"}</BotonEnviar>
      </div>
    </Formulario>
  );
}
