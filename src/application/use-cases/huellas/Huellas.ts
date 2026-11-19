import { type Dedo, DEDOS, type Huella, TOQUES_PARA_REGISTRAR } from "@/domain/entities/Huella";
import { nombreCompleto } from "@/domain/entities/Socio";
import type { HuellaRepository } from "@/domain/repositories/HuellaRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { MotorDeHuellas } from "@/domain/services/MotorDeHuellas";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";

/*
 * Huellas de los socios:
 *   · Registro: en la ficha del socio, 4 toques del mismo dedo. Cada toque se
 *     revisa al momento (LeerToque) y al final se guardan combinados.
 *   · Mostrador: el socio pone el dedo y se sabe quién es (IdentificarPorHuella);
 *     de ahí sigue el mismo camino que la credencial escaneada.
 */

/** Un toque leído durante el registro: su plantilla y si es del mismo dedo que los anteriores. */
export interface ToqueLeido {
  plantilla: Uint8Array;
  /** Coincide con al menos uno de los toques anteriores (siempre true si es el primero). */
  coincide: boolean;
}

export class LeerToque {
  constructor(private readonly motor: MotorDeHuellas) {}

  async ejecutar(imagen: Uint8Array, anteriores: Uint8Array[]): Promise<ToqueLeido> {
    const plantilla = this.motor.plantillaDeImagen(imagen);
    const coincide = anteriores.length === 0 || anteriores.some((a) => this.motor.coinciden(plantilla, a));
    return { plantilla, coincide };
  }
}

export class RegistrarHuella {
  constructor(
    private readonly huellas: HuellaRepository,
    private readonly socios: SocioRepository,
    private readonly motor: MotorDeHuellas,
  ) {}

  async ejecutar(datos: { socioId: string; dedo: Dedo; toques: Uint8Array[]; consentimiento: boolean }): Promise<Huella> {
    if (!datos.consentimiento) {
      throw new ErrorDeDominio("Para guardar la huella, marca que el socio está de acuerdo en que se use para registrar sus entradas.", "consentimiento");
    }
    if (!(datos.dedo in DEDOS)) throw new ErrorDeDominio("Elige qué dedo se va a registrar.", "dedo");
    const socio = await this.socios.obtenerPorId(datos.socioId);
    if (!socio) throw new NoEncontrado("El socio");
    if (!socio.activo) throw new ErrorDeDominio("El socio está dado de baja. Reactívalo antes de registrar su huella.");
    if (datos.toques.length !== TOQUES_PARA_REGISTRAR) throw new ErrorDeDominio(`Se necesitan ${TOQUES_PARA_REGISTRAR} toques del mismo dedo.`);

    // Los toques se vuelven a revisar aquí: todos deben ser del mismo dedo.
    const { toques } = datos;
    const sueltos = toques.filter((t, i) => !toques.some((otro, j) => i !== j && this.motor.coinciden(t, otro)));
    if (sueltos.length > 0) throw new ErrorDeDominio("Los toques no son del mismo dedo. Vuelve a empezar.");
    const plantilla = this.motor.combinar(toques);

    // Una huella no puede quedar a nombre de dos socios: el mostrador no sabría a quién registrar.
    const guardadas = (await this.huellas.plantillas()).filter((p) => !(p.socioId === socio.id && p.dedo === datos.dedo));
    const igual = this.motor.identificar(plantilla, guardadas.map((p) => p.plantilla));
    if (igual !== null) {
      const dueno = guardadas[igual];
      if (dueno.socioId === socio.id) throw new ErrorDeDominio(`Ese dedo ya está registrado como «${DEDOS[dueno.dedo]}». Elige el dedo correcto o borra la otra huella.`);
      const otro = await this.socios.obtenerPorId(dueno.socioId);
      throw new ErrorDeDominio(`Esa huella ya está registrada a nombre de ${otro ? nombreCompleto(otro) : "otro socio"}.`);
    }

    return this.huellas.guardar({ socioId: socio.id, dedo: datos.dedo, plantilla });
  }
}

export class IdentificarPorHuella {
  constructor(
    private readonly huellas: HuellaRepository,
    private readonly motor: MotorDeHuellas,
  ) {}

  /** Id del socio dueño de la huella. Si nadie coincide, lanza un error para mostrar en el mostrador. */
  async ejecutar(imagen: Uint8Array): Promise<string> {
    const muestra = this.motor.plantillaDeImagen(imagen);
    const guardadas = await this.huellas.plantillas();
    if (guardadas.length === 0) throw new ErrorDeDominio("Todavía no hay huellas registradas. Regístralas desde la ficha de cada socio.");
    const i = this.motor.identificar(muestra, guardadas.map((p) => p.plantilla));
    if (i === null) throw new ErrorDeDominio("No se reconoció la huella. Pide que ponga el dedo otra vez o búscalo por nombre.");
    return guardadas[i].socioId;
  }
}

export class ListarHuellasDeSocio {
  constructor(private readonly huellas: HuellaRepository) {}

  async ejecutar(socioId: string): Promise<Huella[]> {
    return this.huellas.listarDeSocio(socioId);
  }
}

export class BorrarHuella {
  constructor(private readonly huellas: HuellaRepository) {}

  async ejecutar(id: string): Promise<Huella> {
    const huella = await this.huellas.obtenerPorId(id);
    if (!huella) throw new NoEncontrado("La huella");
    await this.huellas.eliminar(id);
    return huella;
  }
}
