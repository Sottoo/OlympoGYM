"use server";

import { revalidatePath } from "next/cache";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { mensajeDeError } from "@/presentation/acciones/estadoFormulario";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

async function intentar<T>(accion: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await accion() };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

export async function accionRegistrarEntrada(socioId: string): Promise<Resultado<{ id: string; registradaEn: string }>> {
  const resultado = await intentar(async () => {
    const { id, registradaEn } = await (await casosDeUso()).registrarEntrada.ejecutar(socioId);
    return { id, registradaEn };
  });
  if (resultado.ok) revalidatePath("/", "layout");
  return resultado;
}

/** Cobra la visita del día a quien no tiene membresía y registra su entrada. */
export async function accionCobrarVisita(
  socioId: string,
  metodoPago: MetodoPago,
): Promise<Resultado<{ id: string; registradaEn: string; cobrado: number; visitaId: string }>> {
  const resultado = await intentar(async () => {
    const { asistencia, visita, suscripcionId } = await (await casosDeUso()).cobrarVisita.ejecutar(socioId, metodoPago);
    return { id: asistencia.id, registradaEn: asistencia.registradaEn, cobrado: visita.precio, visitaId: suscripcionId };
  });
  if (resultado.ok) revalidatePath("/", "layout");
  return resultado;
}

/** Si se cobró visita, `visitaId` la anula junto con su pago. */
export async function accionDeshacerEntrada(asistenciaId: string, visitaId?: string): Promise<Resultado<null>> {
  const resultado = await intentar(async () => {
    await (await casosDeUso()).deshacerEntrada.ejecutar(asistenciaId, visitaId);
    return null;
  });
  if (resultado.ok) revalidatePath("/", "layout");
  return resultado;
}

/** Anota (o corrige) con cuánto cambio empezó la caja hoy. */
export async function accionGuardarFondoDeCaja(monto: number): Promise<Resultado<{ monto: number }>> {
  const resultado = await intentar(async () => {
    const fondo = await (await casosDeUso()).guardarFondoDeCaja.ejecutar(monto);
    return { monto: fondo.monto };
  });
  if (resultado.ok) {
    revalidatePath("/panel");
    revalidatePath("/ventas");
  }
  return resultado;
}
