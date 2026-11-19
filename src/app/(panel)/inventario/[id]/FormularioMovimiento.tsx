"use client";

import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { DatosNuevoMovimiento } from "@/domain/entities/MovimientoInventario";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { LIMITES } from "@/domain/shared/reglas";
import { CampoNumero } from "@/presentation/components/formulario/campos";
import { existenciaGranel } from "@/domain/entities/Producto";
import { CantidadGranel, type DatosGranel, enPalabras } from "@/presentation/components/formulario/CantidadGranel";
import { Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionRegistrarMovimiento } from "../acciones";

type Tipo = DatosNuevoMovimiento["tipo"];

const TIPOS: Record<Tipo, string> = { entrada: "Entrada", merma: "Merma", ajuste: "Ajuste por conteo" };

const TEXTOS: Record<Tipo, { pieza: string; granel: string; ayuda: string; nota: string; placeholder: string; boton: string; pista: string; pistaGranel: string }> = {
  entrada: {
    pieza: "Piezas que llegaron",
    granel: "¿Cuánto llegó?",
    ayuda: "Mercancía nueva del proveedor.",
    nota: "Proveedor o factura",
    placeholder: "Ej. Distribuidora del Norte, factura 4521",
    boton: "Registrar entrada",
    pista: "Se suman a lo que ya hay.",
    pistaGranel: "Por ejemplo, 2 botes. Se suma a lo que ya hay.",
  },
  merma: {
    pieza: "Piezas a dar de baja",
    granel: "¿Cuánto se da de baja?",
    ayuda: "Producto caducado, dañado o extraviado.",
    nota: "Motivo",
    placeholder: "Ej. caducado, empaque roto",
    boton: "Registrar merma",
    pista: "Se restan de lo que hay.",
    pistaGranel: "Se resta de lo que hay.",
  },
  ajuste: {
    pieza: "Piezas contadas en anaquel",
    granel: "¿Cuánto hay en realidad?",
    ayuda: "Escribe lo que hay físicamente; la diferencia se ajusta sola.",
    nota: "Nota",
    placeholder: "Ej. conteo mensual",
    boton: "Ajustar existencia",
    pista: "Lo que hay físicamente, aunque sea 0.",
    pistaGranel: "Un bote a la mitad es 0.5; si lo pesas, cámbialo a gramos (sin el envase).",
  },
};

/**
 * Entrada, merma o ajuste de un producto. A granel la cantidad se dice en
 * botes, porciones o gramos (lo que sea más cómodo) y se guarda en gramos.
 */
export function FormularioMovimiento({ productoId, stockActual, granel }: { productoId: string; stockActual: number; granel?: DatosGranel }) {
  const [estado, accion] = useActionState(accionRegistrarMovimiento, estadoInicial);
  const [tipo, setTipo] = useState<Tipo>((estado.valores?.tipo as Tipo) ?? "entrada");
  const [cantidad, setCantidad] = useState(estado.valores?.cantidad ?? "");
  const [gramos, setGramos] = useState<number | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const ruta = usePathname();
  const t = TEXTOS[tipo];

  // Tras registrar con éxito, se limpia para capturar el siguiente movimiento.
  useEffect(() => {
    if (estado.exito) {
      formulario.current?.reset();
      setCantidad("");
      setGramos(null);
      setVuelta((v) => v + 1);
      // El aviso de arriba ("Producto dado de alta") ya no aplica: se quita para no mezclar mensajes.
      if (window.location.search.includes("aviso=")) router.replace(ruta, { scroll: false });
    }
  }, [estado, router, ruta]);

  // Una merma no puede sacar más piezas de las que hay.
  const reglas = useMemo(
    () => ({
      cantidad: (valor: string) =>
        tipo === "merma" && Number(valor) > stockActual ? `Solo hay ${stockActual} en existencia; no puedes dar de baja ${valor}.` : null,
    }),
    [tipo, stockActual],
  );

  const fmt = (x: number) => (granel ? existenciaGranel(granel, Math.max(0, x)).principal : String(x));
  const n = granel ? gramos : cantidad === "" ? null : Number(cantidad);
  const valido = n !== null && Number.isInteger(n) && n >= 0 && (tipo === "ajuste" || n > 0);
  const resultado = !valido ? null : tipo === "entrada" ? stockActual + n : tipo === "merma" ? stockActual - n : n;

  return (
    <Formulario ref={formulario} action={accion} estado={estado} reglas={reglas} className="grid gap-4">
      <input type="hidden" name="productoId" value={productoId} />
      {/* La existencia que se ve: un ajuste se mide contra ella, no contra la del momento de guardar. */}
      <input type="hidden" name="esperado" value={stockActual} />
      <MensajeExito mensaje={estado.exito} />

      <fieldset>
        <legend className="sr-only">Tipo de movimiento</legend>
        <SelectorSegmentado completo nombre="tipo" opciones={TIPOS} valor={tipo} alCambiar={(v) => setTipo(v as Tipo)} />
      </fieldset>
      <p className="text-sm text-gris">{t.ayuda}</p>

      <div className="grid gap-4">
        {granel ? (
          <div>
            <Etiqueta para="cantidad">{t.granel}</Etiqueta>
            <CantidadGranel
              key={vuelta}
              id="cantidad"
              nombre="cantidad"
              granel={granel}
              gramos={gramos ?? 0}
              alCambiar={(g, escrito) => setGramos(escrito ? g : null)}
              requerido
              permitirCero={tipo === "ajuste"}
              pista={t.pistaGranel}
              validar={(g) =>
                tipo === "merma" && g > stockActual
                  ? `No alcanza: solo hay ${enPalabras(granel, stockActual)} (${stockActual.toLocaleString("es-MX")} g).`
                  : null
              }
            />
          </div>
        ) : (
          <div>
            <Etiqueta para="cantidad">{t.pieza}</Etiqueta>
            <CampoNumero
              id="cantidad"
              nombre="cantidad"
              min={tipo === "ajuste" ? 0 : 1}
              max={LIMITES.piezasMaximas}
              requerido
              unidad="piezas"
              valor={cantidad}
              alCambiar={setCantidad}
              className="max-w-[13rem]"
              atributos={{
                "data-que": tipo === "ajuste" ? "Lo contado" : "La cantidad",
                "data-falta": "Escribe cuántas piezas.",
              }}
            />
            <Ayuda para="cantidad">{t.pista}</Ayuda>
          </div>
        )}
        <div>
          <Etiqueta para="nota" opcional={tipo !== "merma"}>
            {t.nota}
          </Etiqueta>
          <input
            id="nota"
            name="nota"
            className="campo"
            maxLength={LIMITES.nota}
            data-contador=""
            placeholder={t.placeholder}
            required={tipo === "merma"}
            data-falta="Escribe el motivo de la merma."
            defaultValue={estado.valores?.nota}
          />
          <Ayuda para="nota" maximo={LIMITES.nota} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotonEnviar textoEnviando="Guardando…" variante="boton-oscuro">{t.boton}</BotonEnviar>
        {resultado !== null && (
          <p className={`text-sm tabular-nums ${resultado < 0 ? "text-rojo" : "text-gris"}`}>
            Existencia: {fmt(stockActual)} → <strong className="font-semibold text-tinta">{fmt(resultado)}</strong>
            {resultado < 0 && " (no alcanza)"}
          </p>
        )}
      </div>
    </Formulario>
  );
}
