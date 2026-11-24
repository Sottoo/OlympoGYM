import "server-only";
import { inflateSync } from "node:zlib";
import koffi, { type LibraryHandle } from "koffi";
import type { MotorDeHuellas } from "@/domain/services/MotorDeHuellas";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { anotarEnRegistroDelLector } from "./registroDelLector";

/**
 * Motor de huellas FingerJet de DigitalPersona (`dpfj.dll`), el mismo del
 * SDK U.are.U. Lo instala el cliente de HID ("HID Authentication Device
 * Client") junto con el servicio que lee el lector; aquí solo se llama a sus
 * funciones desde Node con koffi. Las plantillas son ANSI INCITS 378-2004.
 *
 * Cada función de dpfj devuelve 0 si salió bien o un código de error. OJO:
 * cuando falla, el puntaje se queda en 0, que significa "idénticas"; por eso
 * siempre se revisa el código antes de mirar el puntaje.
 */

const FORMATO_ANSI_378 = 0x001b0001;
const PROBABILIDAD_UNO = 0x7fffffff;
/**
 * Puntaje máximo para decir que dos plantillas son del mismo dedo (menor es
 * más parecido): 1 falso positivo en 100 mil comparaciones, el que recomienda
 * DigitalPersona. Al identificar se queda con la más parecida de todas.
 *
 * En el mostrador hay dos niveles. Antes se exigía siempre 1 en un millón y en
 * el gimnasio rechazaba huellas buenas («la lee pero no la reconoce»); bajarlo
 * a 1 en 100 mil para todo haría que, con cientos de socios, alguna vez un
 * dedo no registrado coincidiera con otro socio y entrara a su nombre solo.
 *   · 1 en un millón o mejor: SEGURO, la entrada se registra sola.
 *   · Entre 1 en un millón y 1 en 100 mil: PROBABLE, se abre su ficha con la
 *     foto y recepción confirma antes de registrar.
 */
const UMBRAL_MISMO_DEDO = Math.floor(PROBABILIDAD_UNO / 100_000);
const UMBRAL_IDENTIFICAR = UMBRAL_MISMO_DEDO;
const UMBRAL_SEGURO = Math.floor(PROBABILIDAD_UNO / 1_000_000);
/** El U.are.U 4500 entrega imágenes de 500 puntos por pulgada. */
const DPI_DEL_LECTOR = 500;
const TAMANO_MAXIMO_PLANTILLA = 4096;
/** dpfj_add_to_enrollment: aún faltan toques para armar la plantilla. */
const FALTAN_MUESTRAS = 0x05ba000d;

interface Funciones {
  crearDesdeImagen: (imagen: Buffer, tamano: number, ancho: number, alto: number, dpi: number, dedo: number, cbeff: number, formato: number, salida: Buffer, tamanoSalida: number[]) => number;
  comparar: (f1: number, p1: Uint8Array, t1: number, v1: number, f2: number, p2: Uint8Array, t2: number, v2: number, puntaje: number[]) => number;
  iniciarRegistro: (formato: number) => number;
  agregarAlRegistro: (formato: number, plantilla: Uint8Array, tamano: number, vista: number) => number;
  crearRegistro: (salida: Buffer, tamanoSalida: number[]) => number;
  terminarRegistro: () => number;
}

// Las funciones se cargan una sola vez por proceso (también al recargar en desarrollo).
const global = globalThis as unknown as { __fingerJet?: Funciones };

function funciones(): Funciones {
  if (global.__fingerJet) return global.__fingerJet;
  let lib: LibraryHandle;
  try {
    lib = koffi.load("dpfj.dll");
  } catch {
    throw new ErrorDeDominio(
      "Falta el programa del lector de huellas en esta computadora. Instala «HID Authentication Device Client» y vuelve a intentarlo.",
    );
  }
  global.__fingerJet = {
    crearDesdeImagen: lib.func(
      "int dpfj_create_fmd_from_raw(const uint8_t* image, uint32_t size, uint32_t width, uint32_t height, uint32_t dpi, int finger_pos, uint32_t cbeff_id, int fmd_type, _Out_ uint8_t* fmd, _Inout_ uint32_t* fmd_size)",
    ),
    comparar: lib.func(
      "int dpfj_compare(int t1, const uint8_t* f1, uint32_t s1, uint32_t v1, int t2, const uint8_t* f2, uint32_t s2, uint32_t v2, _Out_ uint32_t* score)",
    ),
    iniciarRegistro: lib.func("int dpfj_start_enrollment(int fmd_type)"),
    agregarAlRegistro: lib.func("int dpfj_add_to_enrollment(int fmd_type, const uint8_t* fmd, uint32_t fmd_size, uint32_t view_idx)"),
    crearRegistro: lib.func("int dpfj_create_enrollment_fmd(_Out_ uint8_t* fmd, _Inout_ uint32_t* fmd_size)"),
    terminarRegistro: lib.func("int dpfj_finish_enrollment()"),
  };
  return global.__fingerJet;
}

