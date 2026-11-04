import path from "node:path";
import { entorno } from "../config/entorno";

/** Dónde vive la información del programa: la base de datos y las fotos de socios y productos. */
export const ARCHIVO_BASE = "olimpo.db";
export const rutaBase = () => path.join(entorno.rutaDatos, ARCHIVO_BASE);
export const rutaFotos = () => path.join(entorno.rutaDatos, "fotos");
