"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { METODOS_PAGO } from "@/domain/entities/Pago";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { Icono } from "@/presentation/components/Icono";
import { MensajeError, MensajeExito } from "@/presentation/components/Mensajes";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { formatearDinero } from "@/shared/formato";
import { accionRegistrarVenta } from "./acciones";

export interface ProductoVendible {
  id: string;
  nombre: string;
  codigo: string | null;
  precio: number;
  stock: number;
}

/**
 * Cobro en mostrador: se buscan (o escanean) productos, se arma el ticket y
 * se cobra. El carrito vive en el navegador; el servidor valida precios y
 * existencias al cobrar.
 */
export function PuntoDeVenta({ productos }: { productos: ProductoVendible[] }) {
  const [estado, accion] = useActionState(accionRegistrarVenta, estadoInicial);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  useEffect(() => {
    if (estado.exito) {
      setCarrito({});
      setRecibido("");
    }
  }, [estado]);

  const texto = busqueda.trim().toLowerCase();
  const visibles = texto
    ? productos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.codigo?.toLowerCase().includes(texto))
    : productos;

  const partidas = Object.entries(carrito)
    .map(([id, cantidad]) => ({ producto: porId.get(id), cantidad }))
    .filter((p): p is { producto: ProductoVendible; cantidad: number } => Boolean(p.producto));
  const total = partidas.reduce((t, p) => t + p.cantidad * p.producto.precio, 0);
  const piezas = partidas.reduce((n, p) => n + p.cantidad, 0);
  const cambio = metodo === "efectivo" && recibido !== "" ? Number(recibido) - total : null;

  function cambiarCantidad(id: string, delta: number) {
    const producto = porId.get(id);
    if (!producto) return;
    setCarrito((c) => {
      const nueva = Math.min(producto.stock, Math.max(0, (c[id] ?? 0) + delta));
      const { [id]: _, ...resto } = c;
      return nueva === 0 ? resto : { ...resto, [id]: nueva };
    });
  }

  /** Un lector de código de barras "teclea" el código y presiona Enter. */
  function alPresionarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exacto = productos.find((p) => p.codigo && p.codigo.toLowerCase() === texto);
    const unico = visibles.length === 1 ? visibles[0] : undefined;
    const elegido = exacto ?? unico;
    if (elegido && elegido.stock > 0) {
      cambiarCantidad(elegido.id, 1);
      setBusqueda("");
    }
  }

  return (
    <form action={accion} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="partidas" value={JSON.stringify(partidas.map((p) => ({ productoId: p.producto.id, cantidad: p.cantidad })))} />

      <section aria-labelledby="titulo-productos" className="min-w-0 space-y-3">
        <h2 id="titulo-productos" className="sr-only">Productos</h2>
        <div className="relative">
          <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <label htmlFor="buscar-producto" className="sr-only">Buscar o escanear producto</label>
          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={alPresionarTecla}
            placeholder="Buscar por nombre o escanear código"
            autoComplete="off"
            className="campo py-2.5 pl-9"
          />
        </div>

        {visibles.length === 0 ? (
          <p className="superficie px-5 py-8 text-center text-gris">Ningún producto coincide con “{busqueda}”.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {visibles.map((p) => {
              const enCarrito = carrito[p.id] ?? 0;
              const disponible = p.stock - enCarrito;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(p.id, 1)}
                    disabled={disponible <= 0}
                    className={`flex h-full w-full flex-col justify-between gap-2 rounded-md border bg-superficie px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      enCarrito > 0 ? "border-tinta" : "border-linea hover:border-gris"
                    }`}
                  >
                    <span className="font-semibold leading-snug">{p.nombre}</span>
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="cifra text-lg">{formatearDinero(p.precio)}</span>
                      <span className={`text-sm tabular-nums ${p.stock === 0 ? "font-semibold text-rojo" : "text-gris"}`}>
                        {p.stock === 0 ? "Agotado" : `${disponible} disp.`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-ticket" className="superficie flex h-fit flex-col xl:sticky xl:top-6">
        <div className="flex items-baseline justify-between border-b border-linea px-5 py-3.5">
          <h2 id="titulo-ticket" className="subtitulo">Venta actual</h2>
          {piezas > 0 && (
            <button type="button" onClick={() => setCarrito({})} className="text-sm font-semibold text-gris hover:text-rojo">
              Vaciar
            </button>
          )}
        </div>

        {partidas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gris">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {partidas.map(({ producto, cantidad }) => (
              <li key={producto.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.93rem] font-semibold">{producto.nombre}</p>
                  <p className="text-sm text-gris tabular-nums">{formatearDinero(producto.precio)} c/u</p>
                </div>
                <div className="flex items-center rounded-md border border-linea-fuerte">
                  <button type="button" onClick={() => cambiarCantidad(producto.id, -1)} className="p-1.5 text-gris hover:text-tinta" aria-label={`Quitar una pieza de ${producto.nombre}`}>
                    <Icono nombre="menos" className="size-4" />
                  </button>
                  <span className="w-7 text-center font-semibold tabular-nums">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(producto.id, 1)}
                    disabled={cantidad >= producto.stock}
                    className="p-1.5 text-gris hover:text-tinta disabled:opacity-40"
                    aria-label={`Agregar una pieza de ${producto.nombre}`}
                  >
                    <Icono nombre="mas" className="size-4" />
                  </button>
                </div>
                <span className="w-16 text-right font-semibold tabular-nums">{formatearDinero(cantidad * producto.precio)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 border-t border-linea bg-hundido/50 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="rotulo">Total {piezas > 0 && `· ${piezas} ${piezas === 1 ? "pieza" : "piezas"}`}</span>
            <span className="cifra text-[2rem]">{formatearDinero(total)}</span>
          </div>

          <fieldset>
            <legend className="etiqueta">Método de pago</legend>
            <SelectorSegmentado completo nombre="metodo" opciones={METODOS_PAGO} valor={metodo} alCambiar={setMetodo} />
          </fieldset>

          {metodo === "efectivo" && (
            <div className="flex items-end gap-3">
              <div className="w-32">
                <label htmlFor="recibido" className="etiqueta">Recibido</label>
                <input
                  id="recibido"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  className="campo tabular-nums"
                />
              </div>
              {cambio !== null && (
                <p className={`pb-2 text-sm tabular-nums ${cambio < 0 ? "text-rojo" : ""}`}>
                  {cambio < 0 ? `Faltan ${formatearDinero(-cambio)}` : <>Cambio: <strong className="font-semibold">{formatearDinero(cambio)}</strong></>}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="nota" className="etiqueta">Nota <span className="font-normal text-gris">(opcional)</span></label>
            <input id="nota" name="nota" className="campo" placeholder="Ej. nombre del cliente" key={estado.exito} />
          </div>

          <MensajeError mensaje={estado.error} />
          <MensajeExito mensaje={piezas === 0 ? estado.exito : undefined} />

          <BotonEnviar textoEnviando="Cobrando…" className="w-full py-3 text-base" disabled={piezas === 0}>
            Cobrar {total > 0 && formatearDinero(total)}
          </BotonEnviar>
        </div>
      </section>
    </form>
  );
}
