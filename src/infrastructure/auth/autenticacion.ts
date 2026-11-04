import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { capitalizarNombre, revisarContrasenaNueva, revisarNombre, revisarUsuario } from "@/domain/shared/reglas";
import { ErrorDeDominio, SinPermiso } from "@/domain/shared/ErrorDeDominio";
import { PERMISOS, type Permiso, puede, type Rol } from "@/domain/shared/permisos";
import { entorno } from "../config/entorno";
import { nuevoId, Sesion } from "../sqlite/baseDeDatos";

/*
 * Acceso al programa con usuario y contraseña, todo dentro de la computadora.
 *
 * · Las contraseñas se guardan cifradas con scrypt (no se pueden leer).
 * · La sesión es una cookie firmada con una llave que se genera la primera
 *   vez y vive en la base de datos (no viaja en los respaldos). La firma
 *   incluye la contraseña cifrada de la cuenta: al cambiar la contraseña,
 *   las sesiones abiertas con la anterior dejan de servir.
 * · Tras varios intentos fallidos, la cuenta espera unos minutos.
 * · Al crear la cuenta del administrador se entrega un código de
 *   recuperación: es la única forma de restablecer la contraseña olvidada.
 */

export interface PersonalActual {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
}

export type EstadoAcceso = { tipo: "autorizado"; personal: PersonalActual } | { tipo: "sin_sesion" };

const COOKIE = "olimpo_sesion";
/** Guarda por unos minutos el código de recuperación recién creado, para mostrarlo una sola vez. */
const COOKIE_CODIGO = "olimpo_codigo_nuevo";
/**
 * La sesión dura un turno (12 h) aunque se cierre y se vuelva a abrir el
 * programa. Después se vuelve a pedir la contraseña: así, en la computadora
 * del mostrador, nadie hereda la cuenta de la administración por días.
 */
const HORAS_SESION = 12;
const sistema = new Sesion("Sistema");

/* ── Cifrado ─────────────────────────────────────────────────────────── */
function cifrar(secreto: string): string {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString("hex")}$${scryptSync(secreto, sal, 64).toString("hex")}`;
}

function coincide(secreto: string, guardado: string): boolean {
  const [, salHex, hashHex] = guardado.split("$");
  if (!salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(secreto, Buffer.from(salHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

function ajuste(clave: string): string | null {
  return sistema.una<{ valor: string }>("select valor from ajustes where clave = ?", clave)?.valor ?? null;
}

function guardarAjuste(clave: string, valor: string) {
  sistema.escribir(() =>
    sistema.ejecutar("insert into ajustes (clave, valor) values (?, ?) on conflict (clave) do update set valor = excluded.valor", clave, valor),
  );
}

function llaveDeSesion(): string {
  let llave = ajuste("llave_sesion");
  if (!llave) {
    llave = randomBytes(32).toString("hex");
    guardarAjuste("llave_sesion", llave);
  }
  return llave;
}

/** La firma depende de la contraseña actual de la cuenta: cambiarla cierra las sesiones viejas. */
const firmar = (contenido: string, contrasenaCifrada: string) =>
  createHmac("sha256", llaveDeSesion()).update(contenido).update("\0").update(contrasenaCifrada).digest("base64url");

/* ── Intentos fallidos ───────────────────────────────────────────────── */
/*
 * Tras 5 intentos fallidos seguidos, esa cuenta (o el código de
 * recuperación) espera 1 minuto; cada nueva tanda duplica la espera, hasta
 * 15 minutos. Se lleva en memoria mientras el programa está abierto y se
 * limpia al entrar con la contraseña correcta.
 */
const intentos = new Map<string, { fallos: number; hasta: number }>();
const MAX_FALLOS = 5;

function esperaRestante(clave: string): number {
  const r = intentos.get(clave);
  return r && r.hasta > Date.now() ? Math.ceil((r.hasta - Date.now()) / 60_000) : 0;
}

function anotarFallo(clave: string) {
  const r = intentos.get(clave) ?? { fallos: 0, hasta: 0 };
  r.fallos++;
  if (r.fallos % MAX_FALLOS === 0) r.hasta = Date.now() + Math.min(15, 2 ** (r.fallos / MAX_FALLOS - 1)) * 60_000;
  intentos.set(clave, r);
}

const mensajeDeEspera = (minutos: number) =>
  `Demasiados intentos fallidos. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} y vuelve a intentarlo.`;

/** Para no revelar con el tiempo de respuesta qué usuarios existen. */
const CIFRADO_DE_RELLENO = cifrar("relleno-para-usuarios-inexistentes");

/** Código de recuperación legible: XXXX-XXXX-XXXX-XXXX (sin letras confusas). */
function nuevoCodigoDeRecuperacion(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const texto = [...bytes].map((b) => letras[b % letras.length]).join("");
  return texto.match(/.{4}/g)!.join("-");
}

const normalizarCodigo = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ── Sesión ──────────────────────────────────────────────────────────── */
async function abrirSesion(personalId: string) {
  const expira = Date.now() + HORAS_SESION * 3_600_000;
  const contenido = Buffer.from(JSON.stringify({ u: personalId, e: expira })).toString("base64url");
  const cuenta = sistema.una<{ contrasena: string }>("select contrasena from personal where id = ?", personalId);
  if (!cuenta) throw new ErrorDeDominio("La cuenta no existe.");
  (await cookies()).set(COOKIE, `${contenido}.${firmar(contenido, cuenta.contrasena)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expira),
  });
}

