/**
 * El agente del lector de huellas (DPAgent.exe, del programa gratuito de HID).
 * Es el que lee el lector y le pasa el dedo a la ventana del programa.
 *
 * Por qué el programa lo reinicia por su cuenta (comprobado el 24/11/2026):
 *   · Si una ventana suelta el lector de golpe (el programa se cierra a la
 *     fuerza, se cuelga, se apaga mal la computadora), el agente se lo sigue
 *     apartando a esa ventana muerta: de unos segundos a más de 5 minutos, y
 *     mientras tanto no le lee el dedo a nadie. Un agente recién abierto no
 *     recuerda ventanas muertas: el lector queda libre en segundos.
 *   · Si el agente se cierra o se cae, nadie lo vuelve a abrir (lo abre
 *     Windows al iniciar sesión): el lector no funcionaría hasta reiniciar la
 *     computadora.
 *
 * Solo toca DPAgent.exe y solo si está en la carpeta de siempre del programa
 * de HID (así se puede volver a abrir). Nunca toca nada más.
 */
const { shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NOMBRE = "DPAgent.exe";

/** Dónde lo instala el programa de HID. */
function rutaDelAgente() {
  const bases = [process.env.ProgramW6432, process.env.ProgramFiles, "C:\\Program Files"].filter(Boolean);
  for (const base of bases) {
    const ruta = path.join(base, "HID Global", "Authentication Device Client", "Bin", NOMBRE);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

const ejecutar = (archivo, args) =>
  new Promise((resolver) => execFile(archivo, args, { windowsHide: true, timeout: 15_000 }, (error, salida) => resolver({ error, salida: String(salida ?? "") })));

/** Si el agente está corriendo (en esta sesión de Windows). */
async function corriendo() {
  const { salida } = await ejecutar("tasklist", ["/FI", `IMAGENAME eq ${NOMBRE}`, "/FO", "CSV", "/NH"]);
  return salida.toLowerCase().includes(NOMBRE.toLowerCase());
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a que el agente esté corriendo (hasta `limiteMs`). */
async function esperarQueCorra(limiteMs) {
  const hasta = Date.now() + limiteMs;
  while (Date.now() < hasta) {
    if (await corriendo()) return true;
    await esperar(500);
  }
  return false;
}

/** Una sola operación a la vez (dos pantallas podrían pedirlo juntas). */
let enCurso = null;

/**
 * `forzar`: lo cierra y lo vuelve a abrir (para soltar un lector apartado).
 * Sin `forzar`: solo lo abre si no está corriendo.
 * Devuelve { ok, accion } o { ok: false, error }.
 */
function reiniciarAgente({ forzar = false } = {}) {
  enCurso ??= (async () => {
    try {
      const ruta = rutaDelAgente();
      if (!ruta) return { ok: false, error: "No está instalado el programa del lector de HID." };
      const estaba = await corriendo();
      if (estaba && !forzar) return { ok: true, accion: "ya-corria" };
      if (estaba) {
        await ejecutar("taskkill", ["/IM", NOMBRE, "/F"]);
        // Que termine de cerrarse antes de abrir el nuevo.
        for (let i = 0; i < 20 && (await corriendo()); i++) await esperar(250);
      }
      // Se abre como con doble clic (Windows lo abre por su cuenta), NO como proceso hijo: un hijo
      // hereda lo que el programa tiene abierto (puertos, archivos, el candado de «ya está abierto»)
      // y, como el agente se queda corriendo, se lo quedaba aunque el programa se cerrara
      // (comprobado: el puerto de la ventana siguió ocupado hasta cerrar el agente).
      const error = await shell.openPath(ruta);
      if (error) return { ok: false, error: `No se pudo abrir el programa del lector: ${error}` };
      const ok = await esperarQueCorra(15_000);
      // El agente tarda unos segundos más en abrir su puerto después de arrancar.
      if (ok) await esperar(3000);
      return ok ? { ok: true, accion: estaba ? "reiniciado" : "abierto" } : { ok: false, error: "El programa del lector no arrancó." };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

/**
 * Al despertar de la suspensión (o al desbloquear tras un rato) se reinicia el
 * agente, igual que al desconectar y volver a conectar el lector. En otra
 * computadora, después de suspenderse, el agente quedaba entregando una sola
 * huella por cada «Reiniciar» y solo se arreglaba desconectando el lector
 * (24/11/2026). Si al despertar la sesión está bloqueada, se espera a que se
 * desbloquee: el agente nuevo arranca ya con la sesión en uso.
 *
 * `monitor` es powerMonitor de Electron; `avisar("inicio")` va antes de
 * cerrarlo (la pantalla suelta su conexión) y `avisar("listo")` al terminar
 * (vuelve a conectar); `anotar` escribe en la bitácora del lector.
 */
const BLOQUEO_LARGO_MS = 2 * 60_000;
const ESPERA_TRAS_DESPERTAR_MS = 3_000;
const ESPERA_TRAS_DESBLOQUEAR_MS = 1_000;
const ESPERA_PARA_SOLTAR_MS = 1_500;

function vigilarSuspension({ monitor, avisar, anotar, esperas = {} }) {
  const e = {
    bloqueoLargo: BLOQUEO_LARGO_MS,
    trasDespertar: ESPERA_TRAS_DESPERTAR_MS,
    trasDesbloquear: ESPERA_TRAS_DESBLOQUEAR_MS,
    paraSoltar: ESPERA_PARA_SOLTAR_MS,
    ...esperas,
  };
  let bloqueadaDesde = 0;
  let pendiente = false;
  let enMarcha = false;
  const reiniciar = async (motivo) => {
    pendiente = false;
    if (enMarcha) return;
    enMarcha = true;
    try {
      avisar("inicio");
      await esperar(e.paraSoltar);
      const r = await reiniciarAgente({ forzar: true });
      anotar(`agente de HID (${motivo}): ${r.ok ? r.accion : `falló: ${r.error}`}`);
    } catch (error) {
      anotar(`agente de HID (${motivo}): falló (${error instanceof Error ? error.message : error})`);
    } finally {
      enMarcha = false;
      avisar("listo");
    }
  };
  monitor.on("lock-screen", () => {
    bloqueadaDesde = Date.now();
  });
  monitor.on("resume", () => {
    if (bloqueadaDesde) {
      pendiente = true;
      return;
    }
    // Windows tarda un momento en volver a presentar los dispositivos USB.
    setTimeout(() => void reiniciar("al despertar"), e.trasDespertar);
  });
  monitor.on("unlock-screen", () => {
    const largo = bloqueadaDesde > 0 && Date.now() - bloqueadaDesde > e.bloqueoLargo;
    const motivo = pendiente ? "al despertar y desbloquear" : "al desbloquear tras un rato";
    bloqueadaDesde = 0;
    if (pendiente || largo) setTimeout(() => void reiniciar(motivo), e.trasDesbloquear);
  });
}

module.exports = { reiniciarAgente, vigilarSuspension };
