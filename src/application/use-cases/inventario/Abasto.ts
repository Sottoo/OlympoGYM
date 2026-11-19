import type { DatosNuevoMovimiento } from "@/domain/entities/MovimientoInventario";
import {
  costoPorUnidad,
  type DatosProducto,
  estadoDeStock,
  esGranel,
  type EstadoStock,
  precioPorUnidad,
  type Producto,
  validarProducto,
} from "@/domain/entities/Producto";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { Reloj } from "@/domain/services/Reloj";
import { ErrorDeDominio } from "@/domain/shared/ErrorDeDominio";
import { diasEntre, sumarDias } from "@/domain/shared/fechas";
import { LIMITES, revisarEntero } from "@/domain/shared/reglas";
import { claveDeNombre } from "@/domain/shared/texto";
import { revisarRepetidos } from "./GestionarProductos";

/** Días de ventas que se miran para calcular lo que se vende y a qué hora. */
const VENTANA_DIAS = 28;
const MAXIMO_GRAMOS = 1_000_000;

/* ── Más vendidos (para ordenar la Tienda) ──────────────────────────── */

export interface Popularidad {
  /** Puntaje para ordenar: cuántas veces se vende, con peso extra a esta hora del día. */
  puntaje: number;
  /** Entre lo que más sale a esta hora. */
  frecuente: boolean;
}

/**
 * Qué se vende más, y sobre todo qué se vende más a esta hora: en la mañana
 * quizá café y barras, en la tarde agua y suero. Así lo más pedido queda
 * arriba y una venta típica es tocar y cobrar.
 */
export class ObtenerPopularidad {
  constructor(
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<Map<string, Popularidad>> {
    const desde = sumarDias(this.reloj.hoy(), -VENTANA_DIAS);
    const ventas = await this.inventario.ventasConHora(desde);
    const horaActual = this.reloj.local(this.reloj.ahora()).hora;
    const puntajes = new Map<string, number>();
    for (const v of ventas) {
      const { hora } = this.reloj.local(v.instante);
      const distancia = Math.min(Math.abs(hora - horaActual), 24 - Math.abs(hora - horaActual));
      // Cada venta cuenta 1; si fue cerca de esta hora, cuenta más.
      const peso = 1 + (distancia <= 1 ? 3 : distancia <= 2 ? 1.5 : 0);
      puntajes.set(v.productoId, (puntajes.get(v.productoId) ?? 0) + peso);
    }
    const ordenados = [...puntajes.entries()].sort((a, b) => b[1] - a[1]);
    const frecuentes = new Set(ordenados.slice(0, 6).filter(([, p]) => p >= 3).map(([id]) => id));
    return new Map(ordenados.map(([id, puntaje]) => [id, { puntaje, frecuente: frecuentes.has(id) }]));
  }
}

/* ── Lista de compra ────────────────────────────────────────────────── */

export type Urgencia = "agotado" | "urgente" | "pronto" | "al_minimo";

export interface RenglonDeCompra {
  producto: Producto;
  estado: EstadoStock;
  urgencia: Urgencia;
  /** Lo que se vende en promedio al día (piezas o gramos). */
  promedioDiario: number;
  /** Para cuántos días alcanza lo que hay (null si no se ha vendido). */
  diasQueAlcanza: number | null;
  /** Cuánto pedir: piezas, o a granel, botes (si se sabe su contenido) o gramos. */
  pedir: number;
  pedirEn: "piezas" | "botes" | "gramos";
  /** Lo mismo en la unidad de la existencia (piezas o gramos), para registrar la llegada. */
  pedirUnidades: number;
  costoEstimado: number | null;
}

export interface ListaDeCompra {
  coberturaDias: number;
  renglones: RenglonDeCompra[];
  bienSurtidos: number;
  costoEstimado: number;
  /** Algún renglón no tiene costo capturado: el total es parcial. */
  costoIncompleto: boolean;
}

export const COBERTURAS = [7, 14, 30] as const;

/**
 * Qué comprar y cuánto, con lo que se ha vendido en las últimas semanas:
 * lo suficiente para cubrir los días elegidos más el mínimo de cada producto.
 */
export class ObtenerListaDeCompra {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(coberturaDias: number = 14): Promise<ListaDeCompra> {
    const cobertura = (COBERTURAS as readonly number[]).includes(coberturaDias) ? coberturaDias : 14;
    const hoy = this.reloj.hoy();
    const desde = sumarDias(hoy, -(VENTANA_DIAS - 1));
    const [productos, ventas] = await Promise.all([
      this.productos.listar({ soloActivos: true }),
      this.inventario.ventasPorProducto(desde, hoy),
    ]);
    const vendido = new Map(ventas.map((v) => [v.productoId, v.cantidad]));

