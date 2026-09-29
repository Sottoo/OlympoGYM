"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { DatosNuevoMovimiento } from "@/domain/entities/MovimientoInventario";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError, MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionRegistrarMovimiento } from "../acciones";

type Tipo = DatosNuevoMovimiento["tipo"];

const TIPOS: Record<Tipo, string> = { entrada: "Entrada", merma: "Merma", ajuste: "Ajuste por conteo" };

const TEXTOS: Record<Tipo, { cantidad: string; ayuda: string; nota: string; placeholder: string; boton: string }> = {
  entrada: {
    cantidad: "Piezas que llegaron",
    ayuda: "Mercancía nueva del proveedor.",
    nota: "Proveedor o factura",
    placeholder: "Ej. Distribuidora del Norte, factura 4521",
    boton: "Registrar entrada",
  },
  merma: {
    cantidad: "Piezas a dar de baja",
    ayuda: "Producto caducado, dañado o extraviado.",
    nota: "Motivo",
    placeholder: "Ej. caducado, empaque roto",
    boton: "Registrar merma",
  },
  ajuste: {
    cantidad: "Piezas contadas en anaquel",
    ayuda: "Escribe lo que hay físicamente; la diferencia se ajusta sola.",
    nota: "Nota",
    placeholder: "Ej. conteo mensual",
    boton: "Ajustar stock",
  },
};

export function FormularioMovimiento({ productoId, stockActual }: { productoId: string; stockActual: number }) {
  const [estado, accion] = useActionState(accionRegistrarMovimiento, estadoInicial);
  const [tipo, setTipo] = useState<Tipo>((estado.valores?.tipo as Tipo) ?? "entrada");
  const [cantidad, setCantidad] = useState(estado.valores?.cantidad ?? "");
  const formulario = useRef<HTMLFormElement>(null);
  const t = TEXTOS[tipo];

  // Tras registrar con éxito, se limpia para capturar el siguiente movimiento.
  useEffect(() => {
    if (estado.exito) {
      formulario.current?.reset();
      setCantidad("");
    }
  }, [estado]);

  const n = Number(cantidad);
  const valido = cantidad !== "" && Number.isInteger(n) && n >= 0;
  const resultado = !valido ? null : tipo === "entrada" ? stockActual + n : tipo === "merma" ? stockActual - n : n;

  return (
    <form ref={formulario} action={accion} className="space-y-4">
      <input type="hidden" name="productoId" value={productoId} />
      <MensajeError mensaje={estado.error} />
      <MensajeExito mensaje={estado.exito} />

      <SelectorSegmentado nombre="tipo" opciones={TIPOS} valor={tipo} alCambiar={(v) => setTipo(v as Tipo)} />
      <p className="text-sm text-gris">{t.ayuda}</p>

      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <label htmlFor="cantidad" className="etiqueta">{t.cantidad}</label>
          <input
            id="cantidad"
            name="cantidad"
            type="number"
            min={tipo === "ajuste" ? 0 : 1}
            step={1}
            required
            inputMode="numeric"
            className="campo tabular-nums"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="nota" className="etiqueta">
            {t.nota} {tipo !== "merma" && <span className="font-normal text-gris">(opcional)</span>}
          </label>
          <input id="nota" name="nota" className="campo" placeholder={t.placeholder} required={tipo === "merma"} defaultValue={estado.valores?.nota} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">{t.boton}</BotonEnviar>
        {resultado !== null && (
          <p className={`text-sm tabular-nums ${resultado < 0 ? "text-rojo" : "text-gris"}`}>
            Existencia: {stockActual} → <strong className="font-semibold text-tinta">{resultado}</strong>
            {resultado < 0 && " (no alcanza)"}
          </p>
        )}
      </div>
    </form>
  );
}
