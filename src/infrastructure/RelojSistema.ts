import type { Reloj } from "@/domain/services/Reloj";
import { hoyEn } from "@/domain/shared/fechas";

export class RelojSistema implements Reloj {
  constructor(private readonly zonaHoraria: string) {}

  hoy() {
    return hoyEn(this.zonaHoraria);
  }
}
