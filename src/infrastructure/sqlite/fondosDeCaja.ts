import "server-only";
import type { FondoDeCaja } from "@/domain/entities/FondoDeCaja";
import type { FondoDeCajaRepository } from "@/domain/repositories/FondoDeCajaRepository";
import { nuevoId, type Sesion } from "./baseDeDatos";

interface FilaFondo {
  id: string;
  fecha: string;
  monto: number;
}

const aFondo = (f: FilaFondo): FondoDeCaja => ({ id: f.id, fecha: f.fecha, monto: f.monto });

export class SqliteFondoDeCajaRepository implements FondoDeCajaRepository {
  constructor(private readonly s: Sesion) {}

  async delDia(fecha: string) {
    const f = this.s.una<FilaFondo>("select id, fecha, monto from fondos_de_caja where fecha = ?", fecha);
    return f ? aFondo(f) : null;
  }

  async ultimoAntesDe(fecha: string) {
    const f = this.s.una<FilaFondo>("select id, fecha, monto from fondos_de_caja where fecha < ? order by fecha desc limit 1", fecha);
    return f ? aFondo(f) : null;
  }

  async guardar(fecha: string, monto: number) {
    return this.s.escribir(() => {
      this.s.ejecutar(
        `insert into fondos_de_caja (id, fecha, monto) values (?, ?, ?)
         on conflict (fecha) do update set monto = excluded.monto where monto is not excluded.monto`,
        nuevoId(),
        fecha,
        monto,
      );
      return aFondo(this.s.una<FilaFondo>("select id, fecha, monto from fondos_de_caja where fecha = ?", fecha)!);
    });
  }
}