/** Quién está usando el programa. Se calcula una sola vez por petición. */
export const obtenerAcceso = cache(async (): Promise<EstadoAcceso> => {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return { tipo: "sin_sesion" };
  const [contenido, firma] = valor.split(".");
  if (!contenido || !firma) return { tipo: "sin_sesion" };

  let sesion: { u: string; e: number };
  try {
    sesion = JSON.parse(Buffer.from(contenido, "base64url").toString());
  } catch {
    return { tipo: "sin_sesion" };
  }
  const { u, e } = sesion;
  if (typeof u !== "string" || typeof e !== "number" || Date.now() > e) return { tipo: "sin_sesion" };
  const fila = sistema.una<PersonalActual & { activo: number; contrasena: string }>(
    "select id, nombre, usuario, rol, activo, contrasena from personal where id = ?",
    u,
  );
  if (!fila?.activo) return { tipo: "sin_sesion" };
  const esperada = Buffer.from(firmar(contenido, fila.contrasena));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return { tipo: "sin_sesion" };
  return { tipo: "autorizado", personal: { id: fila.id, nombre: fila.nombre, usuario: fila.usuario, rol: fila.rol } };
});

/** Para acciones que no pasan por los casos de uso: sin sesión, a la pantalla de entrada. */
export async function requerirSesion(): Promise<PersonalActual> {
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") redirect("/login");
  return acceso.personal;
}

/**
 * Para pantallas que solo puede abrir cierto perfil. Sin permiso se lleva a
 * una página que lo explica (en lugar de mostrar la pantalla vacía o un error).
 */
export async function exigirPermiso(permiso: Permiso): Promise<PersonalActual> {
  const personal = await requerirSesion();
  if (!puede(personal.rol, permiso)) redirect(`/sin-acceso?para=${encodeURIComponent(permiso)}`);
  return personal;
}

/** Para acciones: sin permiso se rechaza con un mensaje que se muestra en el formulario. */
export async function verificarPermiso(permiso: Permiso): Promise<PersonalActual> {
  const personal = await requerirSesion();
  if (!puede(personal.rol, permiso)) throw new SinPermiso(PERMISOS[permiso]);
  return personal;
}

