/**
 * Configuración leída de las variables de entorno (.env.local o la app de escritorio).
 * Es el único lugar de la app que toca process.env.
 */
export const entorno = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  nombreGimnasio: process.env.NEXT_PUBLIC_NOMBRE_GIMNASIO ?? "Olimpo GYM",
  zonaHoraria: process.env.ZONA_HORARIA ?? "America/Mexico_City",
  /** Carpeta de respaldos diarios. La define la app de escritorio; vacía = sin respaldo automático. */
  rutaRespaldos: process.env.RUTA_RESPALDOS ?? "",
};

/** Sin Supabase configurado, la app usa datos de ejemplo en memoria. */
export const modoDemo = !entorno.supabaseUrl || !entorno.supabaseAnonKey;
