import "server-only";
import { cache } from "react";
/**
 * Contenedor de dependencias (composition root).
 *
 * Es el ÚNICO lugar donde se decide qué implementación concreta usa cada
 * caso de uso. Todo vive en una base local (SQLite) dentro de la computadora;
 * si mañana cambias de base de datos, solo tocas este archivo y la carpeta de
 * infraestructura: el dominio y los casos de uso quedan igual.
 */
import { ListarEntradas, ObtenerEntradasDeHoy } from "@/application/use-cases/asistencias/ListarEntradas";
import { ObtenerRachas, ObtenerSellosDeSocio } from "@/application/use-cases/asistencias/Sellos";
import { ObtenerHabituales } from "@/application/use-cases/asistencias/Habituales";
import {
  BuscarSocioEnMostrador,
  CobrarVisita,
  ConsultarFichaDeEntrada,
  DeshacerEntrada,
  RegistrarEntrada,
} from "@/application/use-cases/asistencias/Mostrador";
import { ConsultarBitacora } from "@/application/use-cases/bitacora/ConsultarBitacora";
import { GuardarFondoDeCaja, ObtenerFondoDeCaja } from "@/application/use-cases/caja/FondoDeCaja";
import type { FondoDeCajaRepository } from "@/domain/repositories/FondoDeCajaRepository";
import type { NominaRepository } from "@/domain/repositories/NominaRepository";
import { AnularPagoNomina, CambiarEstadoEmpleado, ConsultarNomina, GuardarEmpleado, ObtenerAvisoDeNomina, ObtenerNominaDelDia, RegistrarPagoNomina } from "@/application/use-cases/nomina/Nomina";
import { BorrarHuella, IdentificarPorHuella, LeerToque, ListarHuellasDeSocio, RegistrarHuella } from "@/application/use-cases/huellas/Huellas";
import { ObtenerResumen } from "@/application/use-cases/dashboard/ObtenerResumen";
import { ObtenerMetricas } from "@/application/use-cases/metricas/ObtenerMetricas";
import {
  CambiarEstadoProducto,
  CambiarFotoProducto,
  CrearProducto,
  EditarProducto,
  EliminarProducto,
  ListarProductos,
  ObtenerDetalleProducto,
  QuitarFotoProducto,
  RevisarProducto,
} from "@/application/use-cases/inventario/GestionarProductos";
import {
  AltaRapidaDeEquipos,
  CambiarEstadoEquipo,
  CerrarReporte,
  EliminarAbono,
  EliminarEquipo,
  EliminarMantenimiento,
  GuardarEquipo,
  ListarHistorialDeMantenimiento,
  ListarProveedores,
  ObtenerFichaDeEquipo,
  ObtenerMantenimiento,
  ObtenerPorPagar,
  ObtenerResumenDeGastos,
  ObtenerSalidasDelDia,
  ObtenerTableroDeMantenimiento,
  RegistrarAbono,
  RegistrarMantenimiento,
  ReportarFalla,
} from "@/application/use-cases/mantenimiento/Mantenimiento";
import type { MantenimientoRepository } from "@/domain/repositories/MantenimientoRepository";
import { RegistrarMovimiento } from "@/application/use-cases/inventario/RegistrarMovimiento";
import {
  AltaDesdeCatalogo,
  ContarInventario,
  ObtenerListaDeCompra,
  ObtenerPopularidad,
  RecibirMercancia,
} from "@/application/use-cases/inventario/Abasto";
import { CambiarEstadoPlan, CrearPlan, EditarPlan, EliminarPlan, ListarPlanes, ListarPlanesVendidos } from "@/application/use-cases/planes/GestionarPlanes";
import {
  CambiarFotoSocio,
  DarDeBajaSocio,
  EliminarSocioDefinitivo,
  EditarSocio,
  QuitarFotoSocio,
  ReactivarSocio,
} from "@/application/use-cases/socios/GestionarSocio";
import { ListarSocios } from "@/application/use-cases/socios/ListarSocios";
import { ObtenerDetalleSocio } from "@/application/use-cases/socios/ObtenerDetalleSocio";
import { RegistrarSocio } from "@/application/use-cases/socios/RegistrarSocio";
import { RevisarCelular } from "@/application/use-cases/socios/celular";
import { BuscarSociosParecidos, DetectarDuplicados, UnirSocios } from "@/application/use-cases/socios/Duplicados";
import { AsignarPlan, CancelarMembresia, CorregirMembresia, DevolverMembresia } from "@/application/use-cases/suscripciones/AsignarPlan";
import { ObtenerCorteDelDia, RegistrarVenta } from "@/application/use-cases/ventas/Ventas";
import type { AsistenciaRepository } from "@/domain/repositories/AsistenciaRepository";
import type { BitacoraRepository } from "@/domain/repositories/BitacoraRepository";
import type { HuellaRepository } from "@/domain/repositories/HuellaRepository";
import type { InventarioRepository } from "@/domain/repositories/InventarioRepository";
import type { PagoRepository } from "@/domain/repositories/PagoRepository";
import type { PlanRepository } from "@/domain/repositories/PlanRepository";
import type { ProductoRepository } from "@/domain/repositories/ProductoRepository";
import type { SocioRepository } from "@/domain/repositories/SocioRepository";
import type { SuscripcionRepository } from "@/domain/repositories/SuscripcionRepository";
import type { VentaRepository } from "@/domain/repositories/VentaRepository";
import type { AlmacenFotos } from "@/domain/services/AlmacenFotos";
import { redirect } from "next/navigation";
import { obtenerAcceso, permisosExtraDeRecepcion } from "./auth/autenticacion";
import { SinPermiso } from "@/domain/shared/ErrorDeDominio";
import { PERMISOS, type Permiso, puede } from "@/domain/shared/permisos";
import { entorno } from "./config/entorno";
import { AlmacenFotosLocal } from "./sqlite/AlmacenFotosLocal";
import { Sesion } from "./sqlite/baseDeDatos";
import {
  SqliteAsistenciaRepository,
  SqliteBitacoraRepository,
  SqliteInventarioRepository,
  SqlitePagoRepository,
  SqlitePlanRepository,
  SqliteProductoRepository,
  SqliteSocioRepository,
  SqliteSuscripcionRepository,
  SqliteVentaRepository,
} from "./sqlite/repositorios";
import { SqliteMantenimientoRepository } from "./sqlite/mantenimiento";
import { SqliteHuellaRepository } from "./sqlite/huellas";
import { SqliteFondoDeCajaRepository } from "./sqlite/fondosDeCaja";
import { SqliteNominaRepository } from "./sqlite/nomina";
import { MotorFingerJet } from "./huellas/FingerJet";
import { RelojSistema } from "./RelojSistema";

