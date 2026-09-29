/**
 * Genera un CSV que Excel abre bien en español: con BOM (para que respete
 * acentos y la ñ) y separado por comas.
 */
export function generarCsv(encabezados: string[], filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    const texto = v === null ? "" : String(v);
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return "﻿" + [encabezados, ...filas].map((fila) => fila.map(celda).join(",")).join("\r\n");
}

export function respuestaCsv(nombreArchivo: string, contenido: string): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
