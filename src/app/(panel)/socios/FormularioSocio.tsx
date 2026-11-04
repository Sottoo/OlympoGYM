"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { DatosNuevoSocio } from "@/domain/entities/Socio";
import { formatearCelularParcial, LIMITES, normalizarCelular } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoFecha } from "@/presentation/components/formulario/CampoFecha";
import { CampoFoto } from "@/presentation/components/formulario/CampoFoto";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { formatearDinero } from "@/shared/formato";
import { accionEditarSocio, accionRegistrarSocio, accionRevisarCelular } from "./acciones";
import { CamposDeCobro, type OpcionPlan } from "./CamposDeCobro";

interface Props {
  /** Si viene, el formulario edita a ese socio; si no, inscribe uno nuevo. */
  socio?: DatosNuevoSocio & { id: string };
  /** Enlace temporal de la foto actual, si tiene. */
  fotoUrl?: string | null;
  /** Al inscribir: los planes que se pueden elegir y si se permite cambiar el monto. */
  inscripcion?: { planes: OpcionPlan[]; puedeCambiarMonto: boolean };
}

export function FormularioSocio({ socio, fotoUrl, inscripcion }: Props) {
  const [estado, accion] = useActionState(socio ? accionEditarSocio : accionRegistrarSocio, estadoInicial);
  const v = estado.valores ?? (socio ? aTexto(socio) : {});
  const [plan, setPlan] = useState<OpcionPlan | undefined>(() => inscripcion?.planes.find((p) => p.id === v.planId) ?? inscripcion?.planes[0]);
  const [remotas] = useState(() => ({ telefono: (valor: string) => accionRevisarCelular(valor, socio?.id) }));

  return (
    <Formulario action={accion} estado={estado} remotas={remotas} avisosManuales className="superficie">
      {socio && <input type="hidden" name="socioId" value={socio.id} />}
      <div className="grid gap-6 p-5 sm:p-7">
        <AvisosDelFormulario />
        <fieldset>
          <legend className="rotulo mb-4">Datos personales</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Etiqueta para="nombre">Nombre</Etiqueta>
              <input
                id="nombre"
                name="nombre"
                required
                autoComplete="off"
                autoCapitalize="words"
                maxLength={LIMITES.nombrePersona}
                className="campo"
                placeholder="Ej. María Fernanda"
                defaultValue={v.nombre}
                data-regla="nombre"
                data-filtro="nombre"
                data-formato="nombre"
                data-falta="Escribe el nombre."
              />
              <Ayuda para="nombre">Como aparece en su identificación.</Ayuda>
            </div>
            <div>
              <Etiqueta para="apellidos">Apellidos</Etiqueta>
              <input
                id="apellidos"
                name="apellidos"
                required
                autoComplete="off"
                autoCapitalize="words"
                maxLength={LIMITES.apellidos}
                className="campo"
                placeholder="Ej. López Hernández"
                defaultValue={v.apellidos}
                data-regla="apellidos"
                data-filtro="nombre"
                data-formato="nombre"
                data-falta="Escribe los apellidos."
              />
              <Ayuda para="apellidos">Paterno y materno.</Ayuda>
            </div>
            <div>
              <Etiqueta para="fechaNacimiento" opcional>
                Fecha de nacimiento
              </Etiqueta>
              <CampoFecha
                id="fechaNacimiento"
                nombre="fechaNacimiento"
                min={haceAnios(100)}
                max={haceAnios(5)}
                valorInicial={v.fechaNacimiento}
                empezarEn="anios"
                describir={describirNacimiento}
              />
            </div>
            <div>
              <Etiqueta para="telefono">Celular</Etiqueta>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="numeric"
                required
                autoComplete="off"
                className="campo tabular-nums tracking-[0.02em]"
                placeholder="55 1234 5678"
                defaultValue={v.telefono ? formatearCelularParcial(normalizarCelular(v.telefono)) : undefined}
                data-regla="telefono"
                data-filtro="telefono"
                data-falta="Escribe el celular."
              />
              <Ayuda para="telefono">10 dígitos, sin +52. Con él también se le busca en el mostrador.</Ayuda>
            </div>
          </div>
        </fieldset>

        <div className="border-t border-linea pt-6">
          <fieldset>
            <legend className="rotulo mb-4">Foto</legend>
            <CampoFoto fotoActual={fotoUrl} alt="Foto del socio" ayuda="Opcional. Ayuda a reconocer al socio en recepción." />
          </fieldset>
        </div>

        <div className="border-t border-linea pt-6">
          <Etiqueta para="notas" opcional>
            Notas
          </Etiqueta>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            maxLength={LIMITES.notasSocio}
            data-contador=""
            className="campo"
            defaultValue={v.notas}
            placeholder="Lesiones, objetivos, horario preferido…"
          />
          <Ayuda para="notas" maximo={LIMITES.notasSocio}>
            Solo la ve el personal del gimnasio.
          </Ayuda>
        </div>

        {inscripcion && (
          <div className="border-t border-linea pt-6">
            <fieldset>
              <legend className="rotulo mb-1">Plan y pago</legend>
              <p className="mb-4 text-[0.84rem] text-gris">Todo socio se inscribe con su plan: sale de recepción con su membresía activa.</p>
              <CamposDeCobro planes={inscripcion.planes} puedeCambiarMonto={inscripcion.puedeCambiarMonto} valores={estado.valores} alElegir={setPlan} />
            </fieldset>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">
          {socio ? "Guardar cambios" : plan?.esVisita ? `Registrar y cobrar visita · ${formatearDinero(plan.precio)}` : "Inscribir y cobrar"}
        </BotonEnviar>
        <Link href={socio ? `/socios/${socio.id}` : "/socios"} className="boton-secundario">
          Cancelar
        </Link>
      </div>
    </Formulario>
  );
}

function haceAnios(anios: number): string {
  const hoy = new Date();
  hoy.setFullYear(hoy.getFullYear() - anios);
  return hoy.toLocaleDateString("en-CA");
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Cumple el 7 de marzo · 32 años" (o "¡Cumple hoy!"). */
function describirNacimiento(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const hoy = new Date();
  const [ha, hm, hd] = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()];
  const edad = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
  const cumple = hm === m && hd === d ? "¡Cumple años hoy!" : `Cumple el ${d} de ${MESES[m - 1]}`;
  return edad >= 0 ? `${cumple} · ${edad} ${edad === 1 ? "año" : "años"}` : cumple;
}

function aTexto(socio: DatosNuevoSocio): Record<string, string> {
  return {
    nombre: socio.nombre,
    apellidos: socio.apellidos,
    telefono: socio.telefono ?? "",
    fechaNacimiento: socio.fechaNacimiento ?? "",
    notas: socio.notas ?? "",
  };
}
