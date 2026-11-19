import "server-only";
import { inflateSync } from "node:zlib";
import koffi, { type LibraryHandle } from "koffi";
import type { MotorDeHuellas } from "@/domain/services/MotorDeHuellas";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";

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
 * más parecido). Al registrar se comparan toques del mismo dedo entre sí: 1
 * falso positivo en 100 mil. Al identificar en el mostrador se compara contra
 * todos los socios, así que se exige 10 veces más: 1 en un millón por comparación.
 */
const UMBRAL_MISMO_DEDO = Math.floor(PROBABILIDAD_UNO / 100_000);
const UMBRAL_IDENTIFICAR = Math.floor(PROBABILIDAD_UNO / 1_000_000);
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
    if (r !== 0) throw new ErrorDeDominio("No se leyó bien la huella. Pon el dedo otra vez, plano y sin moverlo.");
    return new Uint8Array(salida.subarray(0, tamano[0]));
  }

  coinciden(a: Uint8Array, b: Uint8Array): boolean {
    const p = this.puntaje(a, b);
    return p !== null && p <= UMBRAL_MISMO_DEDO;
  }

  combinar(muestras: Uint8Array[]): Uint8Array {
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

  identificar(muestra: Uint8Array, plantillas: Uint8Array[]): number | null {
    let indice: number | null = null;
    let menor = Infinity;
    for (let i = 0; i < plantillas.length; i++) {
      const puntaje = this.puntaje(muestra, plantillas[i]);
      if (puntaje !== null && puntaje <= UMBRAL_IDENTIFICAR && puntaje < menor) {
        indice = i;
        menor = puntaje;
      }
    }
    return indice;
  }

  /** Qué tan distintas son (0 = idénticas), o null si el motor no pudo compararlas. */
  private puntaje(a: Uint8Array, b: Uint8Array): number | null {
    const puntaje = [PROBABILIDAD_UNO];
    const r = funciones().comparar(FORMATO_ANSI_378, a, a.length, 0, FORMATO_ANSI_378, b, b.length, 0, puntaje);
    return r === 0 ? puntaje[0] : null;
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
