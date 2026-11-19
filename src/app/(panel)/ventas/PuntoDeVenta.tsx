"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { CATEGORIAS_PRODUCTO, type CategoriaProducto, importeDe, type UnidadProducto } from "@/domain/entities/Producto";
import { LIMITES } from "@/domain/shared/reglas";
import { pluralizar } from "@/domain/shared/texto";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { normalizar } from "@/presentation/components/formulario/flotante";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Icono } from "@/presentation/components/Icono";
import { Emblema, HILO_DE_CATEGORIA } from "@/presentation/components/pictogramas/Emblema";
import { DIBUJO_DE_CATEGORIA, dibujoDeProducto } from "@/presentation/components/pictogramas/elegir";
import { useLectorDeCodigos } from "@/presentation/components/lectorDeCodigos";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionRegistrarVenta } from "./acciones";

export interface ProductoVendible {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: CategoriaProducto;
  /** Ruta de su foto, si tiene (si no, se dibuja su parche). */
  foto: string | null;
  /** Precio de la pieza, o de la porción a granel. */
  precio: number;
  /** Piezas, o gramos a granel. */
  stock: number;
  unidad: UnidadProducto;
  porcionGramos: number | null;
  porcionNombre: string | null;
  /** Entre lo que más se vende a esta hora. */
  frecuente: boolean;
}

const esGranel = (p: ProductoVendible) => p.unidad === "gramo" && Boolean(p.porcionGramos);
/** Lo que suma un toque: una pieza, o una porción a granel. */
const paso = (p: ProductoVendible) => (esGranel(p) ? p.porcionGramos! : 1);
// La misma cuenta que hace el servidor al cobrar, para que el total no difiera ni un centavo.
const importe = (p: ProductoVendible, cantidad: number) => importeDe({ unidad: p.unidad, precioVenta: p.precio, porcionGramos: p.porcionGramos }, cantidad);
const pluralDe = (palabra: string, n: number) => pluralizar(palabra, n);

/** "2 scoops · 60 g" o "3 piezas". */
function describir(p: ProductoVendible, cantidad: number) {
  if (!esGranel(p)) return `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"}`;
  const porciones = cantidad / p.porcionGramos!;
  const nombre = p.porcionNombre ?? "porción";
  return Number.isInteger(porciones) ? `${porciones} ${pluralDe(nombre, porciones)} · ${cantidad} g` : `${cantidad} g`;
}

/**
 * Cobro en mostrador. Lo que más se vende a esta hora queda arriba; cada
 * toque suma una pieza (o una porción a granel) y el lector de código de
 * barras funciona en cualquier momento. El servidor valida precios y
 * existencias al cobrar.
 */
/** Productos desactivados con código: si se escanean, se explica por qué no aparecen. */
export interface ProductoDesactivado {
  id: string;
  nombre: string;
  codigo: string;
}

