import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { esFechaValida, type FechaISO } from "../shared/fechas";

export interface Socio {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  /** Opcional. Se guarda la fecha (no la edad) para que la edad se calcule sola. */
  fechaNacimiento: FechaISO | null;
  /** Ruta de la foto en el almacén de archivos (null = sin foto). */
  foto: string | null;
  notas: string | null;
  activo: boolean;
  /** Día en que se dio de baja (null si está activo). */
  fechaBaja: FechaISO | null;
  motivoBaja: string | null;
  creadoEn: string;
}

export type DatosNuevoSocio = Pick<Socio, "nombre" | "apellidos" | "telefono" | "fechaNacimiento" | "notas">;

/** Formatos de foto aceptados y tamaño máximo (la app las reduce antes de subirlas). */
export const TIPOS_FOTO = ["image/webp", "image/jpeg", "image/png"] as const;
export const TAMANO_MAXIMO_FOTO = 1024 * 1024;

/** Motivos de baja predefinidos: permiten saber después por qué se van los socios. */
export const MOTIVOS_BAJA = [
  "Cambio de domicilio o de trabajo",
  "Motivos económicos",
  "Salud o lesión",
  "Falta de tiempo",
  "Se cambió a otro gimnasio",
  "Inconforme con el servicio",
  "Otro",
] as const;

export function nombreCompleto(socio: Pick<Socio, "nombre" | "apellidos">): string {
  return `${socio.nombre} ${socio.apellidos}`.trim();
}

/** Años cumplidos a la fecha `hoy`. */
export function edadEn(fechaNacimiento: FechaISO, hoy: FechaISO): number {
  const edad = Number(hoy.slice(0, 4)) - Number(fechaNacimiento.slice(0, 4));
  return hoy.slice(5) < fechaNacimiento.slice(5) ? edad - 1 : edad;
}

export function cumpleAniosEn(fechaNacimiento: FechaISO, hoy: FechaISO): boolean {
  return fechaNacimiento.slice(5) === hoy.slice(5);
}

/** Valida y normaliza los datos de un socio antes de guardarlo. */
export function validarNuevoSocio(datos: DatosNuevoSocio, hoy: FechaISO): DatosNuevoSocio {
  const nombre = datos.nombre.trim();
  const apellidos = datos.apellidos.trim();
  const telefono = normalizarTelefono(datos.telefono);
  const fechaNacimiento = datos.fechaNacimiento?.trim() || null;
  const notas = datos.notas?.trim() || null;

  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del socio.");
  if (apellidos.length < 2) throw new ErrorDeDominio("Escribe los apellidos del socio.");
  if (!telefono) throw new ErrorDeDominio("Agrega el celular del socio: los avisos de vencimiento se mandan por WhatsApp.");
  if (telefono.replace(/\D/g, "").length < 10) {
    throw new ErrorDeDominio("El teléfono debe tener al menos 10 dígitos.");
  }

  if (fechaNacimiento) {
    if (!esFechaValida(fechaNacimiento)) throw new ErrorDeDominio("La fecha de nacimiento no es válida.");
    if (fechaNacimiento > hoy) throw new ErrorDeDominio("La fecha de nacimiento no puede ser futura.");
    if (edadEn(fechaNacimiento, hoy) > 110) throw new ErrorDeDominio("Revisa el año de nacimiento.");
  }

  return { nombre, apellidos, telefono, fechaNacimiento, notas };
}

/** El motivo es obligatorio; si es "Otro", también el detalle. */
export function validarMotivoBaja(motivo: string, detalle: string | null): string {
  const base = motivo.trim();
  const extra = detalle?.trim() ?? "";
  if (!(MOTIVOS_BAJA as readonly string[]).includes(base)) throw new ErrorDeDominio("Elige el motivo de la baja.");
  if (base === "Otro" && extra.length < 3) throw new ErrorDeDominio("Describe brevemente el motivo de la baja.");
  return extra ? `${base}: ${extra}` : base;
}

function normalizarTelefono(valor: string | null): string | null {
  if (!valor) return null;
  const limpio = valor.replace(/[^\d+]/g, "");
  return limpio || null;
}
