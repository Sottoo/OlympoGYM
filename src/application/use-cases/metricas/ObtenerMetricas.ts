import { pluralizar } from "@/domain/shared/texto";
import { costoPorUnidad } from "@/domain/entities/Producto";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { MantenimientoRepository } from "@/domain/repositories/MantenimientoRepository";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { type FechaISO, primerDiaDelMes, sumarDias, sumarMeses } from "@/domain/shared/fechas";

/** Días de asistencia que se grafican, y los que se usan para las horas pico. */
const DIAS_ASISTENCIA = 30;
const SEMANAS_HORAS_PICO = 8;
const MESES_HISTORIA = 6;

export interface DiaDeAsistencia {
  fecha: FechaISO;
  entradas: number;
}

export interface MesDeIngresos {
  mes: FechaISO; // primer día del mes
  membresias: number;
  tienda: number;
  /** Lo pagado a técnicos ese mes (sale del dinero del gimnasio). */
  mantenimiento: number;
}

export interface MesDeSocios {
  mes: FechaISO;
  altas: number;
  bajas: number;
}

export interface Metricas {
  hoy: FechaISO;
  asistencia: {
    dias: DiaDeAsistencia[];
    total: number;
    /** Total de los 30 días anteriores, para comparar. */
    totalAnterior: number;
    promedioDiario: number;
    sociosDistintos: number;
  };
  /** Entradas por día de la semana (0 = lunes) y hora (0–23), últimas 8 semanas. */
  horasPico: number[][];
  ingresos: MesDeIngresos[];
  /**
   * Ingresos (membresías + tienda) del mes pasado del día 1 al mismo día de
   * hoy: el mes en curso va a medias y compararlo con un mes completo engaña.
   */
  ingresosMesPasadoALaFecha: number;
  socios: { activos: number; meses: MesDeSocios[] };
  productos: { masVendidos: { nombre: string; piezas: number; unidad: string; importe: number }[]; valorInventario: number };
  /** Las máquinas que más han costado en 12 meses. */
  equiposMasCostosos: { id: string; nombre: string; costo: number }[];
}

