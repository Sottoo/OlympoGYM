import { GRUPOS_BITACORA, type RegistroBitacora, TABLAS_BITACORA, type TablaBitacora } from "@/domain/entities/RegistroBitacora";
import type { BitacoraRepository } from "@/domain/repositories/BitacoraRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { formatearFecha } from "@/shared/formato";

/** "en efectivo", "por transferencia". */
const conMetodo = (metodo: string) => ({ efectivo: "en efectivo", transferencia: "por transferencia" })[metodo] ?? `en ${metodo}`;

export const PERIODOS_BITACORA = { "7": "7 días", "30": "30 días", "90": "90 días" } as const;
export type PeriodoBitacora = keyof typeof PERIODOS_BITACORA;

const POR_PAGINA = 40;

export interface EventoBitacora {
  id: string;
  ocurridoEn: string;
  usuario: string;
  area: string;
  operacion: RegistroBitacora["operacion"];
  /** Qué pasó, en palabras: "Registró un pago de $550". */
  descripcion: string;
  /** Para cambios: qué campos se modificaron. */
  campos: string[];
}

/** Nombres legibles de las columnas que se muestran cuando algo cambia. */
const CAMPOS: Record<string, string> = {
  nombre: "nombre",
  apellidos: "apellidos",
  telefono: "celular",
  fecha_nacimiento: "fecha de nacimiento",
  foto: "foto",
  notas: "notas",
  activo: "estado",
  fecha_baja: "fecha de baja",
  motivo_baja: "motivo de baja",
  precio: "precio",
  precio_venta: "precio de venta",
  costo: "costo",
  stock: "existencias",
  stock_minimo: "stock mínimo",
  codigo: "código",
  categoria: "categoría",
  duracion: "duración",
  unidad: "unidad",
  descripcion: "descripción",
  fecha_inicio: "inicio",
  fecha_fin: "vencimiento",
  rol: "rol",
  area: "área",
  marca: "marca",
  modelo: "modelo",
  numero_serie: "número de serie",
  frecuencia_meses: "frecuencia de preventivo",
  atendido_en: "atención",
  cierre: "cierre",
};
const IGNORADOS = new Set(["id", "creado_en", "actualizado_en", "registrado_por", "numero"]);

