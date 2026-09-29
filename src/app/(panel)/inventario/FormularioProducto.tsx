"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CATEGORIAS_PRODUCTO, type DatosProducto } from "@/domain/entities/Producto";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MensajeError } from "@/presentation/components/Mensajes";
import { accionCrearProducto, accionEditarProducto } from "./acciones";

/** Alta o edición de un producto. El stock no se edita aquí: cambia con movimientos. */
export function FormularioProducto({ producto }: { producto?: DatosProducto & { id: string } }) {
  const [estado, accion] = useActionState(producto ? accionEditarProducto : accionCrearProducto, estadoInicial);
  const v = estado.valores ?? (producto ? aTexto(producto) : { stockMinimo: "3", stockInicial: "0" });

  return (
    <form action={accion} className="superficie max-w-3xl">
      {producto && <input type="hidden" name="productoId" value={producto.id} />}
      <div className="space-y-6 p-5 sm:p-7">
        <MensajeError mensaje={estado.error} />

        <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label htmlFor="nombre" className="etiqueta">Nombre del producto</label>
            <input id="nombre" name="nombre" required className="campo" defaultValue={v.nombre} placeholder="Ej. Proteína whey 2 lb, vainilla" />
          </div>
          <div>
            <label htmlFor="categoria" className="etiqueta">Categoría</label>
            <select id="categoria" name="categoria" className="campo" defaultValue={v.categoria ?? "suplementos"}>
              {Object.entries(CATEGORIAS_PRODUCTO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="codigo" className="etiqueta">Código de barras o clave <span className="font-normal text-gris">(opcional)</span></label>
            <input id="codigo" name="codigo" className="campo max-w-xs tabular-nums" defaultValue={v.codigo} />
            <p className="ayuda">Si lo capturas, en Ventas puedes escanearlo con un lector para agregarlo al instante.</p>
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Precio</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="precioVenta" className="etiqueta">Precio de venta (MXN)</label>
              <input id="precioVenta" name="precioVenta" type="number" min={0} step="0.01" required inputMode="decimal" className="campo tabular-nums" defaultValue={v.precioVenta} />
            </div>
            <div>
              <label htmlFor="costo" className="etiqueta">Costo por pieza <span className="font-normal text-gris">(opcional)</span></label>
              <input id="costo" name="costo" type="number" min={0} step="0.01" inputMode="decimal" className="campo tabular-nums" defaultValue={v.costo} />
              <p className="ayuda">Lo que le pagas al proveedor. Sirve para ver el margen y el valor del inventario.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Existencias</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {!producto && (
              <div>
                <label htmlFor="stockInicial" className="etiqueta">Piezas en existencia hoy</label>
                <input id="stockInicial" name="stockInicial" type="number" min={0} step={1} inputMode="numeric" className="campo tabular-nums" defaultValue={v.stockInicial} />
                <p className="ayuda">Se registra como la primera entrada del producto.</p>
              </div>
            )}
            <div>
              <label htmlFor="stockMinimo" className="etiqueta">Stock mínimo</label>
              <input id="stockMinimo" name="stockMinimo" type="number" min={0} step={1} inputMode="numeric" className="campo tabular-nums" defaultValue={v.stockMinimo} />
              <p className="ayuda">Al llegar a esta cantidad, el producto aparece en “Por resurtir”.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">{producto ? "Guardar cambios" : "Dar de alta producto"}</BotonEnviar>
        <Link href={producto ? `/inventario/${producto.id}` : "/inventario"} className="boton-secundario">Cancelar</Link>
      </div>
    </form>
  );
}

function aTexto(p: DatosProducto): Record<string, string> {
  return {
    nombre: p.nombre,
    categoria: p.categoria,
    codigo: p.codigo ?? "",
    precioVenta: String(p.precioVenta),
    costo: p.costo === null ? "" : String(p.costo),
    stockMinimo: String(p.stockMinimo),
  };
}
