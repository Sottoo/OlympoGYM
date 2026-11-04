import path from "node:path";

/**
 * Configuración del programa. Es el único lugar de la app que toca process.env.
 * La app de escritorio define las carpetas; al desarrollar se usa `.datos/`
 * dentro del proyecto (está en .gitignore).
 */
const rutaDatos = process.env.RUTA_DATOS || path.join(process.cwd(), ".datos");

export const entorno = {
  nombreGimnasio: process.env.NEXT_PUBLIC_NOMBRE_GIMNASIO ?? "Olimpo GYM",
  zonaHoraria: process.env.ZONA_HORARIA ?? "America/Mexico_City",
  /** Versión del programa (la de package.json, fijada al compilar en next.config.ts). */
  versionPrograma: process.env.VERSION_PROGRAMA ?? "desarrollo",
  /** Carpeta con la base de datos y las fotos. */
  rutaDatos,
  /** Carpeta de los respaldos automáticos diarios. */
  rutaRespaldos: process.env.RUTA_RESPALDOS || path.join(rutaDatos, "respaldos"),
};
