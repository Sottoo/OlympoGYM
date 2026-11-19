"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { LIMITES_MANTENIMIENTO, type TipoMantenimiento } from "@/domain/entities/Mantenimiento";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { sumarDias, sumarMeses } from "@/domain/shared/fechas";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoFecha, describirFecha } from "@/presentation/components/formulario/CampoFecha";
import { CampoDinero, Casilla } from "@/presentation/components/formulario/campos";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionRegistrarMantenimiento } from "../acciones";

export interface EquipoParaRegistrar {
  id: string;
  nombre: string;
  detalle: string;
  frecuenciaMeses: number | null;
  frecuenciaTexto: string;
  reportes: { id: string; descripcion: string }[];
}

const TIPOS: Record<TipoMantenimiento, string> = { preventivo: "Preventivo", correctivo: "Reparación" };
const PAGOS = { completo: "Pagado", anticipo: "Anticipo", a_deber: "A deber" };

const aNumero = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function FormularioMantenimiento({
  equipos,
  proveedores,
  hoy,
  equipoInicial,
  tipoInicial,
}: {
  equipos: EquipoParaRegistrar[];
  proveedores: string[];
  hoy: string;
  equipoInicial?: string;
  tipoInicial?: TipoMantenimiento;
}) {
  const [estado, accion] = useActionState(accionRegistrarMantenimiento, estadoInicial);
  const v = estado.valores ?? {};
  const [equipoId, setEquipoId] = useState(v.equipoId ?? equipoInicial ?? "");
  const [tipo, setTipo] = useState<TipoMantenimiento>((v.tipo as TipoMantenimiento) ?? tipoInicial ?? "preventivo");
  const [fecha, setFecha] = useState(v.fecha ?? hoy);
  const [manoDeObra, setManoDeObra] = useState(v.manoDeObra ?? "");
  const [refacciones, setRefacciones] = useState(v.refacciones ?? "");
  const [pago, setPago] = useState<keyof typeof PAGOS>((v.pago as keyof typeof PAGOS) ?? "completo");
  const [metodo, setMetodo] = useState(v.metodo ?? "efectivo");
  const [anticipo, setAnticipo] = useState(v.anticipo ?? "");
  // Las fallas que resuelve: en una reparación se proponen todas; en un preventivo, ninguna.
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});

  const equipo = equipos.find((e) => e.id === equipoId);
  const total = Math.round((aNumero(manoDeObra) + aNumero(refacciones)) * 100) / 100;
  const totalValido = Number.isFinite(total);
  const conCosto = totalValido && total > 0;
  const pagado = !conCosto ? 0 : pago === "completo" ? total : pago === "anticipo" ? aNumero(anticipo) || 0 : 0;
  const quedaADeber = conCosto && pago !== "completo";
  const siguiente = tipo === "preventivo" && equipo?.frecuenciaMeses && fecha ? sumarMeses(fecha, equipo.frecuenciaMeses) : null;

  const reglas = useMemo(
    () => ({
      anticipo: (valor: string) =>
        conCosto && Number(valor) >= total ? "El anticipo debe ser menor al total; si se pagó todo, elige «Pagado completo»." : null,
    }),
    [conCosto, total],
  );

  return (
    <Formulario action={accion} estado={estado} reglas={reglas} avisosManuales className="superficie">
      <div className="space-y-6 p-5 sm:p-7">
        <AvisosDelFormulario />

        <div className="grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <Etiqueta para="equipoId">Máquina</Etiqueta>
            <Selector
              id="equipoId"
              nombre="equipoId"
              requerido
              valor={equipoId}
              alCambiar={setEquipoId}
              marcador="Elige la máquina"
              opciones={equipos.map((e) => ({ valor: e.id, texto: e.nombre, detalle: e.detalle }))}
            />
            <Ayuda para="equipoId" />
          </div>
          <div>
            <Etiqueta para="fecha">Fecha</Etiqueta>
            <CampoFecha id="fecha" nombre="fecha" requerido max={hoy} min={sumarDias(hoy, -365 * LIMITES_MANTENIMIENTO.aniosAtras)} valor={fecha} alCambiar={setFecha} />
            <Ayuda para="fecha" />
          </div>
        </div>

        <fieldset>
          <legend className="etiqueta">Tipo</legend>
          <SelectorSegmentado nombre="tipo" opciones={TIPOS} valor={tipo} alCambiar={(t) => setTipo(t as TipoMantenimiento)} />
          {siguiente && <p className="mensaje-campo">Siguiente preventivo: {describirFecha(siguiente)}.</p>}
        </fieldset>

        {equipo && equipo.reportes.length > 0 && (
          <fieldset className="aparece rounded-[12px] bg-ambar-tenue/70 px-4 py-3.5">
            <legend className="sr-only">Fallas que resuelve</legend>
            <p className="mb-2 text-[0.88rem] font-semibold">Fallas reportadas: marca las que quedaron arregladas.</p>
            <div className="grid gap-2">
              {equipo.reportes.map((r) => (
                <Casilla
                  key={r.id}
                  nombre="resuelve"
                  valor={r.id}
                  marcada={marcados[r.id] ?? tipo === "correctivo"}
                  alCambiar={(m) => setMarcados((x) => ({ ...x, [r.id]: m }))}
                >
                  {r.descripcion}
                </Casilla>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <Etiqueta para="descripcion">Qué se le hizo</Etiqueta>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              rows={3}
              maxLength={LIMITES_MANTENIMIENTO.descripcion}
              data-contador=""
              className="campo resize-none"
              defaultValue={v.descripcion}
              placeholder={tipo === "preventivo" ? "Ej. lubricación de banda, ajuste de tensión y limpieza del motor" : "Ej. cambio de banda y rodillo trasero"}
              data-regla="texto:3"
              data-falta="Escribe qué se le hizo."
            />
            <Ayuda para="descripcion" maximo={LIMITES_MANTENIMIENTO.descripcion} />
          </div>
          <div>
            <Etiqueta para="proveedor" opcional={!quedaADeber}>
              Técnico o empresa
            </Etiqueta>
            <input
              id="proveedor"
              name="proveedor"
              list="proveedores"
              maxLength={LIMITES_MANTENIMIENTO.proveedor}
              required={quedaADeber}
              autoComplete="off"
              className="campo"
              defaultValue={v.proveedor}
              placeholder="Ej. Técnico Juan Pérez"
              data-falta="Escribe a quién se le debe (técnico o empresa)."
            />
            <datalist id="proveedores">
              {proveedores.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Ayuda para="proveedor">{quedaADeber ? "Para saber a quién se le debe." : ""}</Ayuda>
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Costo y pago</p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Etiqueta para="manoDeObra" opcional>Mano de obra</Etiqueta>
              <CampoDinero id="manoDeObra" nombre="manoDeObra" valor={manoDeObra} alCambiar={setManoDeObra} atributos={{ "data-que": "La mano de obra" }} />
              <Ayuda para="manoDeObra" />
            </div>
            <div>
              <Etiqueta para="refacciones" opcional>Refacciones</Etiqueta>
              <CampoDinero id="refacciones" nombre="refacciones" valor={refacciones} alCambiar={setRefacciones} atributos={{ "data-que": "Las refacciones" }} />
              <Ayuda para="refacciones" />
            </div>
            <div className="grid content-start gap-1 rounded-[12px] bg-hundido px-4 py-3">
              <span className="text-[0.8rem] font-semibold text-gris">Total</span>
              <span className="cifra text-[1.9rem] leading-none">{totalValido ? formatearDinero(total) : "—"}</span>
              {!conCosto && <span className="text-[0.76rem] text-gris">Sin costo</span>}
            </div>
          </div>
        </div>

        {conCosto ? (
          <div className="aparece grid gap-4 border-t border-dashed border-linea pt-5">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              <fieldset>
                <legend className="etiqueta">Pago</legend>
                <SelectorSegmentado nombre="pago" opciones={PAGOS} valor={pago} alCambiar={(p) => setPago(p as keyof typeof PAGOS)} />
              </fieldset>
              {pago !== "a_deber" && (
                <fieldset>
                  <legend className="etiqueta">Método</legend>
                  <SelectorSegmentado nombre="metodo" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
                  {metodo === "efectivo" && <p className="mensaje-campo">Sale de la caja {fecha === hoy ? "de hoy" : `del ${describirFecha(fecha)}`}.</p>}
                </fieldset>
              )}
              {pago === "anticipo" && (
                <div className="w-48">
                  <Etiqueta para="anticipo">Anticipo</Etiqueta>
                  <CampoDinero
                    id="anticipo"
                    nombre="anticipo"
                    requerido
                    valor={anticipo}
                    alCambiar={setAnticipo}
                    atributos={{ "data-regla": "precio", "data-que": "El anticipo", "data-falta": "Escribe cuánto se dio." }}
                  />
                  <Ayuda para="anticipo" />
                </div>
              )}
            </div>
            {pago !== "completo" && (
              <p className="rounded-[10px] bg-hundido px-4 py-3 text-[0.88rem]">
                Quedan <b className="font-semibold">{formatearDinero(Math.max(0, total - pagado))}</b> por pagar; los abonos se registran en «Por pagar».
              </p>
            )}
          </div>
        ) : (
          <input type="hidden" name="pago" value="a_deber" />
        )}

        <div>
          <Etiqueta para="nota" opcional>Nota</Etiqueta>
          <input id="nota" name="nota" maxLength={LIMITES.nota} data-contador="" className="campo" defaultValue={v.nota} placeholder="Ej. folio de la nota 1832, garantía de 3 meses" />
          <Ayuda para="nota" maximo={LIMITES.nota} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">Guardar mantenimiento</BotonEnviar>
        <Link href={equipo ? `/mantenimiento/equipos/${equipo.id}` : "/mantenimiento"} className="boton-secundario">Cancelar</Link>
      </div>
    </Formulario>
  );
}
