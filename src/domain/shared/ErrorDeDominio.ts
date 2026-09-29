/**
 * Error que representa una regla de negocio incumplida
 * (ej. "El correo no es válido"). Su mensaje es seguro para
 * mostrarse directamente al usuario.
 */
export class ErrorDeDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeDominio";
  }
}

export class NoEncontrado extends ErrorDeDominio {
  constructor(recurso: string) {
    super(`${recurso} no existe o fue eliminado.`);
    this.name = "NoEncontrado";
  }
}
