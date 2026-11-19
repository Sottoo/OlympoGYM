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
  "socios.eliminar": "borrar socios para siempre",
  "cobros.corregir": "corregir un cobro ya registrado ni anotar cobros de otro día",
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

/**
 * Lo que recepción hace siempre, con el estándar. No depende de permisos:
 * es el trabajo del mostrador.
 */
export const BASICOS_RECEPCION = [
  "Registrar entradas en el mostrador",
  "Inscribir socios y editar sus datos",
  "Cobrar membresías y visitas al precio del plan",
  "Vender en la tienda",
  "Consultar el inventario y el corte de su día",
  "Ver las máquinas y reportar fallas",
] as const;

/**
 * Permisos extra que la administración puede darle a recepción, si quiere.
 * El estándar es ninguno. Van agrupados y dichos en positivo; los
 * «delicados» no se pueden deshacer o tocan dinero ya cobrado.
 */
export const PERMISOS_AJUSTABLES: { grupo: string; permisos: { permiso: Permiso; texto: string; delicado?: boolean }[] }[] = [
  {
    grupo: "Socios",
    permisos: [
      { permiso: "socios.baja", texto: "Dar de baja y reactivar socios" },
      { permiso: "socios.eliminar", texto: "Eliminar socios para siempre y unir registros repetidos", delicado: true },
    ],
  },
  {
    grupo: "Cobros",
    permisos: [
      { permiso: "cobros.otroMonto", texto: "Cobrar un monto distinto al precio del plan (descuentos)" },
      { permiso: "cobros.corregir", texto: "Corregir o cancelar cobros ya registrados y anotar cobros de otro día", delicado: true },
    ],
  },
  {
    grupo: "Planes y tienda",
    permisos: [
      { permiso: "planes.gestionar", texto: "Crear, cambiar y eliminar planes", delicado: true },
      { permiso: "inventario.gestionar", texto: "Dar de alta productos, cambiar precios y ajustar existencias" },
    ],
  },
  {
    grupo: "Dinero y reportes",
    permisos: [
      { permiso: "dinero.historial", texto: "Ver los ingresos del mes y cortes de días anteriores" },
      { permiso: "metricas.ver", texto: "Ver las métricas" },
      { permiso: "bitacora.ver", texto: "Ver la bitácora" },
      { permiso: "exportar", texto: "Exportar a Excel" },
    ],
  },
  {
    grupo: "Máquinas",
    permisos: [{ permiso: "mantenimiento.gestionar", texto: "Registrar mantenimientos, pagos a técnicos y ver sus costos" }],
  },
];

/** Nunca se le dan a recepción: administrar cuentas y permisos, y los respaldos (restaurar reemplaza todo). */
export const SOLO_ADMINISTRACION: ReadonlySet<Permiso> = new Set<Permiso>(["personal.gestionar", "respaldos.gestionar"]);

/** El estándar de recepción: ningún permiso extra. */
export const PERMISOS_RECEPCION_ESTANDAR: ReadonlySet<Permiso> = new Set<Permiso>([]);

/** Deja solo permisos que existen y que se le pueden dar a recepción. */
export function limpiarPermisos(lista: readonly string[]): Permiso[] {
  return [...new Set(lista)].filter((p): p is Permiso => Object.hasOwn(PERMISOS, p) && !SOLO_ADMINISTRACION.has(p as Permiso));
}

/**
 * Si un perfil puede hacer algo. Administración, todo. Recepción, lo que la
 * administración le haya dado de extra (por omisión, el estándar: nada).
 */
export function puede(rol: Rol, permiso: Permiso, extrasDeRecepcion: ReadonlySet<Permiso> = PERMISOS_RECEPCION_ESTANDAR): boolean {
  return rol === "administrador" || (extrasDeRecepcion.has(permiso) && !SOLO_ADMINISTRACION.has(permiso));
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