    const renglones: RenglonDeCompra[] = [];
    let bienSurtidos = 0;
    for (const p of productos) {
      // Un producto nuevo no se mide contra 4 semanas: solo contra los días que lleva (mínimo una semana).
      const diasVivo = diasEntre(p.creadoEn.slice(0, 10), hoy) + 1;
      const diasObservados = Math.max(7, Math.min(VENTANA_DIAS, diasVivo));
      const promedioDiario = (vendido.get(p.id) ?? 0) / diasObservados;
      const diasQueAlcanza = promedioDiario > 0 ? p.stock / promedioDiario : null;
      const estado = estadoDeStock(p);

      let faltan = 0;
      if (promedioDiario > 0) faltan = Math.ceil(promedioDiario * cobertura + p.stockMinimo - p.stock);
      else if (estado !== "suficiente") faltan = Math.max(p.stockMinimo * 2 - p.stock, esGranel(p) ? (p.envaseGramos ?? p.porcionGramos ?? 1) : 1);
      if (faltan <= 0) {
        bienSurtidos++;
        continue;
      }

      const enBotes = esGranel(p) && p.envaseGramos;
      const pedir = enBotes ? Math.ceil(faltan / p.envaseGramos!) : faltan;
      const pedirUnidades = enBotes ? pedir * p.envaseGramos! : pedir;
      const costoUnidad = costoPorUnidad(p);
      const urgencia: Urgencia =
        p.stock <= 0 ? "agotado" : diasQueAlcanza !== null && diasQueAlcanza <= 3 ? "urgente" : diasQueAlcanza !== null && diasQueAlcanza <= cobertura ? "pronto" : "al_minimo";
      renglones.push({
        producto: p,
        estado,
        urgencia,
        promedioDiario,
        diasQueAlcanza,
        pedir,
        pedirEn: esGranel(p) ? (enBotes ? "botes" : "gramos") : "piezas",
        pedirUnidades,
        costoEstimado: costoUnidad === null ? null : Math.round(costoUnidad * pedirUnidades * 100) / 100,
      });
    }

    const orden: Record<Urgencia, number> = { agotado: 0, urgente: 1, pronto: 2, al_minimo: 3 };
    renglones.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || (a.diasQueAlcanza ?? 999) - (b.diasQueAlcanza ?? 999) || a.producto.nombre.localeCompare(b.producto.nombre, "es"));
    return {
      coberturaDias: cobertura,
      renglones,
      bienSurtidos,
      costoEstimado: Math.round(renglones.reduce((t, r) => t + (r.costoEstimado ?? 0), 0) * 100) / 100,
      costoIncompleto: renglones.some((r) => r.costoEstimado === null),
    };
  }
}

/* ── Llegó mercancía ────────────────────────────────────────────────── */

export interface EntradaDeMercancia {
  /** Cantidades en la unidad de la existencia: piezas, o gramos a granel. */
  partidas: { productoId: string; cantidad: number }[];
  /** Productos que llegaron y todavía no estaban dados de alta. */
  nuevos: { datos: DatosProducto; cantidad: number }[];
  /** Proveedor o factura (opcional). */
  nota: string | null;
}

/** Registra todo lo que llegó del proveedor en una sola operación. */
export class RecibirMercancia {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaDeMercancia): Promise<{ productos: number; nuevos: number }> {
    const nota = entrada.nota?.trim() || null;
    if (nota && nota.length > LIMITES.nota) throw new ErrorDeDominio(`La nota puede tener hasta ${LIMITES.nota} caracteres.`, "nota");
    const fecha = this.reloj.hoy();

    const cantidades = new Map<string, number>();
    for (const { productoId, cantidad } of entrada.partidas) {
      if (cantidad === 0) continue;
      const error = revisarEntero(cantidad, { min: 1, max: MAXIMO_GRAMOS, que: "La cantidad" });
      if (error) throw new ErrorDeDominio(error);
      cantidades.set(productoId, (cantidades.get(productoId) ?? 0) + cantidad);
    }
    const entradas: DatosNuevoMovimiento[] = [];
    for (const [productoId, cantidad] of cantidades) {
      const producto = await this.productos.obtenerPorId(productoId);
      if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe. Vuelve a abrir la pantalla.");
      entradas.push({ productoId, tipo: "entrada", cantidad, nota: nota ?? "Llegó mercancía", fecha });
    }

    const codigos = new Set<string>();
    const nombres = new Set<string>();
    const existentes = entrada.nuevos.length > 0 ? await this.productos.listar() : [];
    const nuevos = [];
    for (const n of entrada.nuevos) {
      const datos = validarProducto(n.datos);
      const error = revisarEntero(n.cantidad, { min: 0, max: MAXIMO_GRAMOS, que: `La cantidad de ${datos.nombre}` });
      if (error) throw new ErrorDeDominio(error);
      const repetido = revisarRepetidos(existentes, datos);
      if (repetido) throw new ErrorDeDominio(`${datos.nombre}: ${repetido.mensaje}`);
      if (nombres.has(claveDeNombre(datos.nombre))) throw new ErrorDeDominio(`«${datos.nombre}» está dos veces entre los nuevos. Déjalo una sola vez.`);
      nombres.add(claveDeNombre(datos.nombre));
      if (datos.codigo) {
        if (codigos.has(datos.codigo.toLowerCase())) throw new ErrorDeDominio(`El código ${datos.codigo} está en dos productos nuevos.`);
        codigos.add(datos.codigo.toLowerCase());
      }
      nuevos.push({ datos, inicial: n.cantidad, nota: nota ?? "Llegó mercancía" });
    }

