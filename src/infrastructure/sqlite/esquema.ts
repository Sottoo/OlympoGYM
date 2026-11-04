/**
 * Estructura de la base de datos local (SQLite) y sus versiones.
 *
 * Cada migración se aplica una sola vez; `PRAGMA user_version` guarda cuál
 * fue la última. Para cambiar la estructura en el futuro se AGREGA una
 * migración al final: nunca se edita una que ya se aplicó en un gimnasio.
 *
 * La base nace vacía: planes, productos y cuentas los da de alta el gimnasio.
 */

const AHORA = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

/** Columnas que la bitácora guarda de cada tabla (nunca contraseñas). */
const COLUMNAS_BITACORA: Record<string, string[]> = {
  socios: ["id", "numero", "nombre", "apellidos", "telefono", "fecha_nacimiento", "foto", "notas", "activo", "fecha_baja", "motivo_baja"],
  planes: ["id", "nombre", "descripcion", "precio", "duracion", "unidad", "activo"],
  suscripciones: ["id", "socio_id", "plan_id", "fecha_inicio", "fecha_fin"],
  pagos: ["id", "socio_id", "suscripcion_id", "monto", "metodo", "fecha", "nota"],
  productos: ["id", "nombre", "categoria", "codigo", "precio_venta", "costo", "stock", "stock_minimo", "activo"],
  ventas: ["id", "fecha", "metodo", "total", "nota"],
  movimientos_inventario: ["id", "producto_id", "tipo", "cantidad", "venta_id", "precio_unitario", "nota", "fecha"],
  asistencias: ["id", "socio_id", "fecha", "registrada_en", "excepcion"],
  personal: ["id", "nombre", "usuario", "rol", "activo"],
  equipos: ["id", "nombre", "area", "marca", "modelo", "numero_serie", "frecuencia_meses", "activo"],
  mantenimientos: ["id", "equipo_id", "fecha", "tipo", "descripcion", "proveedor", "mano_de_obra", "refacciones", "total"],
  abonos_mantenimiento: ["id", "mantenimiento_id", "monto", "metodo", "fecha", "nota"],
  reportes_falla: ["id", "equipo_id", "descripcion", "fuera_de_servicio", "reportado_por", "atendido_en", "cierre"],
};

const json = (fila: "new" | "old", columnas: string[]) => `json_object(${columnas.map((c) => `'${c}', ${fila}.${c}`).join(", ")})`;

function disparador(tabla: string, operacion: "alta" | "cambio" | "eliminacion", cuando = "", columnas = COLUMNAS_BITACORA[tabla]): string {
  const evento = { alta: "insert", cambio: "update", eliminacion: "delete" }[operacion];
  const fila = operacion === "eliminacion" ? "old" : "new";
  return `
    create trigger bitacora_${tabla}_${operacion} after ${evento} on ${tabla} ${cuando ? `when ${cuando}` : ""}
    begin
      insert into bitacora (usuario_nombre, tabla, operacion, registro_id, antes, despues)
      values (
        (select usuario from contexto where id = 1), '${tabla}', '${operacion}', ${fila}.id,
        ${operacion === "alta" ? "null" : json("old", columnas)},
        ${operacion === "eliminacion" ? "null" : json("new", columnas)}
      );
    end;`;
}

/** Un cambio de producto que solo mueve el stock ya queda en su movimiento de inventario: no se repite. */
const soloCambioDeStock = `not (old.stock is not new.stock
  and old.nombre is new.nombre and old.categoria is new.categoria and old.codigo is new.codigo
  and old.precio_venta is new.precio_venta and old.costo is new.costo
  and old.stock_minimo is new.stock_minimo and old.activo is new.activo)`;