/** Indicadores para el dueño: asistencia, horas pico, ingresos, socios y tienda. */
export class ObtenerMetricas {
  constructor(
    private readonly asistencias: AsistenciaRepository,
    private readonly socios: SocioRepository,
    private readonly pagos: PagoRepository,
    private readonly ventas: VentaRepository,
    private readonly productos: ProductoRepository,
    private readonly mantenimiento: MantenimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<Metricas> {
    const hoy = this.reloj.hoy();
    const inicioAsistencia = sumarDias(hoy, -(DIAS_ASISTENCIA - 1));
    const inicioComparacion = sumarDias(inicioAsistencia, -DIAS_ASISTENCIA);
    const inicioHorasPico = sumarDias(hoy, -(SEMANAS_HORAS_PICO * 7 - 1));
    const meses = Array.from({ length: MESES_HISTORIA }, (_, i) => sumarMeses(primerDiaDelMes(hoy), i - (MESES_HISTORIA - 1)));

    // Mismo día del mes pasado (31 mar → 28 feb: sumarMeses ya lo recorta al último día).
    const mesPasado = sumarMeses(primerDiaDelMes(hoy), -1);
    const mismoDiaMesPasado = sumarMeses(hoy, -1);

    const [asistencias, socios, ventas30, productos, ingresos, costoPorEquipo, equipos, membresiasALaFecha, tiendaALaFecha] = await Promise.all([
      this.asistencias.listarEntre(inicioComparacion < inicioHorasPico ? inicioComparacion : inicioHorasPico, hoy),
      this.socios.listar(),
      this.ventas.listarEntre(inicioAsistencia, hoy),
      this.productos.listar(),
      Promise.all(
        meses.map(async (mes) => {
          const fin = sumarDias(sumarMeses(mes, 1), -1);
          const [membresias, tienda, mantenimiento] = await Promise.all([
            this.pagos.sumarEntre(mes, fin),
            this.ventas.sumarEntre(mes, fin),
            this.mantenimiento.sumarAbonosEntre(mes, fin),
          ]);
          return { mes, membresias, tienda, mantenimiento };
        }),
      ),
      this.mantenimiento.costoPorEquipo(sumarMeses(hoy, -12)),
      this.mantenimiento.listarEquipos(),
      this.pagos.sumarEntre(mesPasado, mismoDiaMesPasado),
      this.ventas.sumarEntre(mesPasado, mismoDiaMesPasado),
    ]);

    // Asistencia diaria de los últimos 30 días, con los días sin entradas en cero.
    const porDia = new Map<string, number>();
    for (const a of asistencias) porDia.set(a.fecha, (porDia.get(a.fecha) ?? 0) + 1);
    const dias = Array.from({ length: DIAS_ASISTENCIA }, (_, i) => {
      const fecha = sumarDias(inicioAsistencia, i);
      return { fecha, entradas: porDia.get(fecha) ?? 0 };
    });
    const recientes = asistencias.filter((a) => a.fecha >= inicioAsistencia);
    const total = recientes.length;
    const totalAnterior = asistencias.filter((a) => a.fecha >= inicioComparacion && a.fecha < inicioAsistencia).length;

    // Horas pico: día de la semana × hora local.
    const horasPico = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const a of asistencias) {
      if (a.fecha < inicioHorasPico) continue;
      const { hora } = this.reloj.local(a.registradaEn);
      const dia = (new Date(`${a.fecha}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
      horasPico[dia][hora]++;
    }

    // Altas y bajas por mes.
    const mesesSocios = meses.map((mes) => {
      const siguiente = sumarMeses(mes, 1);
      return {
        mes,
        altas: socios.filter((s) => {
          const alta = this.reloj.local(s.creadoEn).fecha;
          return alta >= mes && alta < siguiente;
        }).length,
        bajas: socios.filter((s) => s.fechaBaja && s.fechaBaja >= mes && s.fechaBaja < siguiente).length,
      };
    });

    // Productos más vendidos en 30 días.
    // A granel se cuentan porciones (scoops), no gramos; el orden es por lo que dejó en dinero.
    const vendidos = new Map<string, { nombre: string; piezas: number; unidad: string; importe: number }>();
    for (const venta of ventas30) {
      for (const p of venta.partidas) {
        const granel = p.unidad === "gramo" && p.porcionGramos;
        const nombrePorcion = p.porcionNombre ?? "porción";
        const actual = vendidos.get(p.productoId) ?? {
          nombre: p.productoNombre,
          piezas: 0,
          unidad: granel ? pluralizar(nombrePorcion) : "piezas",
          importe: 0,
        };
        actual.piezas += granel ? Math.round(p.cantidad / p.porcionGramos!) : p.cantidad;
        actual.importe += Math.round(p.cantidad * p.precioUnitario * 100) / 100;
        vendidos.set(p.productoId, actual);
      }
    }

    return {
      hoy,
      asistencia: {
        dias,
        total,
        totalAnterior,
        promedioDiario: total / DIAS_ASISTENCIA,
        sociosDistintos: new Set(recientes.map((a) => a.socioId)).size,
      },
      horasPico,
      ingresos,
      ingresosMesPasadoALaFecha: Math.round((membresiasALaFecha + tiendaALaFecha) * 100) / 100,
      socios: { activos: socios.filter((s) => s.activo).length, meses: mesesSocios },
      productos: {
        masVendidos: [...vendidos.values()].sort((a, b) => b.importe - a.importe).slice(0, 5),
        // A granel el costo es por bote y la existencia en gramos: se usa el costo por unidad.
        valorInventario: productos.filter((p) => p.activo).reduce((t, p) => t + p.stock * (costoPorUnidad(p) ?? 0), 0),
      },
      equiposMasCostosos: equipos
        .filter((e) => (costoPorEquipo.get(e.id) ?? 0) > 0)
        .map((e) => ({ id: e.id, nombre: e.nombre, costo: costoPorEquipo.get(e.id)! }))
        .sort((a, b) => b.costo - a.costo)
        .slice(0, 5),
    };
  }
}