/** Si quien usa el programa tiene un permiso (para mostrar u ocultar botones). */
export async function tienePermiso(permiso: Permiso): Promise<boolean> {
  const acceso = await obtenerAcceso();
  return acceso.tipo === "autorizado" && puede(acceso.personal.rol, permiso);
}

export function hayCuentas(): boolean {
  return (sistema.una<{ n: number }>("select count(*) as n from personal")?.n ?? 0) > 0;
}

export async function iniciarSesion(usuario: string, contrasena: string): Promise<string | null> {
  const nombreDeUsuario = usuario.trim().toLowerCase();
  const clave = `usuario:${nombreDeUsuario}`;
  const espera = esperaRestante(clave);
  if (espera > 0) return mensajeDeEspera(espera);
  const fila = sistema.una<{ id: string; contrasena: string; activo: number }>(
    "select id, contrasena, activo from personal where usuario = ?",
    nombreDeUsuario,
  );
  // Si el usuario no existe se calcula igual un cifrado, para tardar lo mismo.
  const correcta = coincide(contrasena, fila?.contrasena ?? CIFRADO_DE_RELLENO);
  if (!fila || !fila.activo || !correcta) {
    anotarFallo(clave);
    // Una pausa corta hace inútil probar contraseñas a toda velocidad.
    await new Promise((r) => setTimeout(r, 600));
    const ahora = esperaRestante(clave);
    return ahora > 0 ? mensajeDeEspera(ahora) : "El usuario o la contraseña no coinciden.";
  }
  intentos.delete(clave);
  await abrirSesion(fila.id);
  return null;
}

/**
 * Después de restaurar un respaldo la llave de sesiones es nueva: si la
 * cuenta de quien restauró existe en el respaldo, se le vuelve a abrir la
 * sesión para que no tenga que entrar de nuevo.
 */
export async function reabrirSesionTrasRestaurar(personalId: string): Promise<boolean> {
  const cuenta = sistema.una<{ activo: number }>("select activo from personal where id = ?", personalId);
  if (!cuenta?.activo) {
    (await cookies()).delete(COOKIE);
    return false;
  }
  await abrirSesion(personalId);
  return true;
}

export async function cerrarSesion(): Promise<void> {
  const galletas = await cookies();
  galletas.delete(COOKIE);
  galletas.delete({ name: COOKIE_CODIGO, path: "/bienvenida" });
}

/* ── Cuentas ─────────────────────────────────────────────────────────── */
function validarContrasena(contrasena: string, campo = "contrasena") {
  const error = revisarContrasenaNueva(contrasena);
  if (error) throw new ErrorDeDominio(error, campo);
}

/** Nombre de quien usa el programa (solo letras) y su usuario. */
function validarNombreYUsuario(datos: { nombre: string; usuario: string }) {
  const errorNombre = revisarNombre(datos.nombre, "nombre");
  if (errorNombre) throw new ErrorDeDominio(errorNombre, "nombre");
  const errorUsuario = revisarUsuario(datos.usuario);
  if (errorUsuario) throw new ErrorDeDominio(errorUsuario, "usuario");
  return { nombre: capitalizarNombre(datos.nombre), usuario: datos.usuario.trim().toLowerCase() };
}

/**
 * Primer arranque: crea la cuenta del administrador y abre su sesión.
 * Devuelve el código de recuperación, que se muestra una sola vez.
 */
export async function crearAdministrador(datos: { nombre: string; usuario: string; contrasena: string }): Promise<string> {
  if (hayCuentas()) throw new ErrorDeDominio("El programa ya tiene una cuenta de administrador.");
  const { nombre, usuario } = validarNombreYUsuario(datos);
  validarContrasena(datos.contrasena);

  const id = nuevoId();
  const codigo = nuevoCodigoDeRecuperacion();
  const creador = new Sesion(nombre);
  creador.escribir(() => {
    creador.ejecutar("insert into personal (id, nombre, usuario, contrasena, rol) values (?, ?, ?, ?, 'administrador')", id, nombre, usuario, cifrar(datos.contrasena));
    creador.ejecutar(
      "insert into ajustes (clave, valor) values ('codigo_recuperacion', ?) on conflict (clave) do update set valor = excluded.valor",
      cifrar(normalizarCodigo(codigo)),
    );
  });
  await abrirSesion(id);
  await guardarCodigoParaMostrar(codigo, id);
  return codigo;
}

