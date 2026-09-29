import type { SituacionMembresia } from "@/domain/entities/Suscripcion";
import { formatearFechaLarga } from "@/shared/formato";

/** Enlace wa.me con el mensaje ya escrito. Asume números de México (+52). */
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/\D/g, "");
  const internacional = digitos.length === 10 ? `52${digitos}` : digitos;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajeRecordatorio(
  nombre: string,
  membresia: Pick<SituacionMembresia, "diasRestantes" | "fechaFin">,
  nombreGimnasio: string,
): string {
  const { diasRestantes, fechaFin } = membresia;
  if (diasRestantes === null || !fechaFin) {
    return `Hola ${nombre}, te escribimos de ${nombreGimnasio}. ¿Te gustaría activar tu membresía? Pasa a recepción y te ayudamos.`;
  }
  const fecha = formatearFechaLarga(fechaFin);
  if (diasRestantes < 0) {
    return `Hola ${nombre}, te escribimos de ${nombreGimnasio}. Tu membresía venció el ${fecha}. Te esperamos en recepción para renovarla y seguir entrenando.`;
  }
  const cuando = diasRestantes === 0 ? "hoy" : diasRestantes === 1 ? "mañana" : `en ${diasRestantes} días`;
  return `Hola ${nombre}, te escribimos de ${nombreGimnasio}. Tu membresía vence ${cuando} (${fecha}). Puedes renovarla en recepción y no pierdes los días que te quedan.`;
}