const inicial = `
  -- ── Personal y ajustes ──────────────────────────────────────────────
  create table personal (
    id          text primary key,
    nombre      text not null,
    usuario     text not null unique collate nocase,
    contrasena  text not null,
    rol         text not null default 'administrador' check (rol in ('administrador', 'recepcion')),
    activo      integer not null default 1,
    creado_en   text not null default ${AHORA}
  );

  create table ajustes (clave text primary key, valor text not null);

  -- Quién está escribiendo en este momento: lo leen los triggers de la bitácora.
  create table contexto (id integer primary key check (id = 1), usuario text);
  insert into contexto (id, usuario) values (1, null);

  -- ── Socios ──────────────────────────────────────────────────────────
  create table socios (
    id               text primary key,
    numero           integer not null unique,
    nombre           text not null check (length(nombre) >= 2),
    apellidos        text not null check (length(apellidos) >= 2),
    telefono         text not null,
    fecha_nacimiento text check (fecha_nacimiento is null or fecha_nacimiento >= '1900-01-01'),
    foto             text,
    notas            text,
    activo           integer not null default 1,
    fecha_baja       text,
    motivo_baja      text,
    creado_en        text not null default ${AHORA}
  );
  create index socios_nombre on socios (nombre);

  -- ── Planes y membresías ─────────────────────────────────────────────
  create table planes (
    id          text primary key,
    nombre      text not null,
    descripcion text,
    precio      real not null check (precio >= 0),
    duracion    integer not null check (duracion > 0),
    unidad      text not null check (unidad in ('dias', 'semanas', 'meses')),
    activo      integer not null default 1,
    creado_en   text not null default ${AHORA}
  );

  create table suscripciones (
    id           text primary key,
    socio_id     text not null references socios (id) on delete cascade,
    plan_id      text not null references planes (id),
    fecha_inicio text not null,
    fecha_fin    text not null check (fecha_fin >= fecha_inicio),
    creado_en    text not null default ${AHORA}
  );
  create index suscripciones_socio on suscripciones (socio_id, fecha_fin desc, creado_en desc);
  create index suscripciones_fin on suscripciones (fecha_fin);

  create table pagos (
    id             text primary key,
    socio_id       text not null references socios (id) on delete cascade,
    suscripcion_id text references suscripciones (id) on delete set null,
    monto          real not null check (monto >= 0),
    metodo         text not null check (metodo in ('efectivo', 'transferencia', 'tarjeta')),
    fecha          text not null,
    nota           text,
    creado_en      text not null default ${AHORA}
  );
  create index pagos_fecha on pagos (fecha);
  create index pagos_socio on pagos (socio_id);

  create table avisos_enviados (
    suscripcion_id text not null references suscripciones (id) on delete cascade,
    dias_antes     integer not null check (dias_antes in (7, 3, 1)),
    canal          text not null,
    enviado_en     text not null default ${AHORA},
    primary key (suscripcion_id, dias_antes)
  );

  -- ── Tienda e inventario ─────────────────────────────────────────────
  create table productos (
    id           text primary key,
    nombre       text not null check (length(nombre) >= 2),
    categoria    text not null check (categoria in ('suplementos', 'bebidas', 'snacks', 'accesorios', 'ropa', 'otros')),
    codigo       text,
    precio_venta real not null check (precio_venta >= 0),
    costo        real check (costo >= 0),
    -- El stock solo cambia con movimientos; nunca queda negativo.
    stock        integer not null default 0 check (stock >= 0),
    stock_minimo integer not null default 0 check (stock_minimo >= 0),
    activo       integer not null default 1,
    creado_en    text not null default ${AHORA}
  );
  create unique index productos_codigo on productos (lower(codigo)) where codigo is not null;

  create table ventas (
    id        text primary key,
    fecha     text not null,
    metodo    text not null check (metodo in ('efectivo', 'transferencia', 'tarjeta')),
    total     real not null check (total >= 0),
    nota      text,
    creado_en text not null default ${AHORA}
  );
  create index ventas_fecha on ventas (fecha);

  create table movimientos_inventario (
    id              text primary key,
    producto_id     text not null references productos (id) on delete cascade,
    tipo            text not null check (tipo in ('entrada', 'venta', 'merma', 'ajuste')),
    cantidad        integer not null check (cantidad <> 0),
    venta_id        text references ventas (id) on delete cascade,
    precio_unitario real,
    nota            text,
    fecha           text not null,
    creado_en       text not null default ${AHORA},
    check ((tipo = 'entrada' and cantidad > 0) or (tipo in ('venta', 'merma') and cantidad < 0) or tipo = 'ajuste'),
    check ((tipo = 'venta') = (venta_id is not null))
  );
  create index movimientos_producto on movimientos_inventario (producto_id, fecha desc, creado_en desc);
  create index movimientos_venta on movimientos_inventario (venta_id);

  -- ── Asistencias ─────────────────────────────────────────────────────
  create table asistencias (
    id            text primary key,
    socio_id      text not null references socios (id) on delete cascade,
    fecha         text not null,
    registrada_en text not null default ${AHORA},
    excepcion     text
  );
  create index asistencias_fecha on asistencias (fecha);
  create index asistencias_socio on asistencias (socio_id, registrada_en desc);

  -- ── Bitácora: quién hizo qué y cuándo ───────────────────────────────
  -- La llenan triggers; nadie la puede modificar ni borrar.
  create table bitacora (
    id             integer primary key autoincrement,
    ocurrido_en    text not null default ${AHORA},
    usuario_nombre text,
    tabla          text not null,
    operacion      text not null check (operacion in ('alta', 'cambio', 'eliminacion')),
    registro_id    text,
    antes          text,
    despues        text
  );
  create index bitacora_fecha on bitacora (ocurrido_en desc);

  create trigger bitacora_no_se_edita before update on bitacora
  begin select raise(abort, 'La bitácora no se puede modificar.'); end;
  create trigger bitacora_no_se_borra before delete on bitacora
  begin select raise(abort, 'La bitácora no se puede borrar.'); end;

  ${["socios", "planes", "suscripciones", "pagos", "ventas", "movimientos_inventario", "personal"]
    .map((t) => disparador(t, "alta") + disparador(t, "cambio") + disparador(t, "eliminacion"))
    .join("\n")}
  ${disparador("productos", "alta")}
  ${disparador("productos", "cambio", soloCambioDeStock)}
  ${disparador("productos", "eliminacion")}
  -- Las asistencias ya son un registro: en la bitácora solo quedan las que se deshacen.
  ${disparador("asistencias", "eliminacion")}
`;

