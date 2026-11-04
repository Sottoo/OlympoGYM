import type { Reloj } from "@/domain/services/Reloj";
import { hoyEn } from "@/domain/shared/fechas";

export class RelojSistema implements Reloj {
  private readonly formato: Intl.DateTimeFormat;

  constructor(private readonly zonaHoraria: string) {
    this.formato = new Intl.DateTimeFormat("en-CA", {
      timeZone: zonaHoraria,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
  }

  hoy() {
    return hoyEn(this.zonaHoraria);
  }

  ahora() {
    return new Date().toISOString();
  }

  local(instante: string) {
    const partes = Object.fromEntries(this.formato.formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
    return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) };
  }
}
