import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";

/** Lo que una Server Action devuelve al formulario cuando algo sale mal. */
export interface EstadoFormulario {
  error?: string;
  /** Confirmación cuando la acción no redirige (ej. al cobrar una venta). */
  exito?: string;
  /** Valores enviados, para no borrar lo que la persona ya escribió. */
  valores?: Record<string, string>;
}

export const estadoInicial: EstadoFormulario = {};

export function valoresDe(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  });
  return valores;
}

/** Solo los errores de negocio se muestran tal cual; el resto se registra. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeDominio) return error.message;
  console.error(error);
  return "Algo falló al guardar. Revisa tu conexión e intenta de nuevo.";
}

export function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}
