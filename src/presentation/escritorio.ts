/**
 * Funciones que solo existen en el programa de escritorio (las expone
 * electron/preload.cjs). En un navegador normal no están, y la interfaz
 * ofrece una alternativa (por ejemplo, descargar en lugar de abrir carpeta).
 */
export interface PuenteEscritorio {
  /** Abre el selector de carpetas de Windows. Null si se canceló. */
  elegirCarpeta(): Promise<string | null>;
  /** Abre el Explorador de Windows con el archivo seleccionado. */
  mostrarArchivo(ruta: string): Promise<void>;
  abrirCarpeta(ruta: string): Promise<void>;
  /** Abre WhatsApp de escritorio (o WhatsApp Web si no está instalado). */
  abrirWhatsApp(): Promise<void>;
}

export function escritorio(): PuenteEscritorio | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { olimpo?: PuenteEscritorio }).olimpo ?? null;
}
