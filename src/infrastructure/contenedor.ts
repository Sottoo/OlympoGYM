import "server-only";
/**
 * Contenedor de dependencias (composition root).
 *
 * Es el ÚNICO lugar donde se decide qué implementación concreta usa cada
 * caso de uso: Supabase o memoria (modo demo). Si mañana cambias de base de
 * datos, solo tocas este archivo y la carpeta de infraestructura; el dominio
 * y los casos de uso quedan igual.
 */
import { MarcarAvisoEnviado, ObtenerAvisosPendientes } from "@/application/use-cases/avisos/AvisosWhatsApp";
import { ObtenerResumen } from "@/application/use-cases/dashboard/ObtenerResumen";
import {
  CambiarEstadoProducto,
  CrearProducto,
  EditarProducto,
  ListarProductos,
  ObtenerDetalleProducto,
} from "@/application/use-cases/inventario/GestionarProductos";
import { RegistrarMovimiento } from "@/application/use-cases/inventario/RegistrarMovimiento";
import { CambiarEstadoPlan, CrearPlan, ListarPlanes } from "@/application/use-cases/planes/GestionarPlanes";
import { DarDeBajaSocio, EditarSocio, ReactivarSocio } from "@/application/use-cases/socios/GestionarSocio";
import { ListarSocios } from "@/application/use-cases/socios/ListarSocios";
import { ObtenerDetalleSocio } from "@/application/use-cases/socios/ObtenerDetalleSocio";
import { RegistrarSocio } from "@/application/use-cases/socios/RegistrarSocio";
import { AsignarPlan } from "@/application/use-cases/suscripciones/AsignarPlan";
import { ObtenerCorteDelDia, RegistrarVenta } from "@/application/use-cases/ventas/Ventas";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import { entorno, modoDemo } from "./config/entorno";
import { RelojSistema } from "./RelojSistema";
import { obtenerAlmacen } from "./repositories/memoria/AlmacenMemoria";
import {
  MemoriaInventarioRepository,
  MemoriaPagoRepository,
  MemoriaPlanRepository,
  MemoriaProductoRepository,
  MemoriaSocioRepository,
  MemoriaSuscripcionRepository,
  MemoriaVentaRepository,
} from "./repositories/memoria/MemoriaRepositorios";
import { SupabaseInventarioRepository } from "./repositories/supabase/SupabaseInventarioRepository";
import { SupabasePagoRepository } from "./repositories/supabase/SupabasePagoRepository";
import { SupabasePlanRepository } from "./repositories/supabase/SupabasePlanRepository";
import { SupabaseProductoRepository } from "./repositories/supabase/SupabaseProductoRepository";
import { SupabaseSocioRepository } from "./repositories/supabase/SupabaseSocioRepository";
import { SupabaseSuscripcionRepository } from "./repositories/supabase/SupabaseSuscripcionRepository";
import { SupabaseVentaRepository } from "./repositories/supabase/SupabaseVentaRepository";
import { crearClienteServidor } from "./supabase/clienteServidor";

interface Repositorios {
  socios: SocioRepository;
  planes: PlanRepository;
  suscripciones: SuscripcionRepository;
  pagos: PagoRepository;
  productos: ProductoRepository;
  inventario: InventarioRepository;
  ventas: VentaRepository;
}

type ClienteSupabase = ConstructorParameters<typeof SupabaseSocioRepository>[0];

function repositoriosSupabase(db: ClienteSupabase): Repositorios {
  return {
    socios: new SupabaseSocioRepository(db),
    planes: new SupabasePlanRepository(db),
    suscripciones: new SupabaseSuscripcionRepository(db),
    pagos: new SupabasePagoRepository(db),
    productos: new SupabaseProductoRepository(db),
    inventario: new SupabaseInventarioRepository(db),
    ventas: new SupabaseVentaRepository(db),
  };
}

function repositoriosMemoria(): Repositorios {
  const db = obtenerAlmacen();
  return {
    socios: new MemoriaSocioRepository(db),
    planes: new MemoriaPlanRepository(db),
    suscripciones: new MemoriaSuscripcionRepository(db),
    pagos: new MemoriaPagoRepository(db),
    productos: new MemoriaProductoRepository(db),
    inventario: new MemoriaInventarioRepository(db),
    ventas: new MemoriaVentaRepository(db),
  };
}

const reloj = new RelojSistema(entorno.zonaHoraria);

/** Casos de uso para las pantallas del panel (con la sesión del usuario). */
export async function casosDeUso() {
  const r = modoDemo ? repositoriosMemoria() : repositoriosSupabase(await crearClienteServidor());

  return {
    obtenerResumen: new ObtenerResumen(r.socios, r.suscripciones, r.pagos, r.productos, r.ventas, reloj),
    // Socios
    listarSocios: new ListarSocios(r.socios, r.suscripciones, reloj),
    obtenerDetalleSocio: new ObtenerDetalleSocio(r.socios, r.suscripciones, r.pagos, reloj),
    registrarSocio: new RegistrarSocio(r.socios),
    editarSocio: new EditarSocio(r.socios),
    darDeBajaSocio: new DarDeBajaSocio(r.socios, reloj),
    reactivarSocio: new ReactivarSocio(r.socios),
    // Planes y membresías
    listarPlanes: new ListarPlanes(r.planes),
    crearPlan: new CrearPlan(r.planes),
    cambiarEstadoPlan: new CambiarEstadoPlan(r.planes),
    asignarPlan: new AsignarPlan(r.socios, r.planes, r.suscripciones, r.pagos, reloj),
    // Inventario y ventas
    listarProductos: new ListarProductos(r.productos),
    obtenerDetalleProducto: new ObtenerDetalleProducto(r.productos, r.inventario),
    crearProducto: new CrearProducto(r.productos, r.inventario, reloj),
    editarProducto: new EditarProducto(r.productos),
    cambiarEstadoProducto: new CambiarEstadoProducto(r.productos),
    registrarMovimiento: new RegistrarMovimiento(r.productos, r.inventario, reloj),
    registrarVenta: new RegistrarVenta(r.productos, r.ventas, reloj),
    obtenerCorteDelDia: new ObtenerCorteDelDia(r.ventas, reloj),
    // Avisos por WhatsApp
    obtenerAvisosPendientes: new ObtenerAvisosPendientes(r.socios, r.suscripciones, reloj),
    marcarAvisoEnviado: new MarcarAvisoEnviado(r.suscripciones),
  };
}
