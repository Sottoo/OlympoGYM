import { ErrorDeDominio } from "./ErrorDeDominio";

/** Formatos de foto aceptados y tamaño máximo (la app las reduce antes de subirlas). */
export const TIPOS_FOTO = ["image/webp", "image/jpeg", "image/png"] as const;
export const TAMANO_MAXIMO_FOTO = 1024 * 1024;

/** Revisa la "firma" del archivo, no solo lo que dice el navegador que es. */
function esImagenDeVerdad(b: Uint8Array, tipo: string): boolean {
  const ascii = (desde: number, hasta: number) => String.fromCharCode(...b.slice(desde, hasta));
  if (tipo === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (tipo === "image/png") return b[0] === 0x89 && ascii(1, 4) === "PNG";
  if (tipo === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return false;
}

/** Una foto (de socio o de producto) antes de guardarla: formato, peso y que de verdad sea una imagen. */
export function revisarFoto(imagen: Uint8Array, tipo: string): void {
  if (!(TIPOS_FOTO as readonly string[]).includes(tipo)) throw new ErrorDeDominio("La foto debe ser una imagen JPG, PNG o WebP.");
  if (imagen.byteLength > TAMANO_MAXIMO_FOTO) throw new ErrorDeDominio("La foto pesa demasiado; prueba con otra.");
  if (!esImagenDeVerdad(imagen, tipo)) throw new ErrorDeDominio("Ese archivo no es una imagen válida. Prueba con otra foto.");
}
