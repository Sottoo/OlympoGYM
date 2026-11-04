"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ProductoDeCatalogo } from "@/domain/entities/CatalogoInicial";
import { CATEGORIAS_PRODUCTO, type CategoriaProducto } from "@/domain/entities/Producto";
import { claveDeNombre } from "@/domain/shared/texto";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { CantidadGranel } from "@/presentation/components/formulario/CantidadGranel";
import { AvisosDelFormulario, Ayuda, Formulario } from "@/presentation/components/formulario/Formulario";
import { BotonDeRopa } from "@/presentation/components/formulario/marcas";
import { Icono } from "@/presentation/components/Icono";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { accionAltaCatalogo } from "../abasto-acciones";
import { accionReactivarProducto } from "../acciones";

interface Eleccion {
  precio: string;
  costo: string;
  /** Piezas, o gramos a granel ("" mientras no se escribe). */
  existencia: string;
}

export interface ProductoRegistrado {
  id: string;
  nombre: string;
  activo: boolean;
  foto: string | null;
}

/** Se marca lo que se vende, se pone precio y existencia, y se da de alta todo junto. */
export function AltaDesdeCatalogo({ catalogo, registrados }: { catalogo: ProductoDeCatalogo[]; registrados: ProductoRegistrado[] }) {
  const [estado, accion] = useActionState(accionAltaCatalogo, estadoInicial);
  const [elegidos, setElegidos] = useState<Record<string, Eleccion>>({});
  const [reactivados, setReactivados] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();
  const porNombre = new Map(registrados.map((r) => [claveDeNombre(r.nombre), r]));

  useEffect(() => {
    if (estado.exito) setElegidos({});
  }, [estado]);

  const grupos = new Map<CategoriaProducto, ProductoDeCatalogo[]>();
  for (const p of catalogo) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);

  const lote = catalogo
    .filter((p) => elegidos[p.clave])
    .map((p) => {
      const e = elegidos[p.clave];
      return {
        nombre: p.nombre,
        categoria: p.categoria,
        precio: e.precio,
        costo: e.costo,
        unidad: p.unidad,
        porcionGramos: p.porcionGramos ?? null,
        porcionNombre: p.porcionNombre ?? null,
        envaseGramos: p.envaseGramos ?? null,
        inicial: Math.max(0, Math.round(Number(e.existencia) || 0)),
      };
    });

  function alternar(p: ProductoDeCatalogo) {
    setElegidos((e) => {
      if (e[p.clave]) {
        const { [p.clave]: _, ...otros } = e;
        return otros;
      }
      return { ...e, [p.clave]: { precio: "", costo: "", existencia: "" } };
    });
  }

  function reactivar(registro: ProductoRegistrado) {
    iniciar(async () => {
      const r = await accionReactivarProducto(registro.id);
      setReactivados((m) => ({ ...m, [registro.id]: r.ok ? "Reactivado: ya aparece en la Tienda." : r.mensaje }));
    });
  }

  const cambiar = (clave: string, campo: keyof Eleccion, valor: string) => setElegidos((e) => ({ ...e, [clave]: { ...e[clave], [campo]: valor } }));

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="con-lateral">
      <input type="hidden" name="productos" value={JSON.stringify(lote)} />
      <div className="bloques">
        {[...grupos.entries()].map(([categoria, lista]) => (
          <section key={categoria} aria-label={CATEGORIAS_PRODUCTO[categoria]} className="superficie">
            <h2 className="rotulo px-4 pb-1 pt-3.5">{CATEGORIAS_PRODUCTO[categoria]}</h2>
            <ul className="divide-y divide-dashed divide-linea">
              {lista.map((p) => {
                const registro = porNombre.get(claveDeNombre(p.nombre));
                const e = elegidos[p.clave];
                const granel = p.unidad === "gramo";
                const detalle = granel
                  ? `A granel · ${p.porcionNombre} de ${p.porcionGramos} g · bote de ${p.envaseGramos?.toLocaleString("es-MX")} g`
                  : (p.nota ?? "Por pieza");
                if (registro) {
                  const aviso = reactivados[registro.id];
                  return (
                    <li key={p.clave} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                      {/* Ya registrado: palomita (activo) o aviso (desactivado), no un botón para marcar. */}
                      <span
                        aria-hidden
                        className={`grid size-[22px] shrink-0 place-items-center rounded-full ${registro.activo || aviso ? "bg-verde-tenue text-verde" : "bg-ambar-tenue text-ambar"}`}
                      >
                        <Icono nombre={registro.activo || aviso ? "check" : "alerta"} className="size-[13px]" />
                      </span>
                      <Emblema {...dibujoDeProducto({ ...p, foto: registro.foto })} tamano="sm" apagado={!registro.activo && !aviso} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug text-tinta-suave">{p.nombre}</span>
                        <span className={`text-[0.8rem] ${aviso ? "font-semibold text-verde" : "text-gris"}`}>
                          {aviso ?? (registro.activo ? "Ya está en tu inventario." : "Ya lo tenías, pero está desactivado: no aparece en la Tienda.")}
                        </span>
                      </span>
                      {registro.activo ? (
                        <Link href={`/inventario/${registro.id}`} className="boton-secundario boton-chico">
                          Ver
                        </Link>
                      ) : (
                        <button type="button" onClick={() => reactivar(registro)} disabled={pendiente} className="boton-secundario boton-chico">
                          Reactivar
                        </button>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={p.clave} className={`px-4 py-3 ${e ? "bg-verde-tenue/40" : ""}`}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={Boolean(e)} onChange={() => alternar(p)} className="peer sr-only" />
                      <BotonDeRopa marcado={Boolean(e)} />
                      <Emblema {...dibujoDeProducto(p)} tamano="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug">{p.nombre}</span>
                        <span className="text-[0.8rem] text-gris">{detalle}</span>
                      </span>
                    </label>
                    {e && (
                      <div className={`aparece mt-3 grid gap-3 pl-9 ${granel ? "sm:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(0,1.6fr)]" : "sm:grid-cols-3"}`}>
                        <div>
                          <label htmlFor={`precio-${p.clave}`} className="etiqueta">
                            {granel ? `Precio por ${p.porcionNombre}` : "Precio"}
                          </label>
                          <CampoDinero
                            id={`precio-${p.clave}`}
                            nombre={`precio-${p.clave}`}
                            requerido
                            valor={e.precio}
                            alCambiar={(v) => cambiar(p.clave, "precio", v)}
                            atributos={{ "data-regla": "precio", "data-que": "El precio", "data-falta": "Pon el precio." }}
                          />
                          <Ayuda para={`precio-${p.clave}`} />
                        </div>
                        <div>
                          <label htmlFor={`costo-${p.clave}`} className="etiqueta">
                            {granel ? "Costo por bote" : "Costo"} <span className="font-normal text-gris">(opcional)</span>
                          </label>
                          <CampoDinero id={`costo-${p.clave}`} nombre={`costo-${p.clave}`} valor={e.costo} alCambiar={(v) => cambiar(p.clave, "costo", v)} />
                          <Ayuda para={`costo-${p.clave}`} />
                        </div>
                        <div className={granel ? "sm:col-span-2 xl:col-span-1" : ""}>
                          <label htmlFor={`existencia-${p.clave}`} className="etiqueta">
                            {granel ? "¿Cuánto tienes hoy?" : "Piezas que tienes hoy"}
                          </label>
                          {granel ? (
                            <CantidadGranel
                              id={`existencia-${p.clave}`}
                              granel={{ porcionGramos: p.porcionGramos ?? 1, porcionNombre: p.porcionNombre ?? "porción", envaseGramos: p.envaseGramos ?? null }}
                              gramos={Number(e.existencia) || 0}
                              alCambiar={(g, escrito) => cambiar(p.clave, "existencia", escrito ? String(g) : "")}
                              requerido
                              pista="Por ejemplo, 2 botes. Si todavía no tienes, escribe 0."
                            />
                          ) : (
                            <>
                              <input
                                id={`existencia-${p.clave}`}
                                name={`existencia-${p.clave}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={100000}
                                step={1}
                                required
                                value={e.existencia}
                                placeholder="0"
                                onChange={(ev) => cambiar(p.clave, "existencia", ev.target.value)}
                                className="campo tabular-nums"
                                data-que="La existencia"
                                data-falta="¿Cuántas tienes? Si ninguna, escribe 0."
                              />
                              <Ayuda para={`existencia-${p.clave}`} />
                            </>
                          )}
                        </div>
                      </div>
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
            <h2 className="font-titulos text-[1.3rem] leading-tight">Para dar de alta</h2>
            <p className="mt-1 text-[0.84rem] text-gris">
              {lote.length === 0 ? "Marca lo que vendes en tu gimnasio." : `${lote.length} ${lote.length === 1 ? "producto marcado" : "productos marcados"}.`}
            </p>
          </div>
          {lote.length > 0 && (
            <ul className="grid gap-1 text-[0.86rem]">
              {lote.map((p) => (
                <li key={p.nombre} className="truncate">
                  {p.nombre}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[0.8rem] text-gris">Después puedes ponerles código de barras, mínimo o cambiar el nombre desde cada producto.</p>
          <AvisosDelFormulario />
          <MensajeExito mensaje={estado.exito} />
          <BotonEnviar textoEnviando="Dando de alta…" className="w-full py-3" disabled={lote.length === 0}>
            Dar de alta {lote.length > 0 ? lote.length : ""}
          </BotonEnviar>
        </section>
      </aside>
    </Formulario>
  );
}
