import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import type { FechaISO } from "../shared/fechas";

export interface Socio {
  id: string;
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  /** Día en que se dio de baja (null si está activo). */
  fechaBaja: FechaISO | null;
  motivoBaja: string | null;
  creadoEn: string;
}

export type DatosNuevoSocio = Pick<Socio, "nombre" | "apellidos" | "email" | "telefono" | "notas">;

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

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function nombreCompleto(socio: Pick<Socio, "nombre" | "apellidos">): string {
  return `${socio.nombre} ${socio.apellidos}`.trim();
}

/** Valida y normaliza los datos de un socio antes de guardarlo. */
export function validarNuevoSocio(datos: DatosNuevoSocio): DatosNuevoSocio {
  const nombre = datos.nombre.trim();
  const apellidos = datos.apellidos.trim();
  const email = datos.email?.trim().toLowerCase() || null;
  const telefono = normalizarTelefono(datos.telefono);
  const notas = datos.notas?.trim() || null;

  if (nombre.length < 2) throw new ErrorDeDominio("Escribe el nombre del socio.");
  if (apellidos.length < 2) throw new ErrorDeDominio("Escribe los apellidos del socio.");
  if (email && !PATRON_EMAIL.test(email)) throw new ErrorDeDominio("El correo no tiene un formato válido.");
  if (!telefono) throw new ErrorDeDominio("Agrega el celular del socio: los avisos de vencimiento se mandan por WhatsApp.");
  if (telefono.replace(/\D/g, "").length < 10) {
    throw new ErrorDeDominio("El teléfono debe tener al menos 10 dígitos.");
  }

  return { nombre, apellidos, email, telefono, notas };
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
