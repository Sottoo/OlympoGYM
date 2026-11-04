import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";

/** Lo que una Server Action devuelve al formulario cuando algo sale mal. */
export interface EstadoFormulario {
  error?: string;
  /** Campo al que se refiere el error, para marcarlo y llevar ahí el cursor. */
  campo?: string;
  /** Confirmación cuando la acción no redirige (ej. al cobrar una venta). */
  exito?: string;
  /** Valores enviados, para no borrar lo que la persona ya escribió. */
  valores?: Record<string, string>;
}

export const estadoInicial: EstadoFormulario = {};

const SECRETOS = new Set(["contrasena", "confirmacion", "actual", "nueva"]);

export function valoresDe(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  formData.forEach((v, k) => {
    // Las contraseñas nunca regresan a la pantalla.
    if (typeof v === "string" && !k.startsWith("$") && !SECRETOS.has(k)) valores[k] = v;
  });
  return valores;
}

/** Estado de error listo para devolver: mensaje, campo afectado y lo que se había escrito. */
export function fallo(error: unknown, formData: FormData): EstadoFormulario {
  return {
    error: mensajeDeError(error),
    campo: error instanceof ErrorDeDominio ? error.campo : undefined,
    valores: valoresDe(formData),
  };
}

/** Solo los errores de negocio se muestran tal cual; el resto se registra. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeDominio) return error.message;
  console.error(error);
  return "Algo falló al guardar. Intenta de nuevo; si sigue pasando, cierra y vuelve a abrir el programa.";
}

export function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}
