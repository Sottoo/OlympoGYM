import { nombreCompleto, numeroDeSocio, type Socio } from "@/domain/entities/Socio";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import { normalizarCelular } from "@/domain/shared/reglas";
import { claveDeNombre } from "@/domain/shared/texto";

/*
 * Socios registrados dos veces.
 *
 * Pasa cuando alguien que ya estaba inscrito llega otro día y en recepción
 * no lo encuentran (o creen que no se le puede cobrar) y lo inscriben de
 * nuevo. Para evitarlo:
 *   · al inscribir se avisa al momento si ya hay alguien con ese celular
 *     (no se permite) o con el mismo nombre (se pide confirmar que es otra
 *     persona), con un botón para abrir su ficha y cobrarle ahí;
 *   · los que ya están duplicados se unen en uno solo (UnirSocios).
 */

/** Dos nombres "iguales": sin importar mayúsculas, acentos ni espacios. */
export function mismaPersonaPorNombre(a: Pick<Socio, "nombre" | "apellidos">, b: Pick<Socio, "nombre" | "apellidos">): boolean {
  const clave = (s: Pick<Socio, "nombre" | "apellidos">) => claveDeNombre(`${s.nombre} ${s.apellidos}`);
  return clave(a) === clave(b);
}

export interface Parecido {
  id: string;
  nombre: string;
  numero: string;
  activo: boolean;
  /** Por qué se parece: mismo celular (no se permite) o mismo nombre (se puede confirmar). */
  motivo: "celular" | "nombre";
}

const aParecido = (s: Socio, motivo: Parecido["motivo"]): Parecido => ({ id: s.id, nombre: nombreCompleto(s), numero: numeroDeSocio(s.numero), activo: s.activo, motivo });

/** Socios que ya existen con el mismo celular o el mismo nombre (para avisar antes de inscribir). */
export async function buscarParecidos(
  socios: SocioRepository,
  datos: { nombre?: string; apellidos?: string; telefono?: string },
  excluirId?: string,
): Promise<Parecido[]> {
  const celular = normalizarCelular(datos.telefono ?? "");
  const conNombre = Boolean(datos.nombre?.trim() && datos.apellidos?.trim());
  if (celular.length !== 10 && !conNombre) return [];
  const todos = (await socios.listar()).filter((s) => s.id !== excluirId);
  const resultado: Parecido[] = [];
  for (const s of todos) {
    if (celular.length === 10 && normalizarCelular(s.telefono ?? "") === celular) resultado.push(aParecido(s, "celular"));
    else if (conNombre && mismaPersonaPorNombre(s, { nombre: datos.nombre!, apellidos: datos.apellidos! })) resultado.push(aParecido(s, "nombre"));
  }
  return resultado;
}

export class BuscarSociosParecidos {
  constructor(private readonly socios: SocioRepository) {}

  ejecutar(datos: { nombre?: string; apellidos?: string; telefono?: string }, excluirId?: string): Promise<Parecido[]> {
    return buscarParecidos(this.socios, datos, excluirId);
  }
}

/** Grupos de socios con exactamente el mismo nombre (posibles registros dobles). */
export class DetectarDuplicados {
  constructor(private readonly socios: SocioRepository) {}

  async ejecutar(): Promise<Parecido[][]> {
    const grupos = new Map<string, Socio[]>();
    for (const s of await this.socios.listar()) {
      const clave = claveDeNombre(`${s.nombre} ${s.apellidos}`);
      grupos.set(clave, [...(grupos.get(clave) ?? []), s]);
    }
    return [...grupos.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a.numero - b.numero).map((s) => aParecido(s, "nombre")));
  }
}

/**
 * Une un socio registrado dos veces en uno solo: todo lo del duplicado
 * (membresías, pagos, entradas y huellas) pasa al que se conserva, y el
 * duplicado se borra. Los cortes no cambian: cada pago conserva su día y su
 * monto. No se puede deshacer; queda en la bitácora.
 */
export class UnirSocios {
  constructor(
    private readonly socios: SocioRepository,
    private readonly fotos: AlmacenFotos,
  ) {}

  /** `duplicado` puede ser su id o su número de socio ("23" o "#0023"). */
  async ejecutar(conservarId: string, duplicado: string): Promise<{ conservado: string; unido: string }> {
    const conservar = await this.socios.obtenerPorId(conservarId);
    if (!conservar) throw new NoEncontrado("El socio");
    const texto = duplicado.trim();
    if (!texto) throw new ErrorDeDominio("Escribe el número del socio duplicado.", "duplicado");
    const otro = /^#?\d{1,6}$/.test(texto)
      ? (await this.socios.listar()).find((s) => s.numero === Number(texto.replace("#", "")))
      : await this.socios.obtenerPorId(texto);
    if (!otro) throw new ErrorDeDominio("No hay ningún socio con ese número. Revísalo en su ficha.", "duplicado");
    if (otro.id === conservar.id) throw new ErrorDeDominio("Ese es este mismo socio. Escribe el número del otro registro.", "duplicado");
    const { fotoSobrante } = await this.socios.unir(conservar.id, otro.id);
    if (fotoSobrante) await this.fotos.borrar(fotoSobrante).catch(() => undefined);
    return { conservado: nombreCompleto(conservar), unido: `${nombreCompleto(otro)} (${numeroDeSocio(otro.numero)})` };
  }
}
