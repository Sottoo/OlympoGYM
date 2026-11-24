import "server-only";
import { type DatosEmpleado, type DatosPagoNomina, describirSemana, type Empleado, type PagoNomina } from "@/domain/entities/Nomina";
import type { MetodoPago } from "@/domain/entities/Pago";
import type { NominaRepository } from "@/domain/repositories/NominaRepository";
import { ErrorDeDominio, NoEncontrado } from "@/domain/shared/ErrorDeDominio";
import type { FechaISO } from "@/domain/shared/fechas";
import { nuevoId, type Sesion } from "./baseDeDatos";

interface FilaEmpleado {
  id: string;
  nombre: string;
  puesto: string | null;
  sueldo_semanal: number | null;
  activo: number;
  creado_en: string;
}

interface FilaPago {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  semana: string;
  monto: number;
  metodo: MetodoPago;
  fecha: string;
  nota: string | null;
  creado_en: string;
}

const aEmpleado = (f: FilaEmpleado): Empleado => ({
  id: f.id, nombre: f.nombre, puesto: f.puesto, sueldoSemanal: f.sueldo_semanal, activo: Boolean(f.activo), creadoEn: f.creado_en,
});
const aPago = (f: FilaPago): PagoNomina => ({
  id: f.id, empleadoId: f.empleado_id, empleadoNombre: f.empleado_nombre, semana: f.semana, monto: f.monto, metodo: f.metodo, fecha: f.fecha, nota: f.nota, creadoEn: f.creado_en,
});

const PAGOS = "select p.*, e.nombre as empleado_nombre from pagos_nomina p join empleados e on e.id = p.empleado_id";

export class SqliteNominaRepository implements NominaRepository {
  constructor(private readonly s: Sesion) {}

  async listarEmpleados() {
    return this.s.todas<FilaEmpleado>("select * from empleados order by activo desc, nombre collate nocase").map(aEmpleado);
  }

  async obtenerEmpleado(id: string) {
    const f = this.s.una<FilaEmpleado>("select * from empleados where id = ?", id);
    return f ? aEmpleado(f) : null;
  }

  async crearEmpleado(d: DatosEmpleado) {
    const id = nuevoId();
    this.s.escribir(() => this.s.ejecutar("insert into empleados (id, nombre, puesto, sueldo_semanal) values (?, ?, ?, ?)", id, d.nombre, d.puesto, d.sueldoSemanal));
    return aEmpleado(this.s.una<FilaEmpleado>("select * from empleados where id = ?", id)!);
  }

  async actualizarEmpleado(id: string, d: DatosEmpleado) {
    this.s.escribir(() => this.s.ejecutar("update empleados set nombre = ?, puesto = ?, sueldo_semanal = ? where id = ?", d.nombre, d.puesto, d.sueldoSemanal, id));
    const f = this.s.una<FilaEmpleado>("select * from empleados where id = ?", id);
    if (!f) throw new NoEncontrado("El empleado");
    return aEmpleado(f);
  }

  async cambiarEstadoEmpleado(id: string, activo: boolean) {
    this.s.escribir(() => this.s.ejecutar("update empleados set activo = ? where id = ?", activo ? 1 : 0, id));
  }

  async registrarPago(d: DatosPagoNomina & { fecha: FechaISO }) {
    const id = nuevoId();
    this.s.escribir(() => {
      // Un pago por empleado y semana. Se revisa en la misma transacción que guarda (dos pagos que
      // llegan a la vez no pasan los dos); la base también lo impide con su candado «unique».
      const ya = this.s.una<{ monto: number; fecha: string }>("select monto, fecha from pagos_nomina where empleado_id = ? and semana = ?", d.empleadoId, d.semana);
      if (ya) {
        const quien = this.s.una<{ nombre: string }>("select nombre from empleados where id = ?", d.empleadoId)?.nombre ?? "Ese empleado";
        throw new ErrorDeDominio(`A ${quien} ya se le pagó la semana ${describirSemana(d.semana)}. No se registró otro pago.`, "semana");
      }
      this.s.ejecutar(
        "insert into pagos_nomina (id, empleado_id, semana, monto, metodo, fecha, nota) values (?, ?, ?, ?, ?, ?, ?)",
        id, d.empleadoId, d.semana, d.monto, d.metodo, d.fecha, d.nota,
      );
    });
    return aPago(this.s.una<FilaPago>(`${PAGOS} where p.id = ?`, id)!);
  }

  async obtenerPago(id: string) {
    const f = this.s.una<FilaPago>(`${PAGOS} where p.id = ?`, id);
    return f ? aPago(f) : null;
  }

  async eliminarPago(id: string) {
    this.s.escribir(() => this.s.ejecutar("delete from pagos_nomina where id = ?", id));
  }

  async pagosDeSemanas(desde: FechaISO, hasta: FechaISO) {
    return this.s.todas<FilaPago>(`${PAGOS} where p.semana between ? and ? order by p.semana desc, e.nombre collate nocase`, desde, hasta).map(aPago);
  }

  async pagosHechosEntre(desde: FechaISO, hasta: FechaISO) {
    return this.s.todas<FilaPago>(`${PAGOS} where p.fecha between ? and ? order by p.creado_en desc`, desde, hasta).map(aPago);
  }
}
