import "server-only";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writeFile, rename, mkdir } from "node:fs/promises";
import { strFromU8, unzipSync, zip, zipSync } from "fflate";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { entorno } from "../config/entorno";
import { ARCHIVO_BASE, baseDeDatos, cerrarBase, rutaBase, rutaFotos, Sesion } from "../sqlite/baseDeDatos";
import { MIGRACIONES } from "../sqlite/esquema";
import { contenidoDelRespaldo, depurar, escribirSeguro, nombreDeRespaldo, PATRON, type TipoRespaldo } from "./paquete";

/*
 * Respaldos del gimnasio. Un respaldo es un solo archivo .zip con una copia
 * exacta de la base de datos y todas las fotos (de socios y productos).
 *
 * · Cada día, al abrir el programa, se guarda uno automáticamente, y se
 *   vuelve a guardar (encima del del día) cada 3 horas mientras se usa, para
 *   que un problema en la tarde no se lleve todo lo de ese día.
 * · Se guarda en la carpeta de respaldos y, si se configuró, también en una
 *   carpeta extra (Google Drive, OneDrive o una USB), para tener una copia
 *   fuera de la computadora.
 * · Se conservan los últimos 30 diarios de cada carpeta y, aparte, los
 *   últimos 20 manuales o previos a restaurar o actualizar (unos no
 *   desplazan a otros).
 * · Cuando una versión nueva del programa cambia la estructura de la base,
 *   antes se guarda un respaldo completo (ver paquete.ts).
 * · El respaldo no lleva la llave de las sesiones: con un respaldo no se
 *   puede abrir el programa sin contraseña.
 */

export type { TipoRespaldo } from "./paquete";

/** Cada cuánto se refresca el respaldo del día mientras el programa está en uso. */
const REFRESCAR_CADA_MS = 3 * 3_600_000;
const FOTO_EN_RESPALDO = /^fotos\/[0-9a-f-]{36}\/\d+\.(webp|jpg|png)$/;
/** Un respaldo real pesa unos cuantos MB; esto evita que un archivo malicioso llene la memoria. */
const MAXIMO_DESCOMPRIMIDO = 2 * 1024 ** 3;
const sistema = new Sesion("Sistema");

export interface ArchivoRespaldo {
  nombre: string;
  tamano: number;
  creadoEn: string;
  tipo: TipoRespaldo;
}

export interface ResultadoRespaldo {
  archivo: ArchivoRespaldo;
  ruta: string;
  /** Resultado de la copia en la carpeta extra (null si no hay carpeta extra). */
  copiaExtra: { ok: true; ruta: string } | { ok: false; error: string } | null;
}

/* ── Ajustes de respaldo ─────────────────────────────────────────────── */
const ajuste = (clave: string) => sistema.una<{ valor: string }>("select valor from ajustes where clave = ?", clave)?.valor ?? null;
function guardarAjuste(clave: string, valor: string | null) {
  sistema.escribir(() =>
    valor === null
      ? sistema.ejecutar("delete from ajustes where clave = ?", clave)
      : sistema.ejecutar("insert into ajustes (clave, valor) values (?, ?) on conflict (clave) do update set valor = excluded.valor", clave, valor),
  );
}

export const carpetaDeRespaldos = () => entorno.rutaRespaldos;
export const carpetaExtra = () => ajuste("carpeta_respaldo_extra");

/** Define (o quita, con null) la carpeta extra. Comprueba que exista y se pueda escribir en ella. */
export function cambiarCarpetaExtra(ruta: string | null) {
  if (ruta === null) return guardarAjuste("carpeta_respaldo_extra", null);
  const carpeta = path.resolve(ruta.trim());
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) throw new ErrorDeDominio("Esa carpeta no existe. Elígela de nuevo.");
  const prueba = path.join(carpeta, ".prueba-olimpo");
  try {
    writeFileSync(prueba, "ok");
    rmSync(prueba);
  } catch {
    throw new ErrorDeDominio("El programa no puede escribir en esa carpeta. Elige otra.");
  }
  guardarAjuste("carpeta_respaldo_extra", carpeta);
}

/* ── Crear ───────────────────────────────────────────────────────────── */
/** El respaldo completo como .zip en memoria. */
export function generarRespaldo(): Uint8Array {
  return zipSync(contenidoDelRespaldo(baseDeDatos()), { level: 6 });
}

