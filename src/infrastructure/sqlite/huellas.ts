import "server-only";
import type { Dedo, Huella, PlantillaDeSocio } from "@/domain/entities/Huella";
import type { HuellaRepository } from "@/domain/repositories/HuellaRepository";
import { nuevoId, type Sesion } from "./baseDeDatos";

interface FilaHuella {
  id: string;
  socio_id: string;
  dedo: Dedo;
  registrada_en: string;
}

const aHuella = (f: FilaHuella): Huella => ({ id: f.id, socioId: f.socio_id, dedo: f.dedo, registradaEn: f.registrada_en });

export class SqliteHuellaRepository implements HuellaRepository {
  constructor(private readonly s: Sesion) {}

  async listarDeSocio(socioId: string) {
    return this.s
      .todas<FilaHuella>("select id, socio_id, dedo, registrada_en from huellas where socio_id = ? order by registrada_en", socioId)
      .map(aHuella);
  }

  async plantillas(): Promise<PlantillaDeSocio[]> {
    return this.s
      .todas<{ socio_id: string; dedo: Dedo; plantilla: Uint8Array }>("select socio_id, dedo, plantilla from huellas")
      .map((f) => ({ socioId: f.socio_id, dedo: f.dedo, plantilla: f.plantilla }));
  }

  async guardar(datos: { socioId: string; dedo: Dedo; plantilla: Uint8Array }) {
    return this.s.escribir(() => {
      this.s.ejecutar(
        `insert into huellas (id, socio_id, dedo, plantilla) values (?, ?, ?, ?)
         on conflict (socio_id, dedo) do update
           set plantilla = excluded.plantilla, registrada_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        nuevoId(),
        datos.socioId,
        datos.dedo,
        datos.plantilla,
      );
      const fila = this.s.una<FilaHuella>("select id, socio_id, dedo, registrada_en from huellas where socio_id = ? and dedo = ?", datos.socioId, datos.dedo);
      return aHuella(fila!);
    });
  }

  async obtenerPorId(id: string) {
    const f = this.s.una<FilaHuella>("select id, socio_id, dedo, registrada_en from huellas where id = ?", id);
    return f ? aHuella(f) : null;
  }

  async eliminar(id: string) {
    this.s.escribir(() => this.s.ejecutar("delete from huellas where id = ?", id));
  }
}
