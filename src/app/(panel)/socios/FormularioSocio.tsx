"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { DatosNuevoSocio } from "@/domain/entities/Socio";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionEditarSocio, accionRegistrarSocio } from "./acciones";

interface Props {
  /** Si viene, el formulario edita a ese socio; si no, registra uno nuevo. */
  socio?: DatosNuevoSocio & { id: string };
}

export function FormularioSocio({ socio }: Props) {
  const [estado, accion] = useActionState(socio ? accionEditarSocio : accionRegistrarSocio, estadoInicial);
  const v = estado.valores ?? (socio ? aTexto(socio) : {});

  return (
    <form action={accion} className="superficie max-w-3xl">
      {socio && <input type="hidden" name="socioId" value={socio.id} />}
      <div className="space-y-6 p-5 sm:p-7">
        <MensajeError mensaje={estado.error} />

        <fieldset>
          <legend className="rotulo mb-4">Datos personales</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="nombre" className="etiqueta">Nombre</label>
              <input id="nombre" name="nombre" required autoComplete="off" className="campo" defaultValue={v.nombre} />
            </div>
            <div>
              <label htmlFor="apellidos" className="etiqueta">Apellidos</label>
              <input id="apellidos" name="apellidos" required autoComplete="off" className="campo" defaultValue={v.apellidos} />
            </div>
          </div>
        </fieldset>

        <div className="border-t border-linea pt-6">
          <fieldset>
            <legend className="rotulo mb-4">Contacto</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="telefono" className="etiqueta">Celular (WhatsApp)</label>
                <input id="telefono" name="telefono" type="tel" inputMode="tel" required autoComplete="off" className="campo" defaultValue={v.telefono} />
                <p className="ayuda">10 dígitos. Aquí se le mandan los avisos de vencimiento.</p>
              </div>
              <div>
                <label htmlFor="email" className="etiqueta">Correo <span className="font-normal text-gris">(opcional)</span></label>
                <input id="email" name="email" type="email" autoComplete="off" className="campo" defaultValue={v.email} />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="border-t border-linea pt-6">
          <label htmlFor="notas" className="etiqueta">Notas <span className="font-normal text-gris">(opcional)</span></label>
          <textarea id="notas" name="notas" rows={3} className="campo" defaultValue={v.notas} placeholder="Lesiones, objetivos, horario preferido…" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">{socio ? "Guardar cambios" : "Registrar socio"}</BotonEnviar>
        <Link href={socio ? `/socios/${socio.id}` : "/socios"} className="boton-secundario">Cancelar</Link>
      </div>
    </form>
  );
}

function aTexto(socio: DatosNuevoSocio): Record<string, string> {
  return {
    nombre: socio.nombre,
    apellidos: socio.apellidos,
    email: socio.email ?? "",
    telefono: socio.telefono ?? "",
    notas: socio.notas ?? "",
  };
}