async function guardarCodigoParaMostrar(codigo: string, personalId: string) {
  (await cookies()).set(COOKIE_CODIGO, `${personalId}|${codigo}`, { httpOnly: true, sameSite: "strict", path: "/bienvenida", maxAge: 600 });
}

/** El código recién creado (si lo hay), solo para la cuenta a la que se le creó. Se borra al salir de la pantalla. */
export async function codigoPorMostrar(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_CODIGO)?.value;
  const acceso = await obtenerAcceso();
  if (!valor || acceso.tipo !== "autorizado") return null;
  const [dueno, codigo] = valor.split("|");
  return dueno === acceso.personal.id && codigo ? codigo : null;
}

export async function olvidarCodigoMostrado() {
  (await cookies()).delete({ name: COOKIE_CODIGO, path: "/bienvenida" });
}

export async function cambiarContrasena(personalId: string, actual: string, nueva: string): Promise<void> {
  const fila = sistema.una<{ contrasena: string; nombre: string }>("select contrasena, nombre from personal where id = ?", personalId);
  if (!fila || !coincide(actual, fila.contrasena)) throw new ErrorDeDominio("La contraseña actual no es correcta.", "actual");
  validarContrasena(nueva, "nueva");
  if (actual === nueva) throw new ErrorDeDominio("La nueva debe ser distinta de la actual.", "nueva");
  const s = new Sesion(fila.nombre);
  s.escribir(() => s.ejecutar("update personal set contrasena = ? where id = ?", cifrar(nueva), personalId));
  // Las demás sesiones de la cuenta se cierran; la de quien la cambió sigue abierta.
  await abrirSesion(personalId);
}

/**
 * Restablece la contraseña del administrador con el código de recuperación.
 * El código se usa una sola vez: se entrega uno nuevo.
 */
export async function recuperarContrasena(codigo: string, nueva: string): Promise<string> {
  const espera = esperaRestante("recuperacion");
  if (espera > 0) throw new ErrorDeDominio(mensajeDeEspera(espera));
  const guardado = ajuste("codigo_recuperacion");
  if (!guardado || !coincide(normalizarCodigo(codigo), guardado)) {
    anotarFallo("recuperacion");
    await new Promise((r) => setTimeout(r, 600));
    throw new ErrorDeDominio("El código de recuperación no es correcto.", "codigo");
  }
  intentos.delete("recuperacion");
  validarContrasena(nueva);
  const admin = sistema.una<{ id: string; nombre: string }>("select id, nombre from personal where rol = 'administrador' and activo = 1 order by creado_en limit 1");
  if (!admin) throw new ErrorDeDominio("No hay una cuenta de administrador.");

  const codigoNuevo = nuevoCodigoDeRecuperacion();
  const s = new Sesion(admin.nombre);
  s.escribir(() => {
    s.ejecutar("update personal set contrasena = ? where id = ?", cifrar(nueva), admin.id);
    s.ejecutar("update ajustes set valor = ? where clave = 'codigo_recuperacion'", cifrar(normalizarCodigo(codigoNuevo)));
  });
  await abrirSesion(admin.id);
  await guardarCodigoParaMostrar(codigoNuevo, admin.id);
  return codigoNuevo;
}

