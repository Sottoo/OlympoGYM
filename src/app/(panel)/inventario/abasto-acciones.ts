"use server";

import { revalidatePath } from "next/cache";
import type { CategoriaProducto, DatosProducto, UnidadProducto } from "@/domain/entities/Producto";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, mensajeDeError, texto } from "@/presentation/acciones/estadoFormulario";
import { formatearDinero } from "@/shared/formato";

function actualizarVistas() {
  revalidatePath("/inventario", "layout");
  revalidatePath("/ventas");
  revalidatePath("/panel");
}

/** Lee el JSON que arma la pantalla; si viene mal, se trata como vacío. */
function leerLista<T>(formData: FormData, campo: string): T[] {
  try {
    const valor = JSON.parse(texto(formData, campo) || "[]");
    return Array.isArray(valor) ? (valor as T[]) : [];
  } catch {
    return [];
  }
}

interface NuevoEnPantalla {
  codigo: string;
  nombre: string;
  categoria: string;
  precio: string;
  costo: string;
  cantidad: number;
}

const aDatos = (n: { nombre: string; categoria: string; codigo?: string | null; precio: string | number; costo?: string | number | null; unidad?: string; porcionGramos?: number | null; porcionNombre?: string | null; envaseGramos?: number | null }): DatosProducto => ({
  nombre: String(n.nombre ?? ""),
  categoria: n.categoria as CategoriaProducto,
  codigo: n.codigo ? String(n.codigo) : null,
  precioVenta: n.precio === "" ? Number.NaN : Number(n.precio),
  costo: n.costo === "" || n.costo === null || n.costo === undefined ? null : Number(n.costo),
  stockMinimo: 0,
  unidad: (n.unidad as UnidadProducto) ?? "pieza",
  porcionGramos: n.porcionGramos ?? null,
  porcionNombre: n.porcionNombre ?? null,
  envaseGramos: n.envaseGramos ?? null,
});

export async function accionRecibirMercancia(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const partidas = leerLista<{ productoId: string; cantidad: number }>(formData, "partidas").map((p) => ({
      productoId: String(p.productoId),
      cantidad: Number(p.cantidad),
    }));
    const nuevos = leerLista<NuevoEnPantalla>(formData, "nuevos").map((n) => ({ datos: { ...aDatos(n), stockMinimo: 3 }, cantidad: Number(n.cantidad) }));
    const r = await (await casosDeUso()).recibirMercancia.ejecutar({ partidas, nuevos, nota: texto(formData, "nota") });
    actualizarVistas();
    const partes = [r.productos > 0 && `${r.productos} ${r.productos === 1 ? "producto" : "productos"} con entrada`, r.nuevos > 0 && `${r.nuevos} ${r.nuevos === 1 ? "producto nuevo dado" : "productos nuevos dados"} de alta`].filter(Boolean);
    return { exito: `Listo: ${partes.join(" y ")}. Las existencias ya están actualizadas.` };
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
}

export async function accionContarInventario(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const conteos = leerLista<{ productoId: string; contado: number }>(formData, "conteos").map((c) => ({
      productoId: String(c.productoId),
      contado: Number(c.contado),
    }));
    if (conteos.length === 0) return { error: "Escribe lo que contaste en al menos un producto." };
    const r = await (await casosDeUso()).contarInventario.ejecutar(conteos, texto(formData, "nota"));
    actualizarVistas();
    if (r.ajustados === 0) return { exito: `Todo cuadra: lo contado coincide con lo registrado en ${conteos.length} ${conteos.length === 1 ? "producto" : "productos"}.` };
    const detalle = [
      r.faltanteImporte > 0 && `faltó mercancía por ${formatearDinero(r.faltanteImporte)} a precio de venta`,
      r.sobranteImporte > 0 && `sobró por ${formatearDinero(r.sobranteImporte)}`,
    ].filter(Boolean);
    return { exito: `Conteo guardado: ${r.ajustados === 1 ? "se ajustó 1 producto" : `se ajustaron ${r.ajustados} productos`}${detalle.length ? `; ${detalle.join(" y ")}` : ""}.` };
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
}

export async function accionAltaCatalogo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const lote = leerLista<{
      nombre: string; categoria: string; precio: string; costo: string; unidad: string;
      porcionGramos: number | null; porcionNombre: string | null; envaseGramos: number | null; inicial: number;
    }>(formData, "productos").map((p) => ({ datos: { ...aDatos(p), stockMinimo: p.unidad === "gramo" ? (p.envaseGramos ?? 0) : 3 }, inicial: Number(p.inicial) || 0 }));
    const creados = await (await casosDeUso()).altaDesdeCatalogo.ejecutar(lote);
    actualizarVistas();
    return { exito: `${creados} ${creados === 1 ? "producto dado" : "productos dados"} de alta. Ya aparecen en la Tienda.` };
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
}
