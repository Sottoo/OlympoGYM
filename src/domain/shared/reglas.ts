/**
 * Reglas de captura compartidas: las usa el dominio para validar al guardar
 * y los formularios para avisar mientras se escribe. Así la pantalla y el
 * servidor nunca dicen cosas distintas.
 */

/** Letras (con acentos y ñ), espacios, apóstrofo, guion y punto: "María José O'Neil-Ruiz". */
export const PATRON_NOMBRE = /^[\p{L}][\p{L}\p{M} '.-]*$/u;
/** Lo que NO puede ir en un nombre (se quita al escribir). */
export const FUERA_DE_NOMBRE = /[^\p{L}\p{M} '.-]/gu;

/**
 * Usuario para entrar: empieza con letra y sigue con minúsculas, números,
 * punto, guion o guion bajo ("laura", "laura2", "recepcion.1"). Un usuario
 * que es solo un número ("123") se confunde con el número de socio.
 */
export const PATRON_USUARIO = /^[a-z][a-z0-9._-]{2,29}$/;
export const FUERA_DE_USUARIO = /[^a-z0-9._-]/g;

/** Código de producto o de barras: letras sin acento, números y guion. */
export const PATRON_CODIGO = /^[A-Za-z0-9-]{1,30}$/;
export const FUERA_DE_CODIGO = /[^A-Za-z0-9-]/g;

export const LIMITES = {
  nombrePersona: 40,
  apellidos: 60,
  nombrePlan: 40,
  descripcionPlan: 120,
  nombreProducto: 60,
  codigo: 30,
  notasSocio: 500,
  nota: 120,
  usuario: 30,
  contrasena: 72,
  precioMaximo: 100_000,
  piezasMaximas: 99_999,
} as const;

/** Quita espacios de más: "  maría   josé " → "maría josé". */
export function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** "maría JOSÉ de la o" → "María José de la O" (las partículas cortas quedan en minúscula). */
export function capitalizarNombre(texto: string): string {
  const particulas = new Set(["de", "del", "la", "las", "los", "y", "e", "van", "von", "da", "di"]);
  return limpiarEspacios(texto)
    .toLocaleLowerCase("es-MX")
    .split(" ")
    .map((palabra, i) =>
      i > 0 && particulas.has(palabra)
        ? palabra
        : palabra.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase("es-MX")),
    )
    .join(" ");
}

/** Mensaje si el nombre (o apellidos) no es válido; null si está bien. */
export function revisarNombre(texto: string, que: "nombre" | "apellidos" = "nombre"): string | null {
  const limpio = limpiarEspacios(texto);
  const max = que === "nombre" ? LIMITES.nombrePersona : LIMITES.apellidos;
  if (!limpio) return que === "nombre" ? "Escribe el nombre." : "Escribe los apellidos.";
  if (!PATRON_NOMBRE.test(limpio)) return "Usa solo letras, sin números ni símbolos.";
  if (limpio.replace(/[^\p{L}]/gu, "").length < 2) return "Debe tener al menos 2 letras.";
  if (limpio.length > max) return `Máximo ${max} caracteres.`;
  return null;
}

/**
 * Celular a 10 dígitos. Acepta lo que la gente escribe de verdad:
 * "55 1234 5678", "(55) 1234-5678", "+52 55 1234 5678", "+521…".
 */
export function normalizarCelular(texto: string | null | undefined): string {
  let digitos = (texto ?? "").replace(/\D/g, "");
  if (/^\s*\+/.test(texto ?? "") && digitos.startsWith("52")) {
    digitos = digitos.slice(2);
    if (digitos.length === 11 && digitos.startsWith("1")) digitos = digitos.slice(1);
    return digitos;
  }
  if (digitos.length === 13 && digitos.startsWith("521")) digitos = digitos.slice(3);
  else if (digitos.length === 12 && digitos.startsWith("52")) digitos = digitos.slice(2);
  return digitos;
}

export function revisarCelular(texto: string): string | null {
  const digitos = normalizarCelular(texto);
  if (!digitos) return "Escribe el celular.";
  if (digitos.length !== 10) return `El celular lleva 10 dígitos; llevas ${digitos.length}.`;
  if (/^(\d)\1{9}$/.test(digitos)) return "Ese número no parece real. Revísalo.";
  return null;
}

/** "5512345678" → "55 1234 5678" mientras se escribe. */
export function formatearCelularParcial(digitos: string): string {
  const d = digitos.slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

export function revisarUsuario(texto: string): string | null {
  const u = texto.trim().toLowerCase();
  if (!u) return "Escribe el usuario con el que va a entrar.";
  if (u.length < 3) return "El usuario debe tener al menos 3 caracteres.";
  if (!/^[a-z]/.test(u)) return "Debe empezar con una letra, por ejemplo «laura» o «laura2».";
  if (!PATRON_USUARIO.test(u)) return "Solo minúsculas sin acentos, números, punto o guion.";
  return null;
}

/** Contraseña nueva: mínimo 8, con al menos una letra y un número. */
export function revisarContrasenaNueva(texto: string): string | null {
  if (!texto) return "Escribe la contraseña.";
  if (texto.length < 8) return `Mínimo 8 caracteres; llevas ${texto.length}.`;
  if (texto.length > LIMITES.contrasena) return `Máximo ${LIMITES.contrasena} caracteres.`;
  if (!/\p{L}/u.test(texto) || !/\d/.test(texto)) return "Combina letras y números para que sea más segura.";
  return null;
}

/** Dinero con máximo 2 decimales, entre `min` y el máximo permitido. */
export function revisarDinero(valor: number, { min = 0, minExclusivo = false, que = "El monto" }: { min?: number; minExclusivo?: boolean; que?: string } = {}): string | null {
  if (!Number.isFinite(valor)) return `${que} debe ser un número.`;
  if (minExclusivo ? valor <= min : valor < min) return minExclusivo ? `${que} debe ser mayor a $${min}.` : `${que} no puede ser negativo.`;
  if (valor > LIMITES.precioMaximo) return `${que} no puede pasar de $${LIMITES.precioMaximo.toLocaleString("es-MX")}.`;
  if (Math.round(valor * 100) !== Number((valor * 100).toFixed(6))) return "Usa máximo 2 decimales.";
  return null;
}

export function revisarEntero(valor: number, { min = 0, max = LIMITES.piezasMaximas, que = "La cantidad" }: { min?: number; max?: number; que?: string } = {}): string | null {
  if (!Number.isFinite(valor)) return `${que} debe ser un número.`;
  if (!Number.isInteger(valor)) return `${que} debe ser un número entero, sin decimales.`;
  if (valor < min) return min === 1 ? `${que} debe ser al menos 1.` : `${que} no puede ser menor a ${min}.`;
  if (valor > max) return `${que} no puede pasar de ${max.toLocaleString("es-MX")}.`;
  return null;
}
