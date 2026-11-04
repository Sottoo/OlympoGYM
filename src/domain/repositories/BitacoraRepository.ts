import type { RegistroBitacora, TablaBitacora } from "../entities/RegistroBitacora";

export interface FiltroBitacora {
  /** Solo estas tablas (una o un grupo). */
  tablas?: TablaBitacora[];
  /** Solo registros a partir de este instante (ISO 8601). */
  desde?: string;
  pagina: number;
  porPagina: number;
}

export interface BitacoraRepository {
  /** De lo más reciente a lo más antiguo. `hayMas` indica si existe otra página. */
  listar(filtro: FiltroBitacora): Promise<{ registros: RegistroBitacora[]; hayMas: boolean }>;
}