/* ── Cuentas del personal (solo administración) ──────────────────────── */
export interface CuentaDePersonal {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

function validarDatosDeCuenta(datos: { nombre: string; usuario: string; rol: string }) {
  const { nombre, usuario } = validarNombreYUsuario(datos);
  if (datos.rol !== "administrador" && datos.rol !== "recepcion") throw new ErrorDeDominio("Elige un perfil.");
  return { nombre, usuario, rol: datos.rol as Rol };
}

export async function listarPersonal(): Promise<CuentaDePersonal[]> {
  await verificarPermiso("personal.gestionar");
  return sistema
    .todas<{ id: string; nombre: string; usuario: string; rol: Rol; activo: number; creado_en: string }>(
      "select id, nombre, usuario, rol, activo, creado_en from personal",
    )
    .map((f) => ({ id: f.id, nombre: f.nombre, usuario: f.usuario, rol: f.rol, activo: Boolean(f.activo), creadoEn: f.creado_en }))
    // Activas primero, luego administración, y por nombre como lo ordena una persona ("Ángel" va con la A).
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre, "es"));
}

export async function crearCuenta(datos: { nombre: string; usuario: string; rol: string; contrasena: string }): Promise<void> {
  const quien = await verificarPermiso("personal.gestionar");
  const { nombre, usuario, rol } = validarDatosDeCuenta(datos);
  validarContrasena(datos.contrasena);
  if (sistema.una("select 1 from personal where usuario = ?", usuario)) throw new ErrorDeDominio(`Ya existe una cuenta con el usuario «${usuario}». Prueba con otro.`, "usuario");
  const s = new Sesion(quien.nombre);
  s.escribir(() =>
    s.ejecutar("insert into personal (id, nombre, usuario, contrasena, rol) values (?, ?, ?, ?, ?)", nuevoId(), nombre, usuario, cifrar(datos.contrasena), rol),
  );
}

/** Siempre debe quedar al menos una cuenta de administración activa. */
function quedariaSinAdministracion(idQueCambia: string): boolean {
  const otros = sistema.una<{ n: number }>("select count(*) as n from personal where rol = 'administrador' and activo = 1 and id <> ?", idQueCambia);
  return (otros?.n ?? 0) === 0;
}

export async function cambiarPerfil(id: string, rol: string): Promise<void> {
  const quien = await verificarPermiso("personal.gestionar");
  if (rol !== "administrador" && rol !== "recepcion") throw new ErrorDeDominio("Elige un perfil.");
  // Nadie cambia su propio perfil: así no se puede quitar el acceso por accidente.
  if (id === quien.id) throw new ErrorDeDominio("No puedes cambiar tu propio perfil; pídeselo a otra cuenta de administración.");
  if (rol === "recepcion" && quedariaSinAdministracion(id)) throw new ErrorDeDominio("Debe quedar al menos una cuenta de administración.");
  const s = new Sesion(quien.nombre);
  s.escribir(() => s.ejecutar("update personal set rol = ? where id = ?", rol, id));
}

export async function cambiarEstadoDeCuenta(id: string, activo: boolean): Promise<void> {
  const quien = await verificarPermiso("personal.gestionar");
  if (!activo && id === quien.id) throw new ErrorDeDominio("No puedes desactivar tu propia cuenta.");
  if (!activo && quedariaSinAdministracion(id)) throw new ErrorDeDominio("Debe quedar al menos una cuenta de administración activa.");
  const s = new Sesion(quien.nombre);
  s.escribir(() => s.ejecutar("update personal set activo = ? where id = ?", activo ? 1 : 0, id));
}

/** La administración pone una contraseña nueva a otra cuenta (por ejemplo, si recepción la olvidó). */
export async function restablecerContrasenaDe(id: string, nueva: string): Promise<void> {
  const quien = await verificarPermiso("personal.gestionar");
  validarContrasena(nueva);
  if (!sistema.una("select 1 from personal where id = ?", id)) throw new ErrorDeDominio("La cuenta no existe.");
  const s = new Sesion(quien.nombre);
  s.escribir(() => s.ejecutar("update personal set contrasena = ? where id = ?", cifrar(nueva), id));
}

export { entorno };