/**
 * v2: los recordatorios por WhatsApp a 7, 3 y 1 día no se usan; su tabla se
 * retira. (Antes de aplicarla, el programa guarda un respaldo automático.)
 */
const sinRecordatorios = /* sql */ `
  drop table if exists avisos_enviados;
`;

/**
 * v3: venta a granel. Un producto puede contarse en gramos (proteína por
 * scoop, creatina por servicio): se guarda cuánto pesa una porción y cuánto
 * trae cada envase del proveedor. Los productos existentes siguen por pieza.
 */
const ventaAGranel = /* sql */ `
  alter table productos add column unidad text not null default 'pieza' check (unidad in ('pieza', 'gramo'));
  alter table productos add column porcion_gramos integer check (porcion_gramos > 0);
  alter table productos add column porcion_nombre text;
  alter table productos add column envase_gramos integer check (envase_gramos > 0);
  -- Para la lista de compra y los más vendidos: las ventas de cada producto por fecha.
  create index if not exists movimientos_tipo_fecha on movimientos_inventario (tipo, fecha);
`;

/**
 * v4: mantenimiento de máquinas. Equipos, lo que se les hace y cuánto
 * costó, lo que se le ha pagado al técnico (completo, anticipo o a deber) y
 * los reportes de falla que hace recepción. Todo queda en la bitácora.
 */
const mantenimiento = /* sql */ `
  create table equipos (
    id               text primary key,
    nombre           text not null,
    area             text not null check (area in ('cardio', 'fuerza', 'peso_libre', 'instalaciones', 'otro')),
    marca            text,
    modelo           text,
    numero_serie     text,
    fecha_compra     text,
    frecuencia_meses integer check (frecuencia_meses between 1 and 24),
    servicio_base    text,
    nota             text,
    activo           integer not null default 1,
    creado_en        text not null default ${AHORA}
  );

  create table mantenimientos (
    id           text primary key,
    equipo_id    text not null references equipos (id),
    fecha        text not null,
    tipo         text not null check (tipo in ('preventivo', 'correctivo')),
    descripcion  text not null,
    proveedor    text,
    mano_de_obra real not null default 0 check (mano_de_obra >= 0),
    refacciones  real not null default 0 check (refacciones >= 0),
    total        real not null default 0 check (total >= 0),
    nota         text,
    creado_en    text not null default ${AHORA}
  );
  create index mantenimientos_equipo on mantenimientos (equipo_id, fecha desc);
  create index mantenimientos_fecha on mantenimientos (fecha);

  create table abonos_mantenimiento (
    id               text primary key,
    mantenimiento_id text not null references mantenimientos (id) on delete cascade,
    monto            real not null check (monto > 0),
    metodo           text not null check (metodo in ('efectivo', 'transferencia')),
    fecha            text not null,
    nota             text,
    creado_en        text not null default ${AHORA}
  );
  create index abonos_mantenimiento_fecha on abonos_mantenimiento (fecha);
  create index abonos_mantenimiento_de on abonos_mantenimiento (mantenimiento_id);

  create table reportes_falla (
    id                text primary key,
    equipo_id         text not null references equipos (id),
    descripcion       text not null,
    fuera_de_servicio integer not null default 0,
    reportado_por     text,
    reportado_en      text not null default ${AHORA},
    atendido_en       text,
    mantenimiento_id  text references mantenimientos (id) on delete set null,
    cierre            text
  );
  create index reportes_falla_abiertos on reportes_falla (atendido_en, equipo_id);

  ${["equipos", "mantenimientos", "abonos_mantenimiento", "reportes_falla"]
    .map((t) => disparador(t, "alta") + disparador(t, "cambio") + disparador(t, "eliminacion"))
    .join("\n")}
`;

/**
 * v5: foto de producto. Cada producto puede llevar su foto (se ve en la
 * Tienda y en el inventario); si no tiene, se dibuja su parche bordado. La
 * bitácora de productos se vuelve a crear para que anote también la foto.
 */
const columnasProductoConFoto = [...COLUMNAS_BITACORA.productos, "foto"];
const fotoDeProducto = /* sql */ `
  alter table productos add column foto text;
  drop trigger if exists bitacora_productos_alta;
  drop trigger if exists bitacora_productos_cambio;
  drop trigger if exists bitacora_productos_eliminacion;
  ${disparador("productos", "alta", "", columnasProductoConFoto)}
  ${disparador("productos", "cambio", soloCambioDeStock.replace(/\)$/, " and old.foto is new.foto)"), columnasProductoConFoto)}
  ${disparador("productos", "eliminacion", "", columnasProductoConFoto)}
`;

/** Migraciones en orden. La posición + 1 es la versión que queda en `user_version`. */
export const MIGRACIONES: string[] = [inicial, sinRecordatorios, ventaAGranel, mantenimiento, fotoDeProducto];
