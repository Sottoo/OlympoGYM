"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoFecha } from "@/presentation/components/formulario/CampoFecha";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionRegistrarAbono } from "../../acciones";

/** Un abono al técnico: todo lo que se debe o una parte. */
export function FormularioAbono({ mantenimientoId, saldo, hoy, desde }: { mantenimientoId: string; saldo: number; hoy: string; desde: string }) {
  const [estado, accion] = useActionState(accionRegistrarAbono, estadoInicial);
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState("efectivo");
  const [fecha, setFecha] = useState(hoy);
  const formulario = useRef<HTMLFormElement>(null);
  const n = Number(monto);

  const reglas = useMemo(() => ({ monto: (v: string) => (Number(v) > saldo ? `Solo se deben ${formatearDinero(saldo)}.` : null) }), [saldo]);

  useEffect(() => {
    if (estado.exito) formulario.current?.reset();
  }, [estado]);
  // Al cambiar el saldo (tras un pago), se propone pagar lo que falta.
  useEffect(() => setMonto(String(saldo)), [saldo]);

  return (
    <Formulario ref={formulario} action={accion} estado={estado} className="grid gap-4" reglas={reglas}>
      <input type="hidden" name="mantenimientoId" value={mantenimientoId} />
      <MensajeExito mensaje={estado.exito} />
      <div>
        <Etiqueta para="monto">Monto</Etiqueta>
        <CampoDinero id="monto" nombre="monto" requerido valor={monto} alCambiar={setMonto} atributos={{ "data-regla": "precio", "data-que": "El pago", "data-falta": "Escribe cuánto se pagó." }} />
        <Ayuda para="monto">
          {n > 0 && n < saldo ? `Quedarán ${formatearDinero(saldo - n)} por pagar.` : n === saldo ? "Con esto queda liquidado." : `Se deben ${formatearDinero(saldo)}.`}
        </Ayuda>
      </div>
      <fieldset>
        <legend className="etiqueta">Se pagó con</legend>
        <SelectorSegmentado completo nombre="metodo" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
        <p className="mensaje-campo">{metodo === "efectivo" ? "Sale de la caja y se resta en el corte de ese día." : "No toca la caja."}</p>
      </fieldset>
      <div>
        <Etiqueta para="fecha">Fecha del pago</Etiqueta>
        <CampoFecha id="fecha" nombre="fecha" requerido min={desde} max={hoy} valor={fecha} alCambiar={setFecha} />
        <Ayuda para="fecha" />
      </div>
      <div>
        <Etiqueta para="nota-abono" opcional>Nota</Etiqueta>
        <input id="nota-abono" name="nota" maxLength={LIMITES.nota} className="campo" placeholder="Ej. segundo pago, folio 1832" />
        <Ayuda para="nota" />
      </div>
      <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro" className="w-full">
        Registrar pago
      </BotonEnviar>
    </Formulario>
  );
}
