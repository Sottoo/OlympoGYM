/**
 * Perfiles del personal y lo que cada uno puede hacer.
 *
 * Hay dos perfiles:
 *  · Administración: todo.
 *  · Recepción: el día a día del mostrador. Registra entradas, da de alta y
 *    edita socios, cobra membresías al precio del plan, cobra visitas, vende
 *    en la tienda. Consulta el inventario y el corte de su día,
 *    pero no cambia precios ni planes, no da de baja socios y no ve el dinero
 *    del mes, las métricas, la bitácora ni los respaldos. En Mantenimiento
 *    ve qué máquinas funcionan y reporta fallas, pero no ve costos.
 *
 * Esta tabla es la única fuente de verdad: la usan el menú (para no mostrar lo
 * que no se puede abrir), las pantallas (para no mostrar botones que no
 * funcionarían) y, sobre todo, el servidor, que rechaza cualquier acción sin
 * permiso aunque alguien llegue a ella por otro camino.
 */
export type Rol = "administrador" | "recepcion";

export const ROLES: Record<Rol, { nombre: string; descripcion: string }> = {
  administrador: { nombre: "Administración", descripcion: "Acceso a todo, incluidas cuentas, planes, dinero y respaldos." },
  recepcion: { nombre: "Recepción", descripcion: "Entradas, socios, cobros al precio del plan y tienda." },
};

export const PERMISOS = {
  "socios.baja": "dar de baja ni reactivar socios",
  "cobros.otroMonto": "cobrar un monto distinto al precio del plan",
  "planes.gestionar": "crear ni cambiar planes",
  "inventario.gestionar": "dar de alta productos, cambiar precios ni ajustar existencias",
  "dinero.historial": "ver los ingresos del mes ni cortes de días anteriores",
  "metricas.ver": "ver las métricas",
  "bitacora.ver": "ver la bitácora",
  "respaldos.gestionar": "hacer ni restaurar respaldos",
  "exportar": "exportar a Excel",
  "personal.gestionar": "administrar las cuentas del personal",
  "mantenimiento.gestionar": "registrar mantenimientos, pagos a técnicos ni ver sus costos",
} as const;

export type Permiso = keyof typeof PERMISOS;

/** Lo que recepción sí puede hacer de la lista anterior (hoy, nada de ella). */
const PERMISOS_RECEPCION: ReadonlySet<Permiso> = new Set<Permiso>([]);

export function puede(rol: Rol, permiso: Permiso): boolean {
  return rol === "administrador" || PERMISOS_RECEPCION.has(permiso);
}

/** Secciones del panel que requieren un permiso para abrirse. */
export const PERMISO_DE_SECCION: Partial<Record<string, Permiso>> = {
  "/planes": "planes.gestionar",
  "/metricas": "metricas.ver",
  "/bitacora": "bitacora.ver",
  "/respaldos": "respaldos.gestionar",
  "/personal": "personal.gestionar",
  "/inventario/nuevo": "inventario.gestionar",
};
