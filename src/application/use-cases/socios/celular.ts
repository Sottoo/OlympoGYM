import { numeroDeSocio, nombreCompleto } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { normalizarCelular } from "@/domain/shared/reglas";

/**
 * Cada socio tiene su propio celular: es como se le contacta y con lo que se
 * le busca en el mostrador. Devuelve el aviso si el número ya es de otro.
 */
export async function celularOcupado(socios: SocioRepository, telefono: string, excluirId?: string): Promise<string | null> {
  const celular = normalizarCelular(telefono);
  if (celular.length !== 10) return null;
  const otro = (await socios.buscarPorCelular(celular)).find((s) => s.id !== excluirId);
  if (!otro) return null;
  const quien = `${nombreCompleto(otro)} (${numeroDeSocio(otro.numero)}${otro.activo ? "" : ", dado de baja"})`;
  return otro.activo
    ? `Este celular ya es de ${quien}. Cada socio necesita su propio número.`
    : `Este celular es de ${quien}. Si regresó, reactívalo desde su ficha en lugar de registrarlo de nuevo.`;
}

export async function asegurarCelularLibre(socios: SocioRepository, telefono: string | null, excluirId?: string): Promise<void> {
  const aviso = await celularOcupado(socios, telefono ?? "", excluirId);
  if (aviso) throw new ErrorDeDominio(aviso, "telefono");
}

/** Para avisar mientras se llena el formulario, antes de guardar. */
export class RevisarCelular {
  constructor(private readonly socios: SocioRepository) {}

  ejecutar(telefono: string, excluirId?: string): Promise<string | null> {
    return celularOcupado(this.socios, telefono, excluirId);
  }
}