    if (entradas.length === 0 && nuevos.length === 0) throw new ErrorDeDominio("Anota qué llegó: usa + o escanea los productos.");
    await this.inventario.recibir(nuevos, entradas, fecha);
    return { productos: entradas.length, nuevos: nuevos.length };
  }
}

/* ── Conteo físico ──────────────────────────────────────────────────── */

export interface ResultadoDelConteo {
  ajustados: number;
  /** Diferencias valuadas a precio de venta: lo que faltó (negativo) o sobró. */
  faltanteImporte: number;
  sobranteImporte: number;
  productosConFaltante: number;
}

/** Un producto contado: lo que hay en el anaquel y la existencia que mostraba la pantalla al contarlo. */
export interface ConteoDeProducto {
  productoId: string;
  contado: number;
  esperado: number;
}

/**
 * Se cuenta el anaquel y se escribe lo que hay; el programa calcula las
 * diferencias y ajusta todo de una vez. La diferencia se mide contra lo que
 * mostraba la pantalla, no contra la existencia al guardar: si mientras se
 * contaba se vendió o llegó algo, ese movimiento se respeta.
 */
export class ContarInventario {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly inventario: InventarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(conteos: ConteoDeProducto[], nota: string | null): Promise<ResultadoDelConteo> {
    const fecha = this.reloj.hoy();
    const ajustes: DatosNuevoMovimiento[] = [];
    let faltanteImporte = 0;
    let sobranteImporte = 0;
    let productosConFaltante = 0;
    for (const { productoId, contado, esperado } of conteos) {
      const producto = await this.productos.obtenerPorId(productoId);
      if (!producto) throw new ErrorDeDominio("Uno de los productos ya no existe. Vuelve a abrir la pantalla.");
      const error = revisarEntero(contado, { min: 0, max: MAXIMO_GRAMOS, que: `Lo contado de ${producto.nombre}` });
      if (error) throw new ErrorDeDominio(error);
      if (!Number.isInteger(esperado) || esperado < 0) throw new ErrorDeDominio("La pantalla del conteo está desactualizada. Vuelve a abrirla.");
      const diferencia = contado - esperado;
      if (diferencia === 0) continue;
      if (producto.stock + diferencia < 0) {
        throw new ErrorDeDominio(`${producto.nombre} cambió mientras contabas y ya no cuadra. Vuelve a contarlo (recarga la pantalla).`);
      }
      const importe = Math.abs(diferencia) * precioPorUnidad(producto);
      if (diferencia < 0) {
        faltanteImporte += importe;
        productosConFaltante++;
      } else sobranteImporte += importe;
      ajustes.push({ productoId, tipo: "ajuste", cantidad: diferencia, nota: nota?.trim() || "Conteo físico", fecha });
    }
    if (ajustes.length > 0) await this.inventario.registrarLote(ajustes);
    return {
      ajustados: ajustes.length,
      faltanteImporte: Math.round(faltanteImporte * 100) / 100,
      sobranteImporte: Math.round(sobranteImporte * 100) / 100,
      productosConFaltante,
    };
  }
}

/* ── Alta desde el catálogo ─────────────────────────────────────────── */

/** Da de alta de una vez los productos marcados del catálogo. */
export class AltaDesdeCatalogo {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(lote: { datos: DatosProducto; inicial: number }[]): Promise<number> {
    if (lote.length === 0) throw new ErrorDeDominio("Marca al menos un producto del catálogo.");
    const existentes = await this.productos.listar();
    const validos = lote.map(({ datos, inicial }) => {
      const v = validarProducto(datos);
      const repetido = revisarRepetidos(existentes, v);
      if (repetido) {
        throw new ErrorDeDominio(
          repetido.producto.activo
            ? `«${repetido.producto.nombre}» ya está en tu inventario. Desmárcalo.`
            : `«${repetido.producto.nombre}» ya existe, pero está desactivado. Desmárcalo y pulsa «Reactivar» en su renglón.`,
        );
      }
      const error = revisarEntero(inicial, { min: 0, max: MAXIMO_GRAMOS, que: `La existencia de ${v.nombre}` });
      if (error) throw new ErrorDeDominio(error);
      return { datos: v, inicial };
    });
    await this.productos.crearVarios(validos, this.reloj.hoy());
    return validos.length;
  }
}
