"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describirSemana } from "@/domain/entities/Nomina";
import type { MetodoPago } from "@/domain/entities/Pago";
import { casosDeUso } from "@/infrastructure/contenedor";
import { type EstadoFormulario, fallo, texto } from "@/presentation/acciones/estadoFormulario";
import { formatearDinero } from "@/shared/formato";

function actualizarVistas() {
  revalidatePath("/nomina");
  // El aviso del viernes y la caja del día.
  revalidatePath("/panel");
  revalidatePath("/ventas");
}

const numeroOpcional = (formData: FormData, campo: string) => {
  const valor = texto(formData, campo).trim();
  return valor ? Number(valor) : null;
};

export async function accionPagarNomina(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  let resumen: string;
  try {
    const pago = await (await casosDeUso()).registrarPagoNomina.ejecutar({
      empleadoId: texto(formData, "empleadoId"),
      semana: texto(formData, "semana"),
      monto: numeroOpcional(formData, "monto") ?? 0,
      metodo: texto(formData, "metodoPago") as MetodoPago,
      nota: texto(formData, "nota") || null,
    });
    resumen = `Pago registrado: ${pago.empleadoNombre} · semana ${describirSemana(pago.semana)} · ${formatearDinero(pago.monto)}${pago.metodo === "efectivo" ? " (salió de la caja de hoy)" : ""}.`;
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  return { exito: resumen, valores: {} };
}

export async function accionAnularPagoNomina(formData: FormData) {
  const pago = await (await casosDeUso()).anularPagoNomina.ejecutar(texto(formData, "pagoId"));
  actualizarVistas();
  redirect(`/nomina?anulado=${encodeURIComponent(`${pago.empleadoNombre} · ${formatearDinero(pago.monto)}`)}`);
}

export async function accionGuardarEmpleado(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = texto(formData, "empleadoId") || undefined;
  let nombre: string;
  try {
    const empleado = await (await casosDeUso()).guardarEmpleado.ejecutar(
      { nombre: texto(formData, "nombre"), puesto: texto(formData, "puesto") || null, sueldoSemanal: numeroOpcional(formData, "sueldoSemanal") },
      id,
    );
    nombre = empleado.nombre;
  } catch (error) {
    return fallo(error, formData);
  }
  actualizarVistas();
  if (id) redirect(`/nomina?guardado=${encodeURIComponent(nombre)}`);
  return { exito: `${nombre} quedó dado de alta. Ya se le puede pagar.`, valores: {} };
}

export async function accionCambiarEstadoEmpleado(formData: FormData) {
  const activo = texto(formData, "activo") === "true";
  await (await casosDeUso()).cambiarEstadoEmpleado.ejecutar(texto(formData, "empleadoId"), activo);
  actualizarVistas();
  redirect(`/nomina?${activo ? "activado" : "desactivado"}=${encodeURIComponent(texto(formData, "nombre"))}`);
}
