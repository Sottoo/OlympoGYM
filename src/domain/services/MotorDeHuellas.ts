/**
 * Lee y compara huellas. La infraestructura decide con qué motor; las
 * plantillas son bytes opacos para el resto del programa.
 */
export interface MotorDeHuellas {
  /** Plantilla de la imagen (PNG) que mandó el lector. Si la imagen no sirve, lanza un ErrorDeDominio. */
  plantillaDeImagen(png: Uint8Array): Uint8Array;
  /** Las dos plantillas son del mismo dedo. */
  coinciden(a: Uint8Array, b: Uint8Array): boolean;
  /** Combina varios toques del mismo dedo en una sola plantilla, más confiable. */
  combinar(muestras: Uint8Array[]): Uint8Array;
  /**
   * La plantilla que corresponde a la muestra (la más parecida), o null si ninguna.
   * `seguro`: el parecido es tan alto que se puede registrar la entrada sin que
   * recepción confirme; si no, solo es probable y recepción confirma con la foto.
   */
  identificar(muestra: Uint8Array, plantillas: Uint8Array[]): { indice: number; seguro: boolean } | null;
}
