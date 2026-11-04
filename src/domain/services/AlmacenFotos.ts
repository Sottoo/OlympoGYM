/** Dónde se guardan las fotos de los socios y de los productos. La infraestructura decide cómo. */
export interface AlmacenFotos {
  /** Guarda la imagen en la carpeta de su dueño (socio o producto) y devuelve su ruta, que se anota en él. */
  guardar(duenoId: string, imagen: Uint8Array, tipo: string): Promise<string>;
  /** Enlace temporal para mostrar la foto en pantalla. */
  urlTemporal(ruta: string): Promise<string | null>;
  borrar(ruta: string): Promise<void>;
}