interface Repositorios {
  socios: SocioRepository;
  planes: PlanRepository;
  suscripciones: SuscripcionRepository;
  pagos: PagoRepository;
  productos: ProductoRepository;
  inventario: InventarioRepository;
  ventas: VentaRepository;
  fotos: AlmacenFotos;
  asistencias: AsistenciaRepository;
  bitacora: BitacoraRepository;
  mantenimiento: MantenimientoRepository;
  huellas: HuellaRepository;
  fondos: FondoDeCajaRepository;
  nomina: NominaRepository;
}

/** Repositorios sobre la base local, con el nombre de quien escribe (para la bitácora). */
function repositoriosLocales(usuario: string): Repositorios {
  // Lo del gimnasio no se guarda con la fecha de la computadora equivocada (ver horaReal.ts).
  const s = new Sesion(usuario, true);
  return {
    socios: new SqliteSocioRepository(s),
    planes: new SqlitePlanRepository(s),
    suscripciones: new SqliteSuscripcionRepository(s),
    pagos: new SqlitePagoRepository(s),
    productos: new SqliteProductoRepository(s),
    inventario: new SqliteInventarioRepository(s),
    ventas: new SqliteVentaRepository(s),
    fotos: new AlmacenFotosLocal(),
    asistencias: new SqliteAsistenciaRepository(s),
    bitacora: new SqliteBitacoraRepository(s),
    mantenimiento: new SqliteMantenimientoRepository(s),
    huellas: new SqliteHuellaRepository(s),
    fondos: new SqliteFondoDeCajaRepository(s),
    nomina: new SqliteNominaRepository(s),
  };
}

