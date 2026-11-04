"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CATEGORIAS_PRODUCTO, type CategoriaProducto, existenciaGranel, type UnidadProducto } from "@/domain/entities/Producto";
import { LIMITES } from "@/domain/shared/reglas";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { normalizar } from "@/presentation/components/formulario/flotante";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Icono } from "@/presentation/components/Icono";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { useLectorDeCodigos } from "@/presentation/components/lectorDeCodigos";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { accionRecibirMercancia } from "../abasto-acciones";
import { accionReactivarProducto } from "../acciones";

export interface ProductoParaRecibir {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: CategoriaProducto;
  stock: number;
  unidad: UnidadProducto;
  porcionGramos: number | null;
  porcionNombre: string | null;
  envaseGramos: number | null;
  foto: string | null;
}

interface Nuevo {
  clave: number;
  codigo: string;
  nombre: string;
  categoria: CategoriaProducto;
  precio: string;
  costo: string;
  cantidad: number;
}

/** En qué se captura lo que llegó: piezas, botes (a granel con envase) o gramos. */
const capturaEn = (p: ProductoParaRecibir): "piezas" | "botes" | "gramos" =>
  p.unidad !== "gramo" ? "piezas" : p.envaseGramos ? "botes" : "gramos";
/** Lo capturado, en la unidad de la existencia (piezas o gramos). */
const aUnidades = (p: ProductoParaRecibir, n: number) => (capturaEn(p) === "botes" ? n * p.envaseGramos! : n);
const pasoCaptura = (p: ProductoParaRecibir) => (capturaEn(p) === "gramos" ? (p.porcionGramos ?? 1) : 1);
const existencia = (p: ProductoParaRecibir, n = p.stock) =>
  p.unidad === "gramo" ? existenciaGranel(p, n).principal : `${n} ${n === 1 ? "pieza" : "piezas"}`;

/**
 * Llegó mercancía: todo lo que trajo el proveedor en una sola pantalla.
 * Se le da + a cada producto o se escanea pieza por pieza; un código que no
 * existe se da de alta ahí mismo. Se guarda todo junto.
 */
