"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AreaEquipo, DatosEquipo, PagoInicial, TipoMantenimiento } from "@/domain/entities/Mantenimiento";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, fallo, mensajeDeError, texto } from "@/presentation/acciones/estadoFormulario";
import { formatearDinero } from "@/shared/formato";

/** Vacío → null; texto que no es número → NaN (lo rechaza la validación). */
const numero = (formData: FormData, campo: string) => {
  const valor = texto(formData, campo).trim();
  return valor === "" ? null : Number(valor);
};

function actualizarVistas() {
  revalidatePath("/mantenimiento", "layout");
  revalidatePath("/panel");
  revalidatePath("/ventas");
  revalidatePath("/metricas");
}

const datosEquipo = (formData: FormData): DatosEquipo => ({
  nombre: texto(formData, "nombre"),
  area: texto(formData, "area") as AreaEquipo,
  marca: texto(formData, "marca") || null,
  modelo: texto(formData, "modelo") || null,
  numeroSerie: texto(formData, "numeroSerie") || null,
  fechaCompra: texto(formData, "fechaCompra") || null,
  frecuenciaMeses: numero(formData, "frecuenciaMeses"),
  servicioBase: texto(formData, "servicioBase") || null,
  nota: texto(formData, "nota") || null,
});

export async function accionGuardarEquipo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = texto(formData, "equipoId") || undefined;
  let equipoId: string;
  try {
    equipoId = (await (await casosDeUso()).guardarEquipo.ejecutar({ id, datos: datosEquipo(formData) })).id;
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  redirect(`/mantenimiento/equipos/${equipoId}?aviso=${id ? "editado" : "nuevo"}`);
}

export async function accionAltaRapida(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let creados: number;
  try {
    let elegidos: { clave: string; cantidad: number; frecuenciaMeses: number | null }[] = [];
    try {
      const valor = JSON.parse(texto(formData, "equipos") || "[]");
      if (Array.isArray(valor)) elegidos = valor;
    } catch {
      elegidos = [];
    }
    creados = await (await casosDeUso()).altaRapidaDeEquipos.ejecutar(
      elegidos.map((e) => ({ clave: String(e.clave), cantidad: Number(e.cantidad), frecuenciaMeses: e.frecuenciaMeses ? Number(e.frecuenciaMeses) : null })),
    );
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  actualizarVistas();
  redirect(`/mantenimiento?aviso=alta&n=${creados}`);
}

export async function accionCambiarEstadoEquipo(formData: FormData) {
  const equipoId = texto(formData, "equipoId");
  const activo = texto(formData, "activo") === "true";
  await (await casosDeUso()).cambiarEstadoEquipo.ejecutar(equipoId, activo);
  actualizarVistas();
  redirect(`/mantenimiento/equipos/${equipoId}?aviso=${activo ? "reactivado" : "baja"}`);
}

export async function accionEliminarEquipo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let nombre: string;
  try {
    nombre = await (await casosDeUso()).eliminarEquipo.ejecutar(texto(formData, "equipoId"));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  actualizarVistas();
  redirect(`/mantenimiento?eliminado=${encodeURIComponent(nombre)}`);
}

export async function accionRegistrarMantenimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let id: string;
  try {
    const tipoPago = texto(formData, "pago");
    const metodo = texto(formData, "metodo") as MetodoPago;
    const pago: PagoInicial =
      tipoPago === "a_deber"
        ? { tipo: "a_deber" }
        : { tipo: tipoPago === "anticipo" ? "anticipo" : "completo", monto: numero(formData, "anticipo") ?? Number.NaN, metodo };
    id = await (await casosDeUso()).registrarMantenimiento.ejecutar(
      {
        equipoId: texto(formData, "equipoId"),
        fecha: texto(formData, "fecha"),
        tipo: texto(formData, "tipo") as TipoMantenimiento,
        descripcion: texto(formData, "descripcion"),
        proveedor: texto(formData, "proveedor") || null,
        manoDeObra: numero(formData, "manoDeObra") ?? 0,
        refacciones: numero(formData, "refacciones") ?? 0,
        nota: texto(formData, "nota") || null,
      },
      pago,
      formData.getAll("resuelve").map(String),
    );
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  redirect(`/mantenimiento/registro/${id}?aviso=nuevo`);
}

export async function accionEliminarMantenimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let equipoId: string;
  try {
    ({ equipoId } = await (await casosDeUso()).eliminarMantenimiento.ejecutar(texto(formData, "mantenimientoId")));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  actualizarVistas();
  redirect(`/mantenimiento/equipos/${equipoId}?aviso=registro-eliminado`);
}

export async function accionRegistrarAbono(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const mantenimientoId = texto(formData, "mantenimientoId");
  let saldo: number;
  try {
    ({ saldo } = await (await casosDeUso()).registrarAbono.ejecutar({
      mantenimientoId,
      monto: numero(formData, "monto") ?? Number.NaN,
      metodo: texto(formData, "metodo") as MetodoPago,
      fecha: texto(formData, "fecha"),
      nota: texto(formData, "nota") || null,
    }));
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  // Liquidado: el formulario de pago desaparece, así que el aviso va arriba en la página.
  if (saldo <= 0) redirect(`/mantenimiento/registro/${mantenimientoId}?aviso=liquidado`);
  return { exito: `Pago registrado. Todavía se deben ${formatearDinero(saldo)}.` };
}

export async function accionEliminarAbono(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let mantenimientoId: string;
  try {
    ({ mantenimientoId } = await (await casosDeUso()).eliminarAbono.ejecutar(texto(formData, "abonoId")));
  } catch (error) {
    return { error: mensajeDeError(error) };
  }
  actualizarVistas();
  redirect(`/mantenimiento/registro/${mantenimientoId}?aviso=anulado`);
}

export async function accionReportarFalla(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const equipoId = texto(formData, "equipoId");
  try {
    await (await casosDeUso()).reportarFalla.ejecutar({
      equipoId,
      descripcion: texto(formData, "descripcion"),
      fueraDeServicio: texto(formData, "fueraDeServicio") === "si",
    });
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  redirect(texto(formData, "volver") === "ficha" ? `/mantenimiento/equipos/${equipoId}?aviso=reportado` : "/mantenimiento?aviso=reportado");
}

export async function accionCerrarReporte(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    await (await casosDeUso()).cerrarReporte.ejecutar(texto(formData, "reporteId"), texto(formData, "cierre"));
    actualizarVistas();
    return { exito: "Reporte cerrado." };
  } catch (error) {
    return fallo(error, formData);
  }
}