const reloj = new RelojSistema(entorno.zonaHoraria);
const motorDeHuellas = new MotorFingerJet();

/**
 * Casos de uso para las pantallas del panel (con la sesión del usuario).
 * `cache` hace que el layout y la página de una misma petición compartan
 * los mismos repositorios, así no se piden dos veces los mismos datos.
 */
export const casosDeUso = cache(async () => {
  // Sin sesión no hay acceso a los datos: se regresa a la pantalla de entrada.
  const acceso = await obtenerAcceso();
  if (acceso.tipo !== "autorizado") redirect("/login");
  const { rol } = acceso.personal;
  const extras = permisosExtraDeRecepcion();
  const r = repositoriosLocales(acceso.personal.nombre);

  /**
   * Un caso de uso que solo puede usar cierto perfil. Para los demás se
   * entrega uno que siempre rechaza con un mensaje claro: así ninguna acción
   * ni consulta se salta los permisos, venga de donde venga.
   */
  function soloCon<T extends { ejecutar: (...args: never[]) => Promise<unknown> }>(permiso: Permiso, caso: T): T {
    if (puede(rol, permiso, extras)) return caso;
    return {
      ejecutar: async () => {
        throw new SinPermiso(PERMISOS[permiso]);
      },
    } as unknown as T;
  }

  const listarEntradas = new ListarEntradas(r.asistencias, r.socios, reloj);
  const consultarFichaDeEntrada = new ConsultarFichaDeEntrada(r.socios, r.suscripciones, r.asistencias, r.fotos, r.planes, reloj);
  // Un cobro con fecha de otro día cambia cortes ya cerrados: es una corrección.
  const asignarPlan = new AsignarPlan(r.socios, r.planes, r.suscripciones, reloj, puede(rol, "cobros.otroMonto", extras), puede(rol, "cobros.corregir", extras));
  const registrarEntrada = new RegistrarEntrada(consultarFichaDeEntrada, r.asistencias, reloj);
  const cobrarVisita = new CobrarVisita(consultarFichaDeEntrada, asignarPlan, registrarEntrada, r.suscripciones);

  return {
    obtenerResumen: new ObtenerResumen(r.socios, r.suscripciones, r.pagos, r.productos, r.ventas, reloj),
    // Socios
    listarSocios: new ListarSocios(r.socios, r.suscripciones, reloj),
    obtenerDetalleSocio: new ObtenerDetalleSocio(r.socios, r.suscripciones, r.pagos, r.fotos, reloj),
    registrarSocio: new RegistrarSocio(r.socios, r.planes, asignarPlan, cobrarVisita, reloj, puede(rol, "cobros.otroMonto", extras), puede(rol, "cobros.corregir", extras)),
    revisarCelular: new RevisarCelular(r.socios),
    editarSocio: new EditarSocio(r.socios, reloj),
    cambiarFotoSocio: new CambiarFotoSocio(r.socios, r.fotos),
    quitarFotoSocio: new QuitarFotoSocio(r.socios, r.fotos),
    darDeBajaSocio: soloCon("socios.baja", new DarDeBajaSocio(r.socios, r.suscripciones, reloj)),
    reactivarSocio: soloCon("socios.baja", new ReactivarSocio(r.socios)),
    eliminarSocioDefinitivo: soloCon("socios.eliminar", new EliminarSocioDefinitivo(r.socios, r.fotos)),
    buscarSociosParecidos: new BuscarSociosParecidos(r.socios),
    detectarDuplicados: new DetectarDuplicados(r.socios),
    unirSocios: soloCon("socios.eliminar", new UnirSocios(r.socios, r.fotos)),
    corregirMembresia: soloCon("cobros.corregir", new CorregirMembresia(r.planes, r.suscripciones, reloj)),
    devolverMembresia: soloCon("cobros.corregir", new DevolverMembresia(r.suscripciones, r.pagos, reloj)),
    cancelarMembresia: soloCon("cobros.corregir", new CancelarMembresia(r.suscripciones, reloj)),
    // Planes y membresías
    listarPlanes: new ListarPlanes(r.planes),
    crearPlan: soloCon("planes.gestionar", new CrearPlan(r.planes)),
    cambiarEstadoPlan: soloCon("planes.gestionar", new CambiarEstadoPlan(r.planes)),
    editarPlan: soloCon("planes.gestionar", new EditarPlan(r.planes)),
    eliminarPlan: soloCon("planes.gestionar", new EliminarPlan(r.planes)),
    listarPlanesVendidos: soloCon("planes.gestionar", new ListarPlanesVendidos(r.planes)),
    asignarPlan,
    // Inventario y ventas
    listarProductos: new ListarProductos(r.productos),
    obtenerDetalleProducto: new ObtenerDetalleProducto(r.productos, r.inventario),
    crearProducto: soloCon("inventario.gestionar", new CrearProducto(r.productos, reloj)),
    editarProducto: soloCon("inventario.gestionar", new EditarProducto(r.productos)),
    cambiarEstadoProducto: soloCon("inventario.gestionar", new CambiarEstadoProducto(r.productos)),
    eliminarProducto: soloCon("inventario.gestionar", new EliminarProducto(r.productos, r.fotos)),
    cambiarFotoProducto: soloCon("inventario.gestionar", new CambiarFotoProducto(r.productos, r.fotos)),
    quitarFotoProducto: soloCon("inventario.gestionar", new QuitarFotoProducto(r.productos, r.fotos)),
    revisarProducto: soloCon("inventario.gestionar", new RevisarProducto(r.productos)),
    registrarMovimiento: soloCon("inventario.gestionar", new RegistrarMovimiento(r.productos, r.inventario, reloj)),
    recibirMercancia: soloCon("inventario.gestionar", new RecibirMercancia(r.productos, r.inventario, reloj)),
    contarInventario: soloCon("inventario.gestionar", new ContarInventario(r.productos, r.inventario, reloj)),
    altaDesdeCatalogo: soloCon("inventario.gestionar", new AltaDesdeCatalogo(r.productos, reloj)),
    obtenerListaDeCompra: soloCon("inventario.gestionar", new ObtenerListaDeCompra(r.productos, r.inventario, reloj)),
    obtenerPopularidad: new ObtenerPopularidad(r.inventario, reloj),
    registrarVenta: new RegistrarVenta(r.productos, r.ventas, reloj),
    obtenerCorteDelDia: new ObtenerCorteDelDia(r.ventas, r.pagos, reloj),
    obtenerFondoDeCaja: new ObtenerFondoDeCaja(r.fondos, reloj),
    // Nómina: solo quien tiene el permiso (sueldos). Lo del día sí lo ve el corte de caja de quien lo vea.
    consultarNomina: soloCon("nomina.gestionar", new ConsultarNomina(r.nomina, reloj)),
    guardarEmpleado: soloCon("nomina.gestionar", new GuardarEmpleado(r.nomina)),
    cambiarEstadoEmpleado: soloCon("nomina.gestionar", new CambiarEstadoEmpleado(r.nomina)),
    registrarPagoNomina: soloCon("nomina.gestionar", new RegistrarPagoNomina(r.nomina, reloj)),
    anularPagoNomina: soloCon("nomina.gestionar", new AnularPagoNomina(r.nomina, reloj)),
    obtenerAvisoDeNomina: new ObtenerAvisoDeNomina(r.nomina, reloj),
    obtenerNominaDelDia: new ObtenerNominaDelDia(r.nomina, reloj),
    guardarFondoDeCaja: new GuardarFondoDeCaja(r.fondos, reloj, puede(rol, "cobros.corregir", extras)),
    // Mostrador y asistencias
    buscarSocioEnMostrador: new BuscarSocioEnMostrador(r.socios, r.suscripciones, reloj),
    consultarFichaDeEntrada,
    registrarEntrada,
    cobrarVisita,
    deshacerEntrada: new DeshacerEntrada(r.asistencias, r.suscripciones, r.planes, reloj),
    listarEntradas,
    obtenerEntradasDeHoy: new ObtenerEntradasDeHoy(listarEntradas, reloj),
    obtenerSellosDeSocio: new ObtenerSellosDeSocio(r.asistencias, reloj),
    obtenerRachas: new ObtenerRachas(r.asistencias, r.socios, reloj),
    obtenerHabituales: new ObtenerHabituales(r.asistencias, r.socios, reloj),
    // Huellas: registrar y borrar las hace quien da de alta socios (recepción también); identificar, el mostrador.
    leerToque: new LeerToque(motorDeHuellas),
    registrarHuella: new RegistrarHuella(r.huellas, r.socios, motorDeHuellas),
    identificarPorHuella: new IdentificarPorHuella(r.huellas, motorDeHuellas),
    listarHuellasDeSocio: new ListarHuellasDeSocio(r.huellas),
    borrarHuella: new BorrarHuella(r.huellas),
    // Mantenimiento: el estado de las máquinas y reportar fallas es para todos; costos y pagos, para la administración.
    obtenerTableroDeMantenimiento: new ObtenerTableroDeMantenimiento(r.mantenimiento, reloj),
    obtenerFichaDeEquipo: new ObtenerFichaDeEquipo(r.mantenimiento, reloj),
    reportarFalla: new ReportarFalla(r.mantenimiento),
    obtenerSalidasDelDia: new ObtenerSalidasDelDia(r.mantenimiento, reloj),
    obtenerResumenDeGastos: soloCon("mantenimiento.gestionar", new ObtenerResumenDeGastos(r.mantenimiento, reloj)),
    guardarEquipo: soloCon("mantenimiento.gestionar", new GuardarEquipo(r.mantenimiento, reloj)),
    altaRapidaDeEquipos: soloCon("mantenimiento.gestionar", new AltaRapidaDeEquipos(r.mantenimiento, reloj)),
    cambiarEstadoEquipo: soloCon("mantenimiento.gestionar", new CambiarEstadoEquipo(r.mantenimiento)),
    eliminarEquipo: soloCon("mantenimiento.gestionar", new EliminarEquipo(r.mantenimiento)),
    registrarMantenimiento: soloCon("mantenimiento.gestionar", new RegistrarMantenimiento(r.mantenimiento, reloj)),
    obtenerMantenimiento: soloCon("mantenimiento.gestionar", new ObtenerMantenimiento(r.mantenimiento, reloj)),
    eliminarMantenimiento: soloCon("mantenimiento.gestionar", new EliminarMantenimiento(r.mantenimiento, reloj)),
    registrarAbono: soloCon("mantenimiento.gestionar", new RegistrarAbono(r.mantenimiento, reloj)),
    eliminarAbono: soloCon("mantenimiento.gestionar", new EliminarAbono(r.mantenimiento, reloj)),
    listarHistorialDeMantenimiento: soloCon("mantenimiento.gestionar", new ListarHistorialDeMantenimiento(r.mantenimiento)),
    obtenerPorPagar: soloCon("mantenimiento.gestionar", new ObtenerPorPagar(r.mantenimiento)),
    listarProveedores: soloCon("mantenimiento.gestionar", new ListarProveedores(r.mantenimiento)),
    cerrarReporte: soloCon("mantenimiento.gestionar", new CerrarReporte(r.mantenimiento)),
    // Bitácora y métricas
    consultarBitacora: soloCon("bitacora.ver", new ConsultarBitacora(r.bitacora, reloj)),
    obtenerMetricas: soloCon("metricas.ver", new ObtenerMetricas(r.asistencias, r.socios, r.pagos, r.ventas, r.productos, r.mantenimiento, reloj)),
  };
});