export class MotorFingerJet implements MotorDeHuellas {
  plantillaDeImagen(png: Uint8Array): Uint8Array {
    const { ancho, alto, gris } = pngAEscalaDeGrises(png);
    const salida = Buffer.alloc(TAMANO_MAXIMO_PLANTILLA);
    const tamano = [salida.length];
    const r = funciones().crearDesdeImagen(gris, gris.length, ancho, alto, DPI_DEL_LECTOR, 0, 0, FORMATO_ANSI_378, salida, tamano);
    if (r !== 0) {
      anotarEnRegistroDelLector(`imagen ${ancho}x${alto}: el motor no pudo sacar la plantilla (código 0x${(r >>> 0).toString(16)})`);
      throw new ErrorDeDominio("No se leyó bien la huella. Pon el dedo otra vez, plano y sin moverlo.");
    }
    return new Uint8Array(salida.subarray(0, tamano[0]));
  }

  coinciden(a: Uint8Array, b: Uint8Array): boolean {
    const p = this.puntaje(a, b);
    return p !== null && p <= UMBRAL_MISMO_DEDO;
  }

  combinar(muestras: Uint8Array[]): Uint8Array {
    if (!muestras.every(esPlantillaValida)) {
      anotarEnRegistroDelLector("registro: llegó un toque con la plantilla dañada; no se le pasó al motor");
      throw new ErrorDeDominio("Uno de los toques no sirvió para registrar la huella. Vuelve a empezar.");
    }
    const f = funciones();
    if (f.iniciarRegistro(FORMATO_ANSI_378) !== 0) throw new ErrorDeDominio("No se pudo preparar el registro de la huella. Intenta de nuevo.");
    try {
      let r = FALTAN_MUESTRAS;
      for (const m of muestras) {
        r = f.agregarAlRegistro(FORMATO_ANSI_378, m, m.length, 0) >>> 0;
        if (r === 0) break;
        if (r !== FALTAN_MUESTRAS) throw new ErrorDeDominio("Uno de los toques no sirvió para registrar la huella. Vuelve a empezar.");
      }
      if (r !== 0) throw new ErrorDeDominio("Los toques no alcanzaron para registrar la huella. Vuelve a empezar, con el dedo plano y centrado.");
      const salida = Buffer.alloc(TAMANO_MAXIMO_PLANTILLA);
      const tamano = [salida.length];
      if (f.crearRegistro(salida, tamano) !== 0) throw new ErrorDeDominio("No se pudo registrar la huella. Vuelve a empezar.");
      return new Uint8Array(salida.subarray(0, tamano[0]));
    } finally {
      f.terminarRegistro();
    }
  }

  identificar(muestra: Uint8Array, plantillas: Uint8Array[]): { indice: number; seguro: boolean } | null {
    let masParecida: number | null = null;
    let menor = Infinity;
    let fallidas = 0;
    for (let i = 0; i < plantillas.length; i++) {
      const puntaje = this.puntaje(muestra, plantillas[i]);
      if (puntaje === null) fallidas++;
      else if (puntaje < menor) {
        masParecida = i;
        menor = puntaje;
      }
    }
    const coincide = masParecida !== null && menor <= UMBRAL_IDENTIFICAR;
    const seguro = coincide && menor <= UMBRAL_SEGURO;
    // Para diagnosticar: qué tan parecida fue la mejor («1 en N» falsos positivos; arriba de 100 000 es coincidencia).
    const parecido = masParecida === null ? "ninguna comparable" : menor === 0 ? "idéntica" : `1 en ${Math.round(PROBABILIDAD_UNO / menor).toLocaleString("es-MX")}`;
    anotarEnRegistroDelLector(
      `comparó contra ${plantillas.length} huellas${fallidas ? ` (${fallidas} no se pudieron comparar)` : ""}: ${seguro ? "COINCIDE (segura)" : coincide ? "COINCIDE (probable, confirma recepción)" : "no coincide"}, la más parecida ${parecido}`,
    );
    return coincide && masParecida !== null ? { indice: masParecida, seguro } : null;
  }

  /** Qué tan distintas son (0 = idénticas), o null si el motor no pudo compararlas. */
  private puntaje(a: Uint8Array, b: Uint8Array): number | null {
    // Una plantilla dañada nunca llega al motor: dpfj no la revisa y tumba el programa (ver esPlantillaValida).
    if (!esPlantillaValida(a) || !esPlantillaValida(b)) return null;
    const puntaje = [PROBABILIDAD_UNO];
    const r = funciones().comparar(FORMATO_ANSI_378, a, a.length, 0, FORMATO_ANSI_378, b, b.length, 0, puntaje);
    return r === 0 ? puntaje[0] : null;
  }
}

