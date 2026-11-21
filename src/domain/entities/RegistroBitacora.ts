/**
 * Un cambio en la información del gimnasio: quién, qué y cuándo. Lo escribe
 * la base de datos por sí sola (triggers) y nadie lo puede editar ni borrar.
 */
export interface RegistroBitacora {
  id: string;
  ocurridoEn: string;
  usuario: string | null;
  tabla: TablaBitacora;
  operacion: "alta" | "cambio" | "eliminacion";
  registroId: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export const TABLAS_BITACORA = {
  socios: "Socios",
  suscripciones: "Membresías",
  pagos: "Pagos",
  ventas: "Tienda",
  movimientos_inventario: "Inventario",
  productos: "Productos",
  planes: "Planes",
  asistencias: "Entradas",
  personal: "Personal",
  mantenimientos: "Mantenimiento",
  equipos: "Mantenimiento",
  abonos_mantenimiento: "Mantenimiento",
  reportes_falla: "Mantenimiento",
  huellas: "Socios",
  fondos_de_caja: "Tienda",
  /** Restauraciones de respaldo (las anota el programa, no un trigger). */
  respaldos: "Respaldos",
} as const;

/** Áreas del filtro que juntan varias tablas (una sola pestaña "Mantenimiento"). */
export const GRUPOS_BITACORA: Partial<Record<TablaBitacora, TablaBitacora[]>> = {
  socios: ["socios", "huellas"],
  ventas: ["ventas", "fondos_de_caja"],
  mantenimientos: ["mantenimientos", "equipos", "abonos_mantenimiento", "reportes_falla"],
};

export type TablaBitacora = keyof typeof TABLAS_BITACORA;
