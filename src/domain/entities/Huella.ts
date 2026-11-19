/**
 * Huella digital de un socio, para registrar su entrada con solo poner el
 * dedo en el lector. Solo se guarda la plantilla (puntos característicos de
 * la huella), nunca la imagen: con la plantilla no se puede reconstruir el
 * dedo. Es un dato personal sensible: se registra solo con el consentimiento
 * firmado del socio.
 */
export const DEDOS = {
  indice_derecho: "Índice derecho",
  medio_derecho: "Medio derecho",
  pulgar_derecho: "Pulgar derecho",
  indice_izquierdo: "Índice izquierdo",
  medio_izquierdo: "Medio izquierdo",
  pulgar_izquierdo: "Pulgar izquierdo",
} as const;

export type Dedo = keyof typeof DEDOS;

export const esDedo = (valor: string): valor is Dedo => valor in DEDOS;

export interface Huella {
  id: string;
  socioId: string;
  dedo: Dedo;
  /** Cuándo se registró (y cuándo aceptó el socio el uso de su huella). */
  registradaEn: string;
}

/** Plantilla guardada, para comparar contra la huella que se acaba de leer. */
export interface PlantillaDeSocio {
  socioId: string;
  dedo: Dedo;
  plantilla: Uint8Array;
}

/** Toques del mismo dedo para registrar una huella: el motor combina los 4 en una plantilla más confiable. */
export const TOQUES_PARA_REGISTRAR = 4;