export function RecepcionDeMercancia({
  productos,
  inicial,
  desactivados = [],
}: {
  productos: ProductoParaRecibir[];
  inicial: Record<string, number>;
  /** Si se escanea uno de estos, se ofrece reactivarlo en vez de darlo de alta otra vez. */
  desactivados?: ProductoParaRecibir[];
}) {
  const [estado, accion] = useActionState(accionRecibirMercancia, estadoInicial);
  const [cantidades, setCantidades] = useState<Record<string, number>>(inicial);
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [apagado, setApagado] = useState<ProductoParaRecibir | null>(null);
  const [reactivando, iniciar] = useTransition();
  const filas = useRef(new Map<string, HTMLLIElement>());
  const siguienteClave = useRef(1);

  useEffect(() => {
    if (estado.exito) {
      setCantidades({});
      setNuevos([]);
      setBusqueda("");
    }
  }, [estado]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const texto = normalizar(busqueda.trim());
  const visibles = texto ? productos.filter((p) => normalizar(p.nombre).includes(texto) || (p.codigo !== null && normalizar(p.codigo).includes(texto))) : productos;
  // Lo que ya lleva cantidad, arriba: así se ve lo que se va registrando.
  const ordenados = [...visibles].sort((a, b) => Number((cantidades[b.id] ?? 0) > 0) - Number((cantidades[a.id] ?? 0) > 0));

  function fijar(id: string, n: number) {
    setCantidades((c) => {
      const { [id]: _, ...otros } = c;
      return n > 0 ? { ...otros, [id]: n } : otros;
    });
  }

  function sumarNuevo(codigo: string) {
    setNuevos((lista) => {
      const existente = lista.find((n) => n.codigo.toLowerCase() === codigo.toLowerCase());
      if (existente) return lista.map((n) => (n === existente ? { ...n, cantidad: n.cantidad + 1 } : n));
      return [...lista, { clave: siguienteClave.current++, codigo, nombre: "", categoria: "otros", precio: "", costo: "", cantidad: 1 }];
    });
  }

  useLectorDeCodigos((codigo) => {
    const p = productos.find((x) => x.codigo !== null && x.codigo.toLowerCase() === codigo.toLowerCase());
    if (p) {
      fijar(p.id, (cantidades[p.id] ?? 0) + pasoCaptura(p));
      setResaltado(p.id);
      setAviso(null);
      filas.current.get(p.id)?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      const d = desactivados.find((x) => x.codigo !== null && x.codigo.toLowerCase() === codigo.toLowerCase());
      if (d) {
        setApagado(d);
        setAviso(null);
        return;
      }
      sumarNuevo(codigo);
      setApagado(null);
      setAviso(`El código ${codigo} es nuevo: complétalo abajo para darlo de alta.`);
    }
  });

  function reactivar(d: ProductoParaRecibir) {
    iniciar(async () => {
      const r = await accionReactivarProducto(d.id);
      setApagado(null);
      if (!r.ok) return setAviso(r.mensaje);
      fijar(d.id, (cantidades[d.id] ?? 0) + pasoCaptura(d));
      setResaltado(d.id);
      setAviso(`${d.nombre} se reactivó y ya lleva +1. Sigue escaneando.`);
    });
  }

  const partidas = Object.entries(cantidades)
    .map(([id, n]) => ({ producto: porId.get(id), n }))
    .filter((x): x is { producto: ProductoParaRecibir; n: number } => Boolean(x.producto) && x.n > 0);
  const piezas = partidas.filter((x) => capturaEn(x.producto) === "piezas").reduce((t, x) => t + x.n, 0);
  const botes = partidas.filter((x) => capturaEn(x.producto) === "botes").reduce((t, x) => t + x.n, 0);
  const totalProductos = partidas.length + nuevos.length;

  return (
    <Formulario action={accion} estado={estado} avisosManuales className="con-lateral">
      <input
        type="hidden"
        name="partidas"
        value={JSON.stringify(partidas.map(({ producto, n }) => ({ productoId: producto.id, cantidad: aUnidades(producto, n) })))}
      />
      <input type="hidden" name="nuevos" value={JSON.stringify(nuevos)} />

      <div className="bloques">
        <div className="relative" data-lector-propio>
          <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <label htmlFor="buscar-recepcion" className="sr-only">Buscar producto</label>
          <input
            id="buscar-recepcion"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Buscar producto · o escanea cada pieza con el lector"
            autoComplete="off"
            className="campo py-2.5 pl-9"
          />
        </div>

        {aviso && (
          <p role="status" className="aparece rounded-[10px] bg-ambar-tenue px-4 py-2.5 text-[0.9rem]">
            {aviso}
          </p>
        )}

        {apagado && (
          <p role="status" className="aparece flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] bg-ambar-tenue px-4 py-2.5 text-[0.9rem]">
            <span className="min-w-0 flex-1">
              Ese código es de <b>{apagado.nombre}</b>, que está desactivado. Reactívalo para sumar lo que llegó (conserva su historial).
            </span>
            <button type="button" onClick={() => reactivar(apagado)} disabled={reactivando} className="boton boton-chico">
              {reactivando ? "Reactivando…" : "Reactivar y sumar"}
            </button>
            <button type="button" onClick={() => setApagado(null)} className="boton-secundario boton-chico">
              Ahora no
            </button>
          </p>
        )}

        {nuevos.length > 0 && (
          <section aria-labelledby="t-nuevos" className="panel grid gap-4 px-6 py-[22px]">
            <div>
              <h2 id="t-nuevos" className="font-titulos text-[1.3rem] leading-tight">Productos nuevos</h2>
              <p className="mt-1 text-[0.84rem] text-gris">Llegaron con un código que no estaba registrado. Ponles nombre y precio y se dan de alta al guardar.</p>
            </div>
            {nuevos.map((n, i) => (
              <div key={n.clave} className="grid gap-3 border-t border-dashed border-linea pt-4 first-of-type:border-0 first-of-type:pt-0 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div>
                  <Etiqueta para={`nuevo-nombre-${n.clave}`}>Nombre</Etiqueta>
                  <input
                    id={`nuevo-nombre-${n.clave}`}
                    name={`nuevo-nombre-${n.clave}`}
                    required
                    autoFocus={i === nuevos.length - 1}
                    maxLength={LIMITES.nombreProducto}
                    className="campo"
                    placeholder="Ej. Suero oral 625 ml, coco"
                    value={n.nombre}
                    onChange={(e) => setNuevos((l) => l.map((x) => (x.clave === n.clave ? { ...x, nombre: e.target.value } : x)))}
                    data-regla="texto:2"
                    data-falta="Escribe el nombre del producto."
                  />
                  <Ayuda para={`nuevo-nombre-${n.clave}`}>Código {n.codigo}</Ayuda>
                </div>
                <div>
                  <Etiqueta para={`nuevo-categoria-${n.clave}`}>Categoría</Etiqueta>
                  <select
                    id={`nuevo-categoria-${n.clave}`}
                    className="campo"
                    value={n.categoria}
                    onChange={(e) => setNuevos((l) => l.map((x) => (x.clave === n.clave ? { ...x, categoria: e.target.value as CategoriaProducto } : x)))}
                  >
                    {Object.entries(CATEGORIAS_PRODUCTO).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Etiqueta para={`nuevo-precio-${n.clave}`}>Precio de venta</Etiqueta>
                  <CampoDinero
                    id={`nuevo-precio-${n.clave}`}
                    nombre={`nuevo-precio-${n.clave}`}
                    requerido
                    valor={n.precio}
                    alCambiar={(v) => setNuevos((l) => l.map((x) => (x.clave === n.clave ? { ...x, precio: v } : x)))}
                    atributos={{ "data-regla": "precio", "data-que": "El precio", "data-falta": "Escribe el precio." }}
                  />
                  <Ayuda para={`nuevo-precio-${n.clave}`} />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Etiqueta para={`nuevo-cantidad-${n.clave}`}>Llegaron</Etiqueta>
                    <Contador
                      id={`nuevo-cantidad-${n.clave}`}
                      valor={n.cantidad}
                      alCambiar={(v) => setNuevos((l) => l.map((x) => (x.clave === n.clave ? { ...x, cantidad: v } : x)))}
                      unidad="piezas"
                    />
                  </div>
                  <button type="button" onClick={() => setNuevos((l) => l.filter((x) => x.clave !== n.clave))} className="boton-secundario boton-chico mb-1.5">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section aria-label="Productos" className="superficie">
          {ordenados.length === 0 ? (
            <p className="px-5 py-8 text-center text-gris">Ningún producto coincide con “{busqueda}”.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-linea">
              {ordenados.map((p) => {
                const n = cantidades[p.id] ?? 0;
                const en = capturaEn(p);
                return (
                  <li
                    key={p.id}
                    ref={(el) => {
                      if (el) filas.current.set(p.id, el);
                      else filas.current.delete(p.id);
                    }}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${n > 0 ? "bg-verde-tenue/50" : ""} ${resaltado === p.id ? "toque" : ""}`}
                  >
                    <Emblema {...dibujoDeProducto(p)} tamano="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{p.nombre}</p>
                      <p className="text-[0.8rem] text-gris">
                        Hay {existencia(p)}
                        {n > 0 && (
                          <span className="font-semibold text-verde">
                            {" "}
                            → quedarán {existencia(p, p.stock + aUnidades(p, n))}
                          </span>
                        )}
                        {en === "botes" && ` · bote de ${p.envaseGramos!.toLocaleString("es-MX")} g`}
                      </p>
                    </div>
                    <Contador
                      id={`llego-${p.id}`}
                      valor={n}
                      alCambiar={(v) => fijar(p.id, v)}
                      paso={pasoCaptura(p)}
                      unidad={en}
                      etiqueta={`Cuántos ${en} de ${p.nombre} llegaron`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="bloques">
        <section className="panel grid gap-4 px-6 py-[22px] xl:sticky xl:top-6">
          <div>
            <h2 className="font-titulos text-[1.3rem] leading-tight">Lo que llegó</h2>
            <p className="mt-1 text-[0.84rem] text-gris">
              {totalProductos === 0
                ? "Dale + a lo que llegó o escanéalo."
                : [
                    `${totalProductos} ${totalProductos === 1 ? "producto" : "productos"}`,
                    piezas > 0 && `${piezas} ${piezas === 1 ? "pieza" : "piezas"}`,
                    botes > 0 && `${botes} ${botes === 1 ? "bote" : "botes"}`,
                    nuevos.length > 0 && `${nuevos.length} ${nuevos.length === 1 ? "nuevo" : "nuevos"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          {partidas.length > 0 && (
            <ul className="grid gap-1 text-[0.86rem]">
              {partidas.map(({ producto, n }) => (
                <li key={producto.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{producto.nombre}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    +{n} {capturaEn(producto) === "gramos" ? "g" : capturaEn(producto) === "botes" ? (n === 1 ? "bote" : "botes") : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Etiqueta para="nota" opcional>
              Proveedor o factura
            </Etiqueta>
            <input id="nota" name="nota" maxLength={LIMITES.nota} className="campo" placeholder="Ej. Distribuidora del Norte, factura 4521" />
            <Ayuda para="nota">Queda anotado en cada entrada.</Ayuda>
          </div>
          <AvisosDelFormulario />
          <MensajeExito mensaje={estado.exito} />
          <BotonEnviar textoEnviando="Guardando…" className="w-full py-3" disabled={totalProductos === 0}>
            Guardar entrada
          </BotonEnviar>
        </section>
      </aside>
    </Formulario>
  );
}

/** Cantidad con − y +, cómoda de tocar. */
function Contador({
  id,
  valor,
  alCambiar,
  paso = 1,
  unidad,
  etiqueta,
}: {
  id: string;
  valor: number;
  alCambiar: (v: number) => void;
  paso?: number;
  unidad: string;
  etiqueta?: string;
}) {
  return (
    <div className="flex items-center gap-2" data-lector-propio>
      <div className="flex items-center rounded-full border border-linea bg-elevado">
        <button type="button" onClick={() => alCambiar(Math.max(0, valor - paso))} disabled={valor <= 0} className="p-2 text-gris hover:text-tinta disabled:opacity-30" aria-label="Uno menos">
          <Icono nombre="menos" className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          min={0}
          max={1_000_000}
          value={valor === 0 ? "" : valor}
          placeholder="0"
          onChange={(e) => alCambiar(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          aria-label={etiqueta}
          className="w-14 bg-transparent text-center font-semibold tabular-nums outline-none"
          data-propio
        />
        <button type="button" onClick={() => alCambiar(valor + paso)} className="p-2 text-gris hover:text-tinta" aria-label="Uno más">
          <Icono nombre="mas" className="size-4" />
        </button>
      </div>
      <span className="w-12 text-[0.8rem] text-gris">{unidad}</span>
    </div>
  );
}
