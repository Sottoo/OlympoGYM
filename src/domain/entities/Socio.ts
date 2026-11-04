import { ErrorDeDominio } from "../shared/ErrorDeDominio";
import { esFechaValida, type FechaISO } from "../shared/fechas";
import { capitalizarNombre, LIMITES, normalizarCelular, revisarCelular, revisarNombre } from "../shared/reglas";

export interface Socio {
  id: string;
  /** Número de socio consecutivo (#0042). Va en la credencial y sirve para buscarlo. */
  numero: number;
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

/** Formatos de foto aceptados y tamaño máximo: los mismos para socios y productos. */
export { TAMANO_MAXIMO_FOTO, TIPOS_FOTO } from "../shared/imagen";

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

export const numeroDeSocio = (numero: number) => `#${String(numero).padStart(4, "0")}`;

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
  const errorNombre = revisarNombre(datos.nombre, "nombre");
  if (errorNombre) throw new ErrorDeDominio(errorNombre, "nombre");
  const errorApellidos = revisarNombre(datos.apellidos, "apellidos");
  if (errorApellidos) throw new ErrorDeDominio(errorApellidos, "apellidos");
  const errorCelular = revisarCelular(datos.telefono ?? "");
  if (errorCelular) throw new ErrorDeDominio(errorCelular, "telefono");

  const fechaNacimiento = datos.fechaNacimiento?.trim() || null;
  if (fechaNacimiento) {
    if (!esFechaValida(fechaNacimiento)) throw new ErrorDeDominio("La fecha de nacimiento no es válida.", "fechaNacimiento");
    if (fechaNacimiento > hoy) throw new ErrorDeDominio("La fecha de nacimiento no puede ser futura.", "fechaNacimiento");
    const edad = edadEn(fechaNacimiento, hoy);
    if (edad > 100) throw new ErrorDeDominio("Revisa el año de nacimiento: daría más de 100 años.", "fechaNacimiento");
    if (edad < 5) throw new ErrorDeDominio("Revisa el año de nacimiento: daría menos de 5 años.", "fechaNacimiento");
  }

  const notas = datos.notas?.trim() || null;
  if (notas && notas.length > LIMITES.notasSocio) throw new ErrorDeDominio(`Las notas pueden tener hasta ${LIMITES.notasSocio} caracteres.`, "notas");

  return {
    nombre: capitalizarNombre(datos.nombre),
    apellidos: capitalizarNombre(datos.apellidos),
    telefono: normalizarCelular(datos.telefono),
    fechaNacimiento,
    notas,
  };
}

/** El motivo es obligatorio; si es "Otro", también el detalle. */
export function validarMotivoBaja(motivo: string, detalle: string | null): string {
  const base = motivo.trim();
  const extra = detalle?.trim() ?? "";
  if (!(MOTIVOS_BAJA as readonly string[]).includes(base)) throw new ErrorDeDominio("Elige el motivo de la baja.", "motivo");
  if (base === "Otro" && extra.length < 3) throw new ErrorDeDominio("Describe brevemente el motivo de la baja.", "detalle");
  if (extra.length > LIMITES.nota) throw new ErrorDeDominio(`El detalle puede tener hasta ${LIMITES.nota} caracteres.`, "detalle");
  return extra ? `${base}: ${extra}` : base;
}
