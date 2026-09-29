import { estadoDeStock, type Producto } from "@/domain/entities/Producto";
import { nombreCompleto } from "@/domain/entities/Socio";
import { situacionDeMembresia } from "@/domain/entities/Suscripcion";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { primerDiaDelMes } from "@/domain/shared/fechas";

export interface FilaVencimiento {
  socioId: string;
  nombre: string;
  telefono: string | null;
  planNombre: string;
  fechaFin: string;
  diasRestantes: number;
}

export interface Resumen {
  hoy: string;
  totalSocios: number;
  vigentes: number;
  porVencer: FilaVencimiento[];
  vencidosRecientes: FilaVencimiento[];
  ingresos: { membresiasMes: number; ventasMes: number; ventasHoy: number };
  /** Productos activos agotados o en su stock mínimo, los más urgentes primero. */
  stockBajo: Producto[];
}

/** Cuántos días hacia atrás se muestran los vencidos (para ir a recuperarlos). */
const DIAS_VENCIDOS_VISIBLES = 30;

export class ObtenerResumen {
  constructor(
    private readonly socios: SocioRepository,
    private readonly suscripciones: SuscripcionRepository,
    private readonly pagos: PagoRepository,
    private readonly productos: ProductoRepository,
    private readonly ventas: VentaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<Resumen> {
    const hoy = this.reloj.hoy();
    const inicioMes = primerDiaDelMes(hoy);
    const [socios, ultimas, membresiasMes, ventasMes, ventasHoy, productos] = await Promise.all([
      this.socios.listar(),
      this.suscripciones.listarUltimaDeCadaSocio(),
      this.pagos.sumarEntre(inicioMes, hoy),
      this.ventas.sumarEntre(inicioMes, hoy),
      this.ventas.sumarEntre(hoy, hoy),
      this.productos.listar({ soloActivos: true }),
    ]);
    const sociosPorId = new Map(socios.filter((s) => s.activo).map((s) => [s.id, s]));

    const porVencer: FilaVencimiento[] = [];
    const vencidosRecientes: FilaVencimiento[] = [];
    let vigentes = 0;

    for (const suscripcion of ultimas) {
      const socio = sociosPorId.get(suscripcion.socioId);
      if (!socio) continue;
      const { estado, diasRestantes } = situacionDeMembresia(suscripcion, hoy);
      const fila: FilaVencimiento = {
        socioId: socio.id,
        nombre: nombreCompleto(socio),
        telefono: socio.telefono,
        planNombre: suscripcion.planNombre,
        fechaFin: suscripcion.fechaFin,
        diasRestantes: diasRestantes ?? 0,
      };
      if (estado === "vigente") vigentes++;
      if (estado === "por_vencer") {
        vigentes++;
        porVencer.push(fila);
      }
      if (estado === "vencida" && fila.diasRestantes >= -DIAS_VENCIDOS_VISIBLES) vencidosRecientes.push(fila);
    }

    porVencer.sort((a, b) => a.diasRestantes - b.diasRestantes);
    vencidosRecientes.sort((a, b) => b.diasRestantes - a.diasRestantes);

    const stockBajo = productos
      .filter((p) => estadoDeStock(p) !== "suficiente")
      // Agotados primero; después, los que están más por debajo de su mínimo.
      .sort((a, b) => Number(b.stock === 0) - Number(a.stock === 0) || a.stock - a.stockMinimo - (b.stock - b.stockMinimo));

    return {
      hoy,
      totalSocios: sociosPorId.size,
      vigentes,
      porVencer,
      vencidosRecientes,
      ingresos: { membresiasMes, ventasMes, ventasHoy },
      stockBajo,
    };
  }
}