const dinero = (v: unknown) => `$${Number(v ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
const texto = (v: unknown) => (typeof v === "string" ? v : "");

function describir(r: RegistroBitacora): string {
  const d = r.despues ?? r.antes ?? {};
  const nombre = [texto(d.nombre), texto(d.apellidos)].filter(Boolean).join(" ");
  switch (r.tabla) {
    case "socios":
      if (r.operacion === "alta") return `Registró al socio ${nombre}`;
      if (r.operacion === "eliminacion") return `Eliminó al socio ${nombre}`;
      if (r.antes?.activo === true && r.despues?.activo === false) return `Dio de baja a ${nombre}`;
      if (r.antes?.activo === false && r.despues?.activo === true) return `Reactivó a ${nombre}`;
      return `Cambió los datos de ${nombre}`;
    case "pagos":
      return r.operacion === "alta"
        ? `Registró un pago de ${dinero(d.monto)} ${conMetodo(texto(d.metodo))}`
        : r.operacion === "eliminacion" ? `Anuló un pago de ${dinero(d.monto)}` : `Modificó un pago de ${dinero(d.monto)}`;
    case "suscripciones":
      return r.operacion === "alta" && texto(d.fecha_fin)
        ? `Activó una membresía hasta el ${formatearFecha(texto(d.fecha_fin))}`
        : r.operacion === "eliminacion" ? "Eliminó una membresía" : "Modificó una membresía";
    case "ventas":
      return r.operacion === "alta" ? `Registró una venta de ${dinero(d.total)} ${conMetodo(texto(d.metodo))}` : `Modificó una venta de ${dinero(d.total)}`;
    case "movimientos_inventario": {
      const tipos: Record<string, string> = { entrada: "Entrada", venta: "Salida por venta", merma: "Merma", ajuste: "Ajuste por conteo" };
      const piezas = Math.abs(Number(d.cantidad ?? 0));
      return `${tipos[texto(d.tipo)] ?? "Movimiento"} de ${piezas} ${piezas === 1 ? "pieza" : "piezas"}`;
    }
    case "productos": {
      if (r.operacion === "alta") return `Dio de alta el producto ${texto(d.nombre)}`;
      if (r.operacion === "eliminacion") return `Eliminó el producto ${texto(d.nombre)}`;
      const soloFoto = camposCambiados(r).every((c) => c === "foto") && r.antes?.foto !== r.despues?.foto;
      if (soloFoto) return r.despues?.foto ? `Cambió la foto de ${texto(d.nombre)}` : `Quitó la foto de ${texto(d.nombre)}`;
      if (r.antes?.activo === true && r.despues?.activo === false) return `Desactivó el producto ${texto(d.nombre)}`;
      if (r.antes?.activo === false && r.despues?.activo === true) return `Reactivó el producto ${texto(d.nombre)}`;
      return `Cambió el producto ${texto(d.nombre)}`;
    }
    case "planes":
      return r.operacion === "alta" ? `Creó el plan ${texto(d.nombre)}` : `Cambió el plan ${texto(d.nombre)}`;
    case "asistencias":
      return r.operacion === "eliminacion" ? "Deshizo una entrada registrada por error" : "Registró una entrada";
    case "personal":
      return r.operacion === "alta" ? `Dio acceso a ${texto(d.nombre)}` : `Cambió el acceso de ${texto(d.nombre)}`;
    case "equipos":
      if (r.operacion === "alta") return `Dio de alta el equipo ${texto(d.nombre)}`;
      if (r.operacion === "eliminacion") return `Eliminó el equipo ${texto(d.nombre)}`;
      if (r.antes?.activo === true && r.despues?.activo === false) return `Dio de baja el equipo ${texto(d.nombre)}`;
      if (r.antes?.activo === false && r.despues?.activo === true) return `Reactivó el equipo ${texto(d.nombre)}`;
      return `Cambió los datos del equipo ${texto(d.nombre)}`;
    case "mantenimientos": {
      const tipo = texto(d.tipo) === "preventivo" ? "mantenimiento preventivo" : "reparación";
      if (r.operacion === "alta") return `Registró una ${tipo} de ${dinero(d.total)}: ${texto(d.descripcion)}`;
      if (r.operacion === "eliminacion") return `Eliminó el registro de una ${tipo} de ${dinero(d.total)}`;
      return `Modificó una ${tipo}`;
    }
    case "abonos_mantenimiento":
      return r.operacion === "alta"
        ? `Pagó ${dinero(d.monto)} de mantenimiento ${conMetodo(texto(d.metodo))}`
        : r.operacion === "eliminacion" ? `Anuló un pago de mantenimiento de ${dinero(d.monto)}` : `Modificó un pago de mantenimiento`;
    case "reportes_falla":
      if (r.operacion === "alta") return `Reportó una falla: ${texto(d.descripcion)}${d.fuera_de_servicio ? " (fuera de servicio)" : ""}`;
      if (r.antes?.atendido_en === null && d.atendido_en) return texto(d.cierre) ? `Cerró un reporte de falla: ${texto(d.cierre)}` : "Marcó como arreglada una falla";
      if (r.antes?.atendido_en && !d.atendido_en) return "Volvió a abrir un reporte de falla";
      return "Modificó un reporte de falla";
  }
}

function camposCambiados(r: RegistroBitacora): string[] {
  if (r.operacion !== "cambio" || !r.antes || !r.despues) return [];
  return Object.keys(r.despues)
    .filter((k) => !IGNORADOS.has(k) && JSON.stringify(r.antes?.[k]) !== JSON.stringify(r.despues?.[k]))
    .map((k) => CAMPOS[k] ?? k.replace(/_/g, " "));
}

/** Historial de cambios con filtros por área y periodo, en lenguaje claro. */
export class ConsultarBitacora {
  constructor(
    private readonly bitacora: BitacoraRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(opciones: { area?: string; periodo?: string; pagina?: number }) {
    const tabla = opciones.area && Object.hasOwn(TABLAS_BITACORA, opciones.area) ? (opciones.area as TablaBitacora) : undefined;
    const periodo: PeriodoBitacora =
      opciones.periodo && Object.hasOwn(PERIODOS_BITACORA, opciones.periodo) ? (opciones.periodo as PeriodoBitacora) : "7";
    const pagina = Math.max(1, Math.floor(opciones.pagina ?? 1));
    const desde = new Date(new Date(this.reloj.ahora()).getTime() - Number(periodo) * 86_400_000).toISOString();

    const tablas = tabla ? (GRUPOS_BITACORA[tabla] ?? [tabla]) : undefined;
    const { registros, hayMas } = await this.bitacora.listar({ tablas, desde, pagina, porPagina: POR_PAGINA });
    const eventos: EventoBitacora[] = registros.map((r) => ({
      id: r.id,
      ocurridoEn: r.ocurridoEn,
      usuario: r.usuario ?? "Sistema",
      area: TABLAS_BITACORA[r.tabla],
      operacion: r.operacion,
      descripcion: describir(r),
      campos: camposCambiados(r),
    }));
    return { eventos, hayMas, pagina, periodo, tabla: tabla ?? null };
  }
}
