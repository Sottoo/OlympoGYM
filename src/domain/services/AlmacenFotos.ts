/** Dónde se guardan las fotos de los socios. La infraestructura decide cómo. */
export interface AlmacenFotos {
  /** Guarda la imagen y devuelve su ruta, que se anota en el socio. */
  guardar(socioId: string, imagen: Uint8Array, tipo: string): Promise<string>;
  /** Enlace temporal para mostrar la foto en pantalla. */
  urlTemporal(ruta: string): Promise<string | null>;
  borrar(ruta: string): Promise<void>;
}
