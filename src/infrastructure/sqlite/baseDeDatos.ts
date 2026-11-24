import "server-only";
import { mkdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { entorno } from "../config/entorno";
import { respaldoAntesDeActualizar } from "../respaldo/paquete";
import { exigirRelojCorrecto } from "../reloj/horaReal";
import { MIGRACIONES } from "./esquema";
import { ajustarDatos } from "./ajustesDeDatos";
import { rutaBase, rutaFotos } from "./rutas";

/**
 * La base de datos local: un solo archivo SQLite dentro de la carpeta de
 * datos del programa. No hay que instalar nada; SQLite viene con el propio
 * programa. Todas las operaciones son síncronas y rápidas.
 */

export { ARCHIVO_BASE, rutaBase, rutaFotos } from "./rutas";

type Fila = Record<string, unknown>;

const global = globalThis as unknown as { __baseOlimpo?: DatabaseSync | null; __transaccionesAbiertas?: number };

function abrir(): DatabaseSync {
  mkdirSync(entorno.rutaDatos, { recursive: true });
  mkdirSync(rutaFotos(), { recursive: true });
  const db = new DatabaseSync(rutaBase());
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000; pragma synchronous = full;");
  migrar(db);
  ajustarDatos(db);
  return db;
}

function migrar(db: DatabaseSync) {
  const version = Number((db.prepare("pragma user_version").get() as { user_version: number }).user_version);
  // Una base con datos que una versión nueva va a cambiar: primero se respalda.
  // (version 0 es una base recién creada: no hay nada que respaldar.)
  if (version > 0 && version < MIGRACIONES.length) respaldoAntesDeActualizar(db);
  for (let i = version; i < MIGRACIONES.length; i++) {
    db.exec("begin");
    try {
      db.exec(MIGRACIONES[i]);
      db.exec(`pragma user_version = ${i + 1}`);
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }
}

export function baseDeDatos(): DatabaseSync {
  global.__baseOlimpo ??= abrir();
  return global.__baseOlimpo;
}

/** Cierra la base (para restaurar un respaldo). La siguiente consulta la vuelve a abrir. */
export function cerrarBase() {
  global.__baseOlimpo?.close();
  global.__baseOlimpo = null;
}

export const nuevoId = () => crypto.randomUUID();

/** Convierte 0/1 de SQLite en booleanos para las columnas indicadas. */
export function conBooleanos<T extends Fila>(fila: T, columnas: string[]): T {
  const copia: Fila = { ...fila };
  for (const c of columnas) if (c in copia && copia[c] !== null) copia[c] = Boolean(copia[c]);
  return copia as T;
}

/**
 * Acceso a la base con el nombre de quien usa el programa: toda escritura
 * pasa por `escribir`, que la hace en una transacción y deja anotado el
 * usuario para la bitácora. Como SQLite trabaja de forma síncrona, nada se
 * mezcla entre dos pantallas abiertas a la vez.
 */
export class Sesion {
  /**
   * `cuidarReloj`: para lo del gimnasio (cobros, entradas, ventas, cambios), no
   * se guarda nada si la fecha de la computadora está mal (ver horaReal.ts).
   * Iniciar sesión y lo del sistema no lo revisan, para poder entrar y ver el aviso.
   */
  constructor(
    readonly usuario: string | null,
    private readonly cuidarReloj = false,
  ) {}

  todas<T = Fila>(sql: string, ...parametros: SQLInputValue[]): T[] {
    return baseDeDatos().prepare(sql).all(...parametros) as T[];
  }

  una<T = Fila>(sql: string, ...parametros: SQLInputValue[]): T | null {
    return (baseDeDatos().prepare(sql).get(...parametros) as T | undefined) ?? null;
  }

  /**
   * Hace la operación (síncrona) en una transacción. Si ya hay una abierta,
   * la operación se suma a ella: así varios pasos (membresía + pago, producto
   * + stock inicial) se guardan juntos o no se guarda ninguno.
   */
  escribir<R>(operacion: () => R): R {
    const db = baseDeDatos();
    if ((global.__transaccionesAbiertas ?? 0) > 0) return operacion();
    if (this.cuidarReloj) exigirRelojCorrecto(db);
    db.exec("begin immediate");
    global.__transaccionesAbiertas = 1;
    try {
      db.prepare("update contexto set usuario = ? where id = 1").run(this.usuario);
      const resultado = operacion();
      db.prepare("update contexto set usuario = null where id = 1").run();
      db.exec("commit");
      return resultado;
    } catch (error) {
      db.exec("rollback");
      throw traducir(error);
    } finally {
      global.__transaccionesAbiertas = 0;
    }
  }

  ejecutar(sql: string, ...parametros: SQLInputValue[]) {
    return baseDeDatos().prepare(sql).run(...parametros);
  }
}

/** Los errores de restricciones de SQLite se convierten en mensajes que se pueden mostrar. */
function traducir(error: unknown): unknown {
  if (error instanceof ErrorDeDominio || !(error instanceof Error)) return error;
  const mensaje = error.message;
  if (/UNIQUE constraint failed: productos|productos_codigo/.test(mensaje)) return new ErrorDeDominio("Ya hay otro producto con ese código.", "codigo");
  if (/UNIQUE constraint failed: personal/.test(mensaje)) return new ErrorDeDominio("Ya existe una cuenta con ese usuario.", "usuario");
  if (/UNIQUE constraint failed/.test(mensaje)) return new ErrorDeDominio("Ya existe un registro con esos datos.");
  if (/CHECK constraint failed/.test(mensaje)) return new ErrorDeDominio("Alguno de los datos no es válido. Revísalos e intenta de nuevo.");
  if (/FOREIGN KEY constraint failed/.test(mensaje)) return new ErrorDeDominio("El registro relacionado ya no existe.");
  return error;
}