export function PuntoDeVenta({
  productos,
  puedeDarDeAlta,
  desactivados = [],
}: {
  productos: ProductoVendible[];
  puedeDarDeAlta: boolean;
  desactivados?: ProductoDesactivado[];
}) {
  const [estado, accion] = useActionState(accionRegistrarVenta, estadoInicial);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaProducto | "todas">("todas");
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [desconocido, setDesconocido] = useState<string | null>(null);
  const [apagado, setApagado] = useState<ProductoDesactivado | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  // Cada toque cuenta: el "+1" vuelve a salir aunque se toque el mismo producto.
  const [pulso, setPulso] = useState(0);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos]);

  useEffect(() => {
    if (estado.exito) {
      setCarrito({});
      setRecibido("");
      setMetodo("efectivo");
    }
  }, [estado]);

  const texto = normalizar(busqueda.trim());
  const visibles = productos.filter(
    (p) =>
      (categoria === "todas" || p.categoria === categoria) &&
      (!texto || normalizar(p.nombre).includes(texto) || (p.codigo !== null && normalizar(p.codigo).includes(texto))),
  );
  const frecuentes = !texto && categoria === "todas" ? visibles.filter((p) => p.frecuente && p.stock > 0) : [];
  const resto = frecuentes.length > 0 ? visibles.filter((p) => !frecuentes.includes(p)) : visibles;

  const partidas = Object.entries(carrito)
    .map(([id, cantidad]) => ({ producto: porId.get(id), cantidad }))
    .filter((p): p is { producto: ProductoVendible; cantidad: number } => Boolean(p.producto));
  const total = Math.round(partidas.reduce((t, p) => t + importe(p.producto, p.cantidad), 0) * 100) / 100;
  const articulos = partidas.reduce((n, p) => n + (esGranel(p.producto) ? 1 : p.cantidad), 0);
  const cambio = metodo === "efectivo" && recibido !== "" ? Number(recibido) - total : null;
  // Si se anota lo recibido en efectivo, tiene que alcanzar para el total.
  const reglas = useMemo(
    () => ({ recibido: (valor: string) => (Number(valor) < total ? `Faltan ${formatearDinero(total - Number(valor))} para cubrir el total.` : null) }),
    [total],
  );

  function fijarCantidad(id: string, cantidad: number) {
    const producto = porId.get(id);
    if (!producto) return;
    setCarrito((c) => {
      const nueva = Math.min(producto.stock, Math.max(0, Math.round(cantidad) || 0));
      const { [id]: _, ...otros } = c;
      return nueva === 0 ? otros : { ...otros, [id]: nueva };
    });
  }

  function sumar(p: ProductoVendible) {
    setUltimo(p.id);
    setPulso((n) => n + 1);
    rebotar(p.id);
    setDesconocido(null);
    setApagado(null);
    fijarCantidad(p.id, (carrito[p.id] ?? 0) + paso(p));
  }

  function porCodigo(codigo: string) {
    const c = codigo.trim().toLowerCase();
    return productos.find((p) => p.codigo !== null && p.codigo.toLowerCase() === c);
  }

  // El lector de códigos funciona en toda la pantalla.
  useLectorDeCodigos((codigo) => {
    const p = porCodigo(codigo);
    if (p && p.stock - (carrito[p.id] ?? 0) >= paso(p)) sumar(p);
    else if (p) setDesconocido(`${p.nombre} ya no tiene existencia.`);
    else avisarCodigo(codigo);
  });

  /** Un código que no está a la venta: o es de un producto desactivado, o no existe. */
  function avisarCodigo(codigo: string) {
    const d = desactivados.find((x) => x.codigo.toLowerCase() === codigo.toLowerCase());
    setApagado(d ?? null);
    setDesconocido(d ? null : codigo);
  }

  /** En el buscador: Enter agrega el código exacto o el único resultado. */
  function alPresionarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const elegido = porCodigo(busqueda) ?? (visibles.length === 1 ? visibles[0] : undefined);
    if (elegido && elegido.stock - (carrito[elegido.id] ?? 0) >= paso(elegido)) {
      sumar(elegido);
      setBusqueda("");
    } else if (!elegido && /^[A-Za-z0-9-]{4,}$/.test(busqueda.trim())) {
      avisarCodigo(busqueda.trim());
    }
  }

  const tarjeta = (p: ProductoVendible) => {
    const enCarrito = carrito[p.id] ?? 0;
    const disponible = p.stock - enCarrito;
    return (
      <li key={p.id} data-producto={p.id}>
        <button
          type="button"
          onClick={() => sumar(p)}
          disabled={disponible < paso(p)}
          className={`mosaico relative flex h-full w-full items-center gap-3.5 rounded-[14px] border bg-superficie py-3 pl-3 pr-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
            enCarrito > 0 ? "mosaico-elegido border-tinta shadow-[inset_0_0_0_1px_var(--color-tinta)]" : "border-linea hover:border-gris"
          }`}
        >
          {ultimo === p.id && pulso > 0 && (
            <span key={pulso} aria-hidden className="mas-uno">
              +1{esGranel(p) ? ` ${p.porcionNombre ?? "porción"}` : ""}
            </span>
          )}
          <Emblema {...dibujoDeProducto(p)} tamano="md" apagado={p.stock < paso(p)} />
          <span className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 self-stretch">
          {enCarrito > 0 && (
            <span key={enCarrito} className="contador-carrito absolute -right-1.5 -top-1.5 grid min-w-6 place-items-center rounded-full bg-tinta px-1.5 text-[0.72rem] font-bold leading-6 text-white tabular-nums">
              {esGranel(p) ? Math.round((enCarrito / p.porcionGramos!) * 10) / 10 : enCarrito}
            </span>
          )}
          <span className="font-medium leading-snug">{p.nombre}</span>
          <span className="flex w-full items-baseline justify-between gap-2">
            <span className="cifra text-lg">
              {formatearDinero(p.precio)}
              {esGranel(p) && <span className="font-sans text-[0.75rem] text-gris"> / {p.porcionNombre ?? "porción"}</span>}
            </span>
            <span className={`text-sm tabular-nums ${p.stock < paso(p) ? "font-semibold text-rojo" : "text-gris"}`}>
              {p.stock < paso(p) ? "Agotado" : esGranel(p) ? `${Math.floor(disponible / p.porcionGramos!)} ${pluralDe(p.porcionNombre ?? "porción", Math.floor(disponible / p.porcionGramos!))}` : `${disponible} disp.`}
            </span>
          </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <Formulario
      action={accion}
      estado={estado}
      reglas={reglas}
      avisosManuales
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <input type="hidden" name="partidas" value={JSON.stringify(partidas.map((p) => ({ productoId: p.producto.id, cantidad: p.cantidad })))} />

      <section aria-labelledby="titulo-productos" className="min-w-0 space-y-3">
        <h2 id="titulo-productos" className="sr-only">Productos</h2>
        <div className="relative" data-lector-propio>
          <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <label htmlFor="buscar-producto" className="sr-only">Buscar o escanear producto</label>
          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={alPresionarTecla}
            placeholder="Buscar por nombre o código · el lector funciona en cualquier momento"
            autoComplete="off"
            className="campo py-2.5 pl-9"
          />
        </div>

        {categorias.length > 1 && (
          <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-1.5">
            {(["todas", ...categorias] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                aria-pressed={categoria === c}
                className={`flex items-center gap-1.5 rounded-full border py-1 text-[0.8rem] font-semibold ${c === "todas" ? "px-3" : "pl-1 pr-3"} ${categoria === c ? "border-tinta bg-tinta text-white" : "border-linea text-tinta-suave hover:border-gris"}`}
              >
                {c !== "todas" && <Emblema pictograma={DIBUJO_DE_CATEGORIA[c]} hilo={HILO_DE_CATEGORIA[c]} tamano="xxs" />}
                {c === "todas" ? "Todo" : CATEGORIAS_PRODUCTO[c]}
              </button>
            ))}
          </div>
        )}

        {apagado && (
          <p role="status" className="aparece flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-ambar-tenue px-4 py-2.5 text-[0.9rem]">
            <Icono nombre="alerta" className="size-[18px] text-ambar" />
            <span>
              <b>{apagado.nombre}</b> está desactivado, por eso no aparece en la Tienda.
            </span>
            {puedeDarDeAlta ? (
              <Link href={`/inventario/${apagado.id}`} className="enlace font-semibold">
                Reactivarlo
              </Link>
            ) : (
              <span className="text-gris">Pídele a la administración que lo reactive.</span>
            )}
            <button type="button" onClick={() => setApagado(null)} className="ml-auto text-gris hover:text-tinta" aria-label="Cerrar aviso">
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </p>
        )}

        {desconocido && (
          <p role="status" className="aparece flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-ambar-tenue px-4 py-2.5 text-[0.9rem]">
            <Icono nombre="alerta" className="size-[18px] text-ambar" />
            {/^[A-Za-z0-9-]+$/.test(desconocido) ? (
              <>
                <span>
                  El código <b className="tabular-nums">{desconocido}</b> no está registrado.
                </span>
                {puedeDarDeAlta ? (
                  <Link href={`/inventario/nuevo?codigo=${encodeURIComponent(desconocido)}`} className="enlace font-semibold">
                    Darlo de alta
                  </Link>
                ) : (
                  <span className="text-gris">Pídele a la administración que lo dé de alta.</span>
                )}
              </>
            ) : (
              <span>{desconocido}</span>
            )}
            <button type="button" onClick={() => setDesconocido(null)} className="ml-auto text-gris hover:text-tinta" aria-label="Cerrar aviso">
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </p>
        )}

        {visibles.length === 0 ? (
          <p className="superficie px-5 py-8 text-center text-gris">Ningún producto coincide con “{busqueda}”.</p>
        ) : (
          <>
            {frecuentes.length > 0 && (
              <>
                <p className="rotulo pt-1">Lo que más sale a esta hora</p>
                <ul className="escalonado grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">{frecuentes.map(tarjeta)}</ul>
                <p className="rotulo pt-2">Todos los productos</p>
              </>
            )}
            <ul key={categoria} className="escalonado grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">{resto.map(tarjeta)}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-ticket" className="superficie flex h-fit flex-col md:sticky md:top-6">
        <div className="flex items-baseline justify-between border-b border-linea px-5 py-3.5">
          <h2 id="titulo-ticket" className="subtitulo">Venta actual</h2>
          {partidas.length > 0 && (
            <button type="button" onClick={() => setCarrito({})} className="text-sm font-semibold text-gris hover:text-rojo">
              Vaciar
            </button>
          )}
        </div>

        {partidas.length === 0 ? (
          <div className="ticket-vacio grid justify-items-center gap-2 px-5 py-9 text-center text-sm text-gris">
            <Emblema icono="ventas" hilo="gris" tamano="md" />
            Toca un producto o escanea su código.
          </div>
        ) : (
          <ul className="divide-y divide-linea">
            {partidas.map(({ producto, cantidad }) => {
              const unidadTexto = esGranel(producto) ? `un ${producto.porcionNombre ?? "porción"}` : "una pieza";
              return (
                <li key={producto.id} className="entra-derecha grid gap-1.5 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Emblema {...dibujoDeProducto(producto)} tamano="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.93rem] font-semibold">{producto.nombre}</p>
                      <p className="text-sm text-gris tabular-nums">
                        {esGranel(producto) ? describir(producto, cantidad) : `${formatearDinero(producto.precio)} c/u`}
                      </p>
                    </div>
                    <div className="flex items-center rounded-full border border-linea">
                      <button
                        type="button"
                        onClick={() => fijarCantidad(producto.id, cantidad - paso(producto))}
                        className="p-1.5 text-gris hover:text-tinta"
                        aria-label={`Quitar ${unidadTexto} de ${producto.nombre}`}
                      >
                        <Icono nombre="menos" className="size-4" />
                      </button>
                      <span className="min-w-7 text-center font-semibold tabular-nums">
                        {esGranel(producto) ? Math.round((cantidad / paso(producto)) * 10) / 10 : cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => fijarCantidad(producto.id, cantidad + paso(producto))}
                        disabled={cantidad + paso(producto) > producto.stock}
                        className="p-1.5 text-gris hover:text-tinta disabled:opacity-40"
                        aria-label={`Agregar ${unidadTexto} de ${producto.nombre}`}
                      >
                        <Icono nombre="mas" className="size-4" />
                      </button>
                    </div>
                    <span className="w-16 text-right font-semibold tabular-nums">{formatearDinero(importe(producto, cantidad))}</span>
                  </div>
                  {esGranel(producto) && (
                    <label className="flex items-center gap-2 text-[0.8rem] text-gris" data-lector-propio>
                      O por gramos exactos:
                      <input
                        type="number"
                        min={1}
                        max={producto.stock}
                        step={1}
                        value={cantidad}
                        onChange={(e) => fijarCantidad(producto.id, Number(e.target.value))}
                        className="campo w-24 px-2 py-1 text-[0.85rem] tabular-nums"
                        aria-label={`Gramos de ${producto.nombre}`}
                        data-propio
                      />
                      g
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-4 border-t border-linea bg-hundido/50 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="rotulo">Total {articulos > 0 && `· ${articulos} ${articulos === 1 ? "artículo" : "artículos"}`}</span>
            <span key={total} className={`cifra text-[2rem] ${total > 0 ? "late" : ""}`}>
              {formatearDinero(total)}
            </span>
          </div>

          <fieldset>
            <legend className="etiqueta">Método de pago</legend>
            <SelectorSegmentado completo nombre="metodo" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
          </fieldset>

          {metodo === "efectivo" && (
            <div>
              <div className="flex items-end gap-3">
                <div className="w-44">
                  <Etiqueta para="recibido" opcional>
                    Recibido
                  </Etiqueta>
                  <CampoDinero id="recibido" nombre="recibido" placeholder="0" valor={recibido} alCambiar={setRecibido} atributos={{ "data-que": "Lo recibido" }} />
                </div>
                {cambio !== null && (
                  <p className={`pb-3 text-sm tabular-nums ${cambio < 0 ? "font-semibold text-rojo" : ""}`}>
                    {cambio < 0 ? `Faltan ${formatearDinero(-cambio)}` : <>Cambio: <strong className="font-semibold">{formatearDinero(cambio)}</strong></>}
                  </p>
                )}
              </div>
              <Ayuda para="recibido">Escríbelo para calcular el cambio.</Ayuda>
            </div>
          )}

          <div>
            <Etiqueta para="nota" opcional>
              Nota
            </Etiqueta>
            <input id="nota" name="nota" className="campo" maxLength={LIMITES.nota} placeholder="Ej. nombre del cliente" key={estado.exito} />
          </div>

          <AvisosDelFormulario />
          <MensajeExito mensaje={partidas.length === 0 ? estado.exito : undefined} />

          <BotonEnviar textoEnviando="Cobrando…" className="w-full py-3 text-base" disabled={partidas.length === 0}>
            <span className="inline-flex items-center gap-2">
              <Icono nombre="ventas" className="size-[18px]" />
              Cobrar {total > 0 && formatearDinero(total)}
            </span>
          </BotonEnviar>
        </div>
      </section>
    </Formulario>
  );
}

/**
 * El dibujo del producto tocado da un brinquito. Con la animación del
 * navegador (no con una clase) para que vuelva a brincar en cada toque,
 * aunque sea el mismo producto.
 */
function rebotar(id: string) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dibujo = document.querySelector(`[data-producto="${CSS.escape(id)}"] .emblema > *`);
  dibujo?.animate(
    [
      { transform: "none" },
      { transform: "translateY(-3px) scale(1.2) rotate(-9deg)", offset: 0.35 },
      { transform: "scale(0.95) rotate(3deg)", offset: 0.68 },
      { transform: "none" },
    ],
    { duration: 480, easing: "ease-out" },
  );
}
