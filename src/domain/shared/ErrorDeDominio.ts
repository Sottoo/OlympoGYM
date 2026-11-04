/**
 * Error que representa una regla de negocio incumplida
 * (ej. "El correo no es válido"). Su mensaje es seguro para
 * mostrarse directamente al usuario.
 */
export class ErrorDeDominio extends Error {
  /** Campo del formulario al que se refiere (para marcarlo en rojo), si aplica. */
  readonly campo?: string;

  constructor(mensaje: string, campo?: string) {
    super(mensaje);
    this.name = "ErrorDeDominio";
    this.campo = campo;
  }
}

export class NoEncontrado extends ErrorDeDominio {
  constructor(recurso: string) {
    super(`${recurso} no existe o fue eliminado.`);
    this.name = "NoEncontrado";
  }
}

/** El usuario no tiene permiso para esa acción (por ejemplo, recepción intentando dar de baja a un socio). */
export class SinPermiso extends ErrorDeDominio {
  constructor(accion: string) {
    super(`Tu perfil no permite ${accion}. Pídelo a la administración.`);
    this.name = "SinPermiso";
  }
}
