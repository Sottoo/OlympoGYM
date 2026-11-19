"use client";

import { useActionState, useEffect, useState } from "react";
import { CATEGORIAS_PRODUCTO, type CategoriaProducto, type UnidadProducto } from "@/domain/entities/Producto";
import { LIMITES } from "@/domain/shared/reglas";
import { pluralizar } from "@/domain/shared/texto";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CantidadGranel, type DatosGranel, enPalabras } from "@/presentation/components/formulario/CantidadGranel";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { formatearDinero } from "@/shared/formato";
import { accionContarInventario } from "../abasto-acciones";

export interface ProductoParaContar {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  foto: string | null;
  stock: number;
  unidad: UnidadProducto;
  /** Precio de una pieza o de un gramo, para valuar diferencias. */
  precioUnidad: number;
  granel: DatosGranel | null;
}

/** Diferencia a granel en palabras cortas: "1.5 botes", "≈ 3 scoops" o "12 g". */
function diferenciaGranel(g: DatosGranel, gramos: number) {
  if (g.envaseGramos && gramos >= g.envaseGramos * 0.1) {
    const b = Math.round((gramos / g.envaseGramos) * 10) / 10;
    return `${b.toLocaleString("es-MX")} ${b === 1 ? "bote" : "botes"}`;
  }
  const porciones = Math.floor(gramos / g.porcionGramos);
  if (porciones >= 1) return `≈ ${porciones} ${pluralizar(g.porcionNombre, porciones)}`;
  return `${gramos.toLocaleString("es-MX")} g`;
}

/**
 * Conteo de fin de mes: se recorre el anaquel y se escribe lo que hay. Lo que
 * no se cuente se queda como está. Las diferencias se ven al momento y se
 * ajustan todas de una vez.
 */
export function ConteoRapido({ productos }: { productos: ProductoParaContar[] }) {
  const [estado, accion] = useActionState(accionContarInventario, estadoInicial);
  // Lo contado, ya en piezas o gramos (lo que no está aquí no se contó).
  const [contados, setContados] = useState<Record<string, number>>({});
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    if (estado.exito) {
      setContados({});
      setVuelta((v) => v + 1);
    }
  }, [estado]);

  function anotar(id: string, valor: number | null) {
    setContados((c) => {
      const { [id]: _, ...resto } = c;
      return valor === null ? resto : { ...resto, [id]: valor };
    });
  }

  const porId = new Map(productos.map((p) => [p.id, p]));
  // Con lo contado va la existencia que se ve en pantalla: el ajuste es la diferencia contra ella.
  const conteos = Object.entries(contados).map(([productoId, contado]) => ({
    productoId,
    contado: Math.max(0, Math.round(contado)),
    esperado: porId.get(productoId)?.stock ?? 0,
  }));
  let faltante = 0;
  let sobrante = 0;
  let diferentes = 0;
  for (const c of conteos) {
    const p = porId.get(c.productoId);
    if (!p) continue;
    const d = c.contado - c.esperado;
    if (d !== 0) diferentes++;
    if (d < 0) faltante += -d * p.precioUnidad;
    else sobrante += d * p.precioUnidad;
  }

  const grupos = new Map<CategoriaProducto, ProductoParaContar[]>();
  for (const p of productos) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="con-lateral">
      <input type="hidden" name="conteos" value={JSON.stringify(conteos)} />
      <div className="bloques">
        {[...grupos.entries()].map(([categoria, lista]) => (
          <section key={categoria} aria-label={CATEGORIAS_PRODUCTO[categoria]} className="superficie">
            <h2 className="rotulo px-4 pb-1 pt-3.5">{CATEGORIAS_PRODUCTO[categoria]}</h2>
            <ul className="divide-y divide-dashed divide-linea">
              {lista.map((p) => {
                const contado = contados[p.id];
                const d = contado === undefined ? null : Math.round(contado) - p.stock;
                const cuanto = (n: number) => (p.granel ? diferenciaGranel(p.granel, n) : n.toLocaleString("es-MX"));
                const registrado = p.granel ? enPalabras(p.granel, p.stock) : `${p.stock} ${p.stock === 1 ? "pieza" : "piezas"}`;
                const diferencia = (
                  <span className={`text-[0.84rem] font-semibold tabular-nums ${d === null ? "text-gris" : d < 0 ? "text-rojo" : d > 0 ? "text-ambar" : "text-verde"}`}>
                    {d === null ? "" : d === 0 ? "Cuadra" : d < 0 ? `Faltan ${cuanto(-d)}` : `Sobran ${cuanto(d)}`}
                  </span>
                );
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                    <Emblema {...dibujoDeProducto(p)} tamano="sm" />
                    <label htmlFor={`contado-${p.id}`} className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{p.nombre}</span>
                      <span className="text-[0.8rem] text-gris">Registrado: {registrado}</span>
                    </label>
                    {p.granel ? (
                      <div className="grid justify-items-end gap-0.5">
                        <CantidadGranel
                          key={`${p.id}-${vuelta}`}
                          id={`contado-${p.id}`}
                          granel={p.granel}
                          gramos={contado ?? 0}
                          alCambiar={(g, escrito) => anotar(p.id, escrito ? g : null)}
                          compacto
                          placeholder="—"
                        />
                        {diferencia}
                      </div>
                    ) : (
                      <>
                        <span className="w-28 text-right">{diferencia}</span>
                        <div className="flex items-center gap-2">
                          <input
                            key={`${p.id}-${vuelta}`}
                            id={`contado-${p.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={1_000_000}
                            step={1}
                            defaultValue=""
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              anotar(p.id, v === "" || !Number.isFinite(Number(v)) ? null : Math.floor(Number(v)));
                            }}
                            className="campo w-24 py-1.5 text-center tabular-nums"
                            data-propio
                            data-lector-propio
                          />
                          <span className="w-12 text-[0.8rem] text-gris">piezas</span>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <aside className="bloques">
        <section className="panel grid gap-4 px-6 py-[22px] xl:sticky xl:top-6">
          <div>
            <h2 className="font-titulos text-[1.3rem] leading-tight">Resumen del conteo</h2>
            <p className="mt-1 text-[0.84rem] text-gris">
              Contaste {conteos.length} de {productos.length}. Lo que dejes en blanco no se toca.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[0.88rem]">
            <div>
              <dt className="text-gris">Con diferencia</dt>
              <dd className="cifra text-[1.5rem]">{diferentes}</dd>
            </div>
            <div>
              <dt className="text-gris">Faltante</dt>
              <dd className={`cifra text-[1.5rem] ${faltante > 0 ? "text-rojo" : ""}`}>{formatearDinero(faltante)}</dd>
            </div>
          </dl>
          {sobrante > 0 && <p className="text-[0.84rem] text-gris">Sobrante: {formatearDinero(sobrante)} (a precio de venta).</p>}
          <div>
            <Etiqueta para="nota" opcional>
              Nota
            </Etiqueta>
            <input id="nota" name="nota" maxLength={LIMITES.nota} className="campo" placeholder="Ej. conteo de octubre" />
            <Ayuda para="nota">Queda en cada ajuste.</Ayuda>
          </div>
          <AvisosDelFormulario />
          <MensajeExito mensaje={estado.exito} />
          <BotonEnviar textoEnviando="Guardando…" className="w-full py-3" disabled={conteos.length === 0}>
            Guardar conteo
          </BotonEnviar>
        </section>
      </aside>
    </Formulario>
  );
}
