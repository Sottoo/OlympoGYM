/**
 * Plural en español para nombres de porciones y unidades:
 * scoop → scoops, servicio → servicios, porción → porciones, medida → medidas.
 */
export function pluralizar(palabra: string, cantidad = 2): string {
  if (cantidad === 1 || !palabra) return palabra;
  const p = palabra.trim();
  if (/[aeiouáéí]$/i.test(p)) return `${p}s`;
  if (/ón$/i.test(p)) return `${p.slice(0, -2)}ones`;
  if (/z$/i.test(p)) return `${p.slice(0, -1)}ces`;
  if (/[lrndj]$/i.test(p)) return `${p}es`;
  // Palabras prestadas (scoop, shot…): solo se les agrega "s".
  return `${p}s`;
}

/** Para comparar nombres sin que estorben mayúsculas, acentos ni espacios de más. */
export function claveDeNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
}