/**
 * La plantilla está completa y bien formada (ANSI INCITS 378-2004), así que se
 * le puede pasar al motor sin peligro.
 *
 * dpfj.dll NO revisa las plantillas que recibe: si el número de minucias de
 * una vista dice más de las que de verdad trae, lee fuera de la plantilla y
 * tumba el programa entero (comprobado: cambiar ese solo byte de una plantilla
 * real lo tiró 28 de cada 120 veces). Una plantilla así podría venir de la
 * pantalla durante el registro (los toques anteriores van y vienen) o de una
 * huella guardada que se dañó. Por eso se recorre completa: encabezado, largo
 * total y cada vista con sus minucias y su bloque extendido deben cuadrar
 * exactamente con el tamaño.
 */
export function esPlantillaValida(p: Uint8Array): boolean {
  try {
    if (p.length < 32 || p.length > TAMANO_MAXIMO_PLANTILLA) return false;
    const d = Buffer.from(p.buffer, p.byteOffset, p.byteLength);
    if (d.toString("latin1", 0, 8) !== "FMR\u0000 20\u0000") return false;
    // Largo del registro: 2 bytes; si vale 0, va en los 4 siguientes y el encabezado crece 4 bytes.
    const corto = d.readUInt16BE(8);
    const largo = corto !== 0 ? corto : d.readUInt32BE(10);
    const encabezado = corto !== 0 ? 26 : 30;
    if (largo !== d.length) return false;
    const vistas = d[encabezado - 2];
    if (vistas < 1 || vistas > 16) return false;
    let pos = encabezado;
    for (let v = 0; v < vistas; v++) {
      if (pos + 4 > d.length) return false;
      pos += 4 + 6 * d[pos + 3];
      if (pos + 2 > d.length) return false;
      pos += 2 + d.readUInt16BE(pos);
    }
    return pos === d.length;
  } catch {
    return false;
  }
}

/**
 * Convierte el PNG del lector (8 bits, con paleta de grises) en un arreglo de
 * píxeles en escala de grises, que es lo que pide el motor. Acepta también
 * PNG en gris o color de 8 bits, sin entrelazado.
 */
export function pngAEscalaDeGrises(png: Uint8Array): { ancho: number; alto: number; gris: Buffer } {
  const datos = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  const invalida = () => new ErrorDeDominio("La imagen del lector llegó dañada. Pon el dedo otra vez.");
  if (datos.length < 33 || datos.readUInt32BE(0) !== 0x89504e47) throw invalida();

  let ancho = 0, alto = 0, profundidad = 0, tipo = -1;
  let paleta: Buffer | null = null;
  const idat: Buffer[] = [];
  for (let pos = 8; pos + 8 <= datos.length; ) {
    const largo = datos.readUInt32BE(pos);
    const nombre = datos.toString("ascii", pos + 4, pos + 8);
    const cuerpo = datos.subarray(pos + 8, pos + 8 + largo);
    if (nombre === "IHDR") {
      ancho = cuerpo.readUInt32BE(0);
      alto = cuerpo.readUInt32BE(4);
      profundidad = cuerpo[8];
      tipo = cuerpo[9];
      if (cuerpo[12] !== 0) throw invalida();
    } else if (nombre === "PLTE") paleta = cuerpo;
    else if (nombre === "IDAT") idat.push(cuerpo);
    else if (nombre === "IEND") break;
    pos += 12 + largo;
  }
  const canales = ({ 0: 1, 3: 1, 4: 2, 2: 3, 6: 4 } as Record<number, number>)[tipo];
  if (!canales || profundidad !== 8 || ancho < 100 || alto < 100 || ancho > 2000 || alto > 2000 || (tipo === 3 && !paleta)) throw invalida();

  let crudo: Buffer;
  try {
    crudo = inflateSync(Buffer.concat(idat));
  } catch {
    throw invalida();
  }
  const porFila = ancho * canales;
  if (crudo.length < (porFila + 1) * alto) throw invalida();

  // Quita los filtros de cada fila (PNG guarda cada fila como diferencia con la anterior).
  const px = Buffer.alloc(porFila * alto);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (porFila + 1)];
    const inicio = y * (porFila + 1) + 1;
    for (let x = 0; x < porFila; x++) {
      const a = x >= canales ? px[y * porFila + x - canales] : 0;
      const b = y > 0 ? px[(y - 1) * porFila + x] : 0;
      const c = x >= canales && y > 0 ? px[(y - 1) * porFila + x - canales] : 0;
      let prediccion = 0;
      if (filtro === 1) prediccion = a;
      else if (filtro === 2) prediccion = b;
      else if (filtro === 3) prediccion = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        prediccion = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * porFila + x] = (crudo[inicio + x] + prediccion) & 0xff;
    }
  }

  const gris = Buffer.alloc(ancho * alto);
  for (let i = 0; i < gris.length; i++) {
    if (tipo === 3) {
      const k = px[i] * 3;
      gris[i] = paleta && k + 2 < paleta.length ? Math.round((paleta[k] + paleta[k + 1] + paleta[k + 2]) / 3) : 255;
    } else if (canales >= 3) {
      gris[i] = Math.round((px[i * canales] + px[i * canales + 1] + px[i * canales + 2]) / 3);
    } else {
      gris[i] = px[i * canales];
    }
  }
  return { ancho, alto, gris };
}