export function guardarRespaldo(tipo: TipoRespaldo): ResultadoRespaldo {
  const datos = generarRespaldo();
  const extra = carpetaExtra();
  // El nombre no debe pisar ningún respaldo, ni aquí ni en la carpeta extra.
  const nombre = nombreDeRespaldo(tipo, extra ? [carpetaDeRespaldos(), extra] : [carpetaDeRespaldos()]);
  const ruta = path.join(carpetaDeRespaldos(), nombre);
  escribirSeguro(ruta, datos);
  depurar(carpetaDeRespaldos());

  let copiaExtra: ResultadoRespaldo["copiaExtra"] = null;
  if (extra) {
    try {
      const destino = path.join(extra, nombre);
      escribirSeguro(destino, datos);
      depurar(extra);
      copiaExtra = { ok: true, ruta: destino };
    } catch (error) {
      copiaExtra = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  guardarAjuste("ultimo_respaldo", new Date().toISOString());
  return { archivo: { nombre, tamano: datos.byteLength, creadoEn: new Date().toISOString(), tipo }, ruta, copiaExtra };
}

/** Guarda el respaldo del día si todavía no existe. */
export function respaldoDiarioSiFalta(): ResultadoRespaldo | null {
  const nombre = nombreDeRespaldo("diario");
  if (existsSync(path.join(carpetaDeRespaldos(), nombre))) return null;
  return guardarRespaldo("diario");
}

/*
 * El respaldo del día se hace "por detrás": comprimir y copiar a Google Drive
 * o a una USB puede tardar varios segundos, y mientras tanto el programa debe
 * seguir respondiendo. Por eso se comprime en un hilo aparte (fflate usa
 * worker_threads), se escribe con E/S asíncrona y nunca se espera desde una
 * pantalla. Solo corre uno a la vez.
 */
const estado = globalThis as unknown as { __respaldoDiarioEnCurso?: boolean };

/** El del día ya existe y es reciente (de las últimas 3 horas). */
function respaldoDelDiaAlCorriente(nombre: string): boolean {
  const ruta = path.join(carpetaDeRespaldos(), nombre);
  return existsSync(ruta) && Date.now() - statSync(ruta).mtimeMs < REFRESCAR_CADA_MS;
}

export function programarRespaldoDiario(): void {
  if (estado.__respaldoDiarioEnCurso) return;
  const nombre = nombreDeRespaldo("diario");
  if (respaldoDelDiaAlCorriente(nombre)) return;
  estado.__respaldoDiarioEnCurso = true;
  // Se espera un momento para no competir con la carga de la primera pantalla.
  setTimeout(() => {
    respaldoDiarioAsincrono(nombre)
      .catch((error) => console.error("No se pudo guardar el respaldo diario:", error))
      .finally(() => (estado.__respaldoDiarioEnCurso = false));
  }, 4000);
}

async function respaldoDiarioAsincrono(nombre: string) {
  if (respaldoDelDiaAlCorriente(nombre)) return;
  const datos = await new Promise<Uint8Array>((resolver, fallar) =>
    zip(contenidoDelRespaldo(baseDeDatos()), { level: 6 }, (error, zipeado) => (error ? fallar(error) : resolver(zipeado))),
  );
  await escribirSeguroAsincrono(path.join(carpetaDeRespaldos(), nombre), datos);
  depurar(carpetaDeRespaldos());
  const extra = carpetaExtra();
  if (extra) {
    try {
      await escribirSeguroAsincrono(path.join(extra, nombre), datos);
      depurar(extra);
    } catch (error) {
      console.error("No se pudo copiar el respaldo a la carpeta extra:", error);
    }
  }
  guardarAjuste("ultimo_respaldo", new Date().toISOString());
}

async function escribirSeguroAsincrono(destino: string, datos: Uint8Array) {
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(`${destino}.tmp`, datos);
  await rename(`${destino}.tmp`, destino);
}

/* ── Consultar ───────────────────────────────────────────────────────── */
export function listarRespaldos(): ArchivoRespaldo[] {
  if (!existsSync(carpetaDeRespaldos())) return [];
  return readdirSync(carpetaDeRespaldos())
    .filter((a) => PATRON.test(a))
    .map((nombre) => {
      const info = statSync(path.join(carpetaDeRespaldos(), nombre));
      const tipo: TipoRespaldo = nombre.includes("-manual")
        ? "manual"
        : nombre.includes("-antes-de-restaurar")
          ? "antes-de-restaurar"
          : nombre.includes("-antes-de-actualizar")
            ? "antes-de-actualizar"
            : "diario";
      return { nombre, tamano: info.size, creadoEn: info.mtime.toISOString(), tipo };
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/** Ruta de un respaldo por su nombre, solo si es un respaldo real de la carpeta. */
export function rutaDeRespaldo(nombre: string): string | null {
  if (!PATRON.test(nombre)) return null;
  const ruta = path.join(carpetaDeRespaldos(), nombre);
  return existsSync(ruta) ? ruta : null;
}

export const ultimoRespaldo = () => ajuste("ultimo_respaldo");

/* ── Restaurar ───────────────────────────────────────────────────────── */
/**
 * Reemplaza toda la información del programa con la de un respaldo.
 * Antes de hacerlo comprueba que el respaldo esté sano y guarda una copia de
 * la información actual, por si hubiera que regresar. Al terminar lo anota en
 * la bitácora (ya la del respaldo): quién restauró, qué archivo y dónde quedó
 * la copia previa.
 */
export function restaurarRespaldo(
  zip: Uint8Array,
  opciones: { usuario?: string | null; archivo?: string } = {},
): { copiaPrevia: string } {
  let archivos: Record<string, Uint8Array>;
  let total = 0;
  try {
    // Solo se extrae lo que puede venir en un respaldo real: la base, su ficha y las fotos.
    archivos = unzipSync(zip, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAXIMO_DESCOMPRIMIDO) throw new Error("demasiado grande");
        return f.name === ARCHIVO_BASE || f.name === "info.json" || FOTO_EN_RESPALDO.test(f.name);
      },
    });
  } catch {
    throw new ErrorDeDominio("Ese archivo no es un respaldo de Olimpo (debe ser un .zip creado por el programa).");
  }
  const base = archivos[ARCHIVO_BASE];
  const info = archivos["info.json"];
  if (!base || !info || !strFromU8(info).includes("Olimpo GYM")) {
    throw new ErrorDeDominio("Ese archivo no es un respaldo de Olimpo (debe ser un .zip creado por el programa).");
  }

  // Se revisa la base del respaldo antes de tocar nada.
  const temporal = path.join(entorno.rutaDatos, `restaurar-${Date.now()}.db`);
  writeFileSync(temporal, base);
  try {
    const prueba = new DatabaseSync(temporal);
    const integridad = (prueba.prepare("pragma integrity_check").get() as { integrity_check: string }).integrity_check;
    const tablas = new Set(
      (prueba.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map((t) => t.name),
    );
    const esperadas = ["socios", "planes", "suscripciones", "pagos", "personal", "ajustes", "bitacora"];
    if (integridad !== "ok" || !esperadas.every((t) => tablas.has(t))) {
      prueba.close();
      throw new ErrorDeDominio("El respaldo está dañado y no se puede restaurar.");
    }
    const version = Number((prueba.prepare("pragma user_version").get() as { user_version: number }).user_version);
    const admins = (prueba.prepare("select count(*) as n from personal where rol = 'administrador' and activo = 1").get() as { n: number }).n;
    if (version > MIGRACIONES.length) {
      prueba.close();
      throw new ErrorDeDominio("Ese respaldo es de una versión más nueva del programa. Actualiza el programa antes de restaurarlo.");
    }
    if (admins === 0) {
      prueba.close();
      throw new ErrorDeDominio("Ese respaldo no tiene ninguna cuenta de administración activa; no se puede restaurar.");
    }
    // Una llave de sesión que viniera en un respaldo viejo no se usa: se genera una nueva.
    prueba.exec("delete from ajustes where clave = 'llave_sesion'");
    // El código de recuperación tampoco viene del respaldo: se conserva el vigente
    // (uno ya usado no revive). Solo sirve si su cuenta existe en el respaldo,
    // activa y en administración; si no, queda sin código hasta generar uno en Mi cuenta.
    const codigo = ajuste("codigo_recuperacion");
    const dueno = ajuste("codigo_recuperacion_dueno");
    prueba.exec("delete from ajustes where clave in ('codigo_recuperacion', 'codigo_recuperacion_dueno')");
    const duenoValido =
      codigo && dueno && prueba.prepare("select 1 from personal where id = ? and rol = 'administrador' and activo = 1").get(dueno);
    if (duenoValido) {
      const guardar = prueba.prepare("insert into ajustes (clave, valor) values (?, ?)");
      guardar.run("codigo_recuperacion", codigo);
      guardar.run("codigo_recuperacion_dueno", dueno);
    }
    prueba.close();
  } catch (error) {
    rmSync(temporal, { force: true });
    throw error instanceof ErrorDeDominio ? error : new ErrorDeDominio("El respaldo está dañado y no se puede restaurar.");
  }

  // Las fotos se preparan aparte; si algo falla aquí, no se ha tocado nada todavía.
  const fotosNuevas = path.join(entorno.rutaDatos, `fotos-restaurando-${Date.now()}`);
  try {
    for (const [nombre, contenido] of Object.entries(archivos)) {
      if (!FOTO_EN_RESPALDO.test(nombre)) continue;
      const destino = path.join(fotosNuevas, ...nombre.slice("fotos/".length).split("/"));
      mkdirSync(path.dirname(destino), { recursive: true });
      writeFileSync(destino, contenido);
    }
    mkdirSync(fotosNuevas, { recursive: true });
  } catch {
    rmSync(temporal, { force: true });
    rmSync(fotosNuevas, { recursive: true, force: true });
    throw new ErrorDeDominio("No se pudieron preparar las fotos del respaldo. No se cambió nada.");
  }

  let copiaPrevia: string;
  try {
    copiaPrevia = guardarRespaldo("antes-de-restaurar").archivo.nombre;
  } catch (error) {
    rmSync(temporal, { force: true });
    rmSync(fotosNuevas, { recursive: true, force: true });
    throw error;
  }

  cerrarBase();
  reemplazarBaseYFotos(temporal, fotosNuevas, copiaPrevia);

  baseDeDatos(); // Se vuelve a abrir (y se actualiza si el respaldo es de una versión anterior).
  const quien = new Sesion(opciones.usuario ?? null);
  quien.escribir(() =>
    quien.ejecutar(
      "insert into bitacora (usuario_nombre, tabla, operacion, registro_id, antes, despues) values (?, 'respaldos', 'cambio', ?, null, ?)",
      opciones.usuario ?? null,
      opciones.archivo ?? null,
      JSON.stringify({ respaldo: opciones.archivo ?? null, copia_previa: copiaPrevia }),
    ),
  );
  return { copiaPrevia };
}

/**
 * Pone la base y las fotos del respaldo en lugar de las actuales. Primero se
 * apartan las actuales (fotos y base) y luego se ponen las nuevas; si algo
 * falla a medio camino (por ejemplo, Windows tiene una foto abierta), se
 * regresa todo como estaba, para que la base y las fotos nunca queden de
 * respaldos distintos.
 */
function reemplazarBaseYFotos(baseNueva: string, fotosNuevas: string, copiaPrevia: string) {
  const marca = Date.now();
  const fotosViejas = `${rutaFotos()}-anteriores-${marca}`;
  const baseVieja = `${rutaBase()}-anterior-${marca}`;
  const apartados: [original: string, apartado: string][] = [];
  const apartar = (original: string, apartado: string) => {
    renameSync(original, apartado);
    apartados.push([original, apartado]);
  };
  try {
    if (existsSync(rutaFotos())) apartar(rutaFotos(), fotosViejas);
    for (const sufijo of ["", "-wal", "-shm"]) {
      if (existsSync(`${rutaBase()}${sufijo}`)) apartar(`${rutaBase()}${sufijo}`, `${baseVieja}${sufijo}`);
    }
    renameSync(fotosNuevas, rutaFotos());
    renameSync(baseNueva, rutaBase());
  } catch {
    let regresado = true;
    try {
      // Lo nuevo que alcanzó a ponerse se quita, y lo apartado vuelve a su lugar.
      if (!existsSync(baseNueva)) rmSync(rutaBase(), { force: true });
      if (!existsSync(fotosNuevas)) rmSync(rutaFotos(), { recursive: true, force: true });
      for (const [original, apartado] of apartados.reverse()) renameSync(apartado, original);
    } catch {
      regresado = false;
    }
    rmSync(baseNueva, { force: true });
    rmSync(fotosNuevas, { recursive: true, force: true });
    throw new ErrorDeDominio(
      regresado
        ? "No se pudo reemplazar la información (quizá otro programa tiene abierta una foto o la base). No se cambió nada; cierra los demás programas e intenta de nuevo."
        : `No se pudo reemplazar la información y quedó a medias. Cierra el programa, vuelve a abrirlo y restaura ${copiaPrevia} para regresar a como estaba.`,
    );
  }
  // Lo anterior ya está en la copia previa: se borra lo apartado (si Windows no deja, se queda ahí sin estorbar).
  for (const [, apartado] of apartados) {
    try {
      rmSync(apartado, { recursive: true, force: true });
    } catch {
      /* se borrará a mano o en otra ocasión */
    }
  }
}
