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
  /** Descarga de la página oficial de HID el programa del lector de huellas y abre su instalador. */
  instalarLector(): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Abre el agente del lector de HID si no está corriendo; con `forzar`, lo
   * cierra y lo vuelve a abrir (suelta un lector que se quedó apartado para una
   * ventana que ya no existe). Ver electron/agenteHid.cjs.
   */
  reiniciarAgenteLector?(opciones?: { forzar?: boolean }): Promise<{ ok: true; accion: string } | { ok: false; error: string }>;
  /** Versión nueva ya descargada y lista para instalar, si la hay. */
  actualizacionLista?(): Promise<{ version: string } | null>;
  /** Avisa cuando termina de descargarse una versión nueva. Devuelve cómo dejar de escuchar. */
  alHaberActualizacion?(manejador: (info: { version: string }) => void): () => void;
  /**
   * Hace el respaldo y, solo si salió bien, cierra el programa, instala la
   * versión nueva y lo vuelve a abrir. Si falla, regresa el error y no cambia nada.
   */
  actualizarAhora?(): Promise<{ ok: true; archivo: string } | { ok: false; error: string }>;
  /**
   * «Buscar actualización»: revisa en ese momento. Si hay versión nueva, la
   * descarga (puede tardar un poco) y abre la ventana de actualizar.
   */
  buscarActualizacion?(): Promise<
    { estado: "al-dia"; publicada: string | null } | { estado: "lista"; version: string } | { estado: "error"; mensaje: string } | { estado: "desarrollo" }
  >;
  /** Clic en la notificación de Windows: pide abrir el aviso para actualizar. */
  alPedirActualizar?(manejador: () => void): () => void;
}

export function escritorio(): PuenteEscritorio | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { olimpo?: PuenteEscritorio }).olimpo ?? null;
}
