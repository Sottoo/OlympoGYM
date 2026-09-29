-- ════════════════════════════════════════════════════════════════════
--  Olimpo GYM · Bajas de socios, inventario y ventas de mostrador
--  Ejecuta este archivo completo en Supabase > SQL Editor,
--  DESPUÉS de 0001_esquema_inicial.sql.
-- ════════════════════════════════════════════════════════════════════

-- ── Bajas de socios ─────────────────────────────────────────────────
-- Dar de baja no borra al socio: conserva su historial y deja de
-- contar como activo (la columna "activo" ya existía).
alter table public.socios
  add column fecha_baja  date,
  add column motivo_baja text;

-- ── Productos ───────────────────────────────────────────────────────
create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (char_length(nombre) >= 2),
  categoria    text not null check (categoria in ('suplementos', 'bebidas', 'snacks', 'accesorios', 'ropa', 'otros')),
  codigo       text,
  precio_venta numeric(10, 2) not null check (precio_venta >= 0),
  costo        numeric(10, 2) check (costo >= 0),
  -- El stock SOLO cambia con las funciones de abajo; nunca queda negativo.
  stock        integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create unique index productos_codigo_unico on public.productos (lower(codigo)) where codigo is not null;

-- ── Ventas de mostrador ─────────────────────────────────────────────
create table public.ventas (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  metodo         text not null check (metodo in ('efectivo', 'transferencia', 'tarjeta')),
  total          numeric(10, 2) not null check (total >= 0),
  nota           text,
  registrado_por uuid default auth.uid() references auth.users (id),
  creado_en      timestamptz not null default now()
);
create index ventas_fecha_idx on public.ventas (fecha);

-- ── Movimientos de inventario (historial de cada cambio de stock) ───
create table public.movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos (id) on delete cascade,
  tipo            text not null check (tipo in ('entrada', 'venta', 'merma', 'ajuste')),
  cantidad        integer not null check (cantidad <> 0),
  venta_id        uuid references public.ventas (id) on delete cascade,
  precio_unitario numeric(10, 2),
  nota            text,
  fecha           date not null,
  registrado_por  uuid default auth.uid() references auth.users (id),
  creado_en       timestamptz not null default now(),
  constraint movimientos_signo check (
    (tipo = 'entrada' and cantidad > 0)
    or (tipo in ('venta', 'merma') and cantidad < 0)
    or tipo = 'ajuste'
  ),
  constraint movimientos_venta check ((tipo = 'venta') = (venta_id is not null))
);
create index movimientos_producto_idx on public.movimientos_inventario (producto_id, fecha desc, creado_en desc);
create index movimientos_venta_idx on public.movimientos_inventario (venta_id);

-- ── Función: entrada, merma o ajuste (atómica) ──────────────────────
-- Los errores con código GY… son reglas de negocio: la app los muestra tal cual.
create or replace function public.registrar_movimiento_inventario(
  p_producto_id uuid, p_tipo text, p_cantidad integer, p_nota text, p_fecha date
)
returns public.movimientos_inventario
language plpgsql
set search_path = ''
as $$
declare
  v_nombre     text;
  v_movimiento public.movimientos_inventario;
begin
  if p_tipo not in ('entrada', 'merma', 'ajuste') then
    raise exception 'Tipo de movimiento no válido.' using errcode = 'GY002';
  end if;

  update public.productos
     set stock = stock + p_cantidad
   where id = p_producto_id and stock + p_cantidad >= 0
  returning nombre into v_nombre;

  if not found then
    select nombre into v_nombre from public.productos where id = p_producto_id;
    if v_nombre is null then
      raise exception 'El producto no existe o fue eliminado.' using errcode = 'GY404';
    end if;
    raise exception 'No hay suficiente stock de %.', v_nombre using errcode = 'GY001';
  end if;

  insert into public.movimientos_inventario (producto_id, tipo, cantidad, nota, fecha)
  values (p_producto_id, p_tipo, p_cantidad, p_nota, p_fecha)
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

-- ── Función: venta con uno o varios productos (atómica) ─────────────
-- p_partidas: [{"producto_id": "...", "cantidad": 2}, ...]
-- El precio se toma del producto en ese momento. Si un producto no
-- alcanza, se cancela TODA la venta y ningún stock cambia.
create or replace function public.registrar_venta(
  p_fecha date, p_metodo text, p_nota text, p_partidas jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_venta_id uuid;
  v_partida  jsonb;
  v_cantidad integer;
  v_producto public.productos;
  v_total    numeric(10, 2) := 0;
begin
  if p_partidas is null or jsonb_array_length(p_partidas) = 0 then
    raise exception 'Agrega al menos un producto a la venta.' using errcode = 'GY002';
  end if;

  insert into public.ventas (fecha, metodo, total, nota)
  values (p_fecha, p_metodo, 0, p_nota)
  returning id into v_venta_id;

  for v_partida in select * from jsonb_array_elements(p_partidas) loop
    v_cantidad := (v_partida ->> 'cantidad')::integer;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Las cantidades deben ser mayores a cero.' using errcode = 'GY002';
    end if;

    update public.productos
       set stock = stock - v_cantidad
     where id = (v_partida ->> 'producto_id')::uuid and activo and stock >= v_cantidad
    returning * into v_producto;

    if not found then
      select * into v_producto from public.productos where id = (v_partida ->> 'producto_id')::uuid;
      if not found then
        raise exception 'Uno de los productos ya no existe.' using errcode = 'GY404';
      elsif not v_producto.activo then
        raise exception '% está desactivado.', v_producto.nombre using errcode = 'GY003';
      end if;
      raise exception 'No hay suficiente stock de % (quedan %).', v_producto.nombre, v_producto.stock using errcode = 'GY001';
    end if;

    insert into public.movimientos_inventario (producto_id, tipo, cantidad, venta_id, precio_unitario, fecha)
    values (v_producto.id, 'venta', -v_cantidad, v_venta_id, v_producto.precio_venta, p_fecha);

    v_total := v_total + v_cantidad * v_producto.precio_venta;
  end loop;

  update public.ventas set total = v_total where id = v_venta_id;
  return v_venta_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
--  Seguridad: RLS en las tablas nuevas (solo personal registrado)
-- ════════════════════════════════════════════════════════════════════
alter table public.productos              enable row level security;
alter table public.ventas                 enable row level security;
alter table public.movimientos_inventario enable row level security;

create policy "El personal gestiona productos" on public.productos
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal gestiona ventas" on public.ventas
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal gestiona movimientos" on public.movimientos_inventario
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

-- Las funciones corren con los permisos de quien las llama (RLS aplica).
revoke execute on function public.registrar_movimiento_inventario(uuid, text, integer, text, date) from public, anon;
revoke execute on function public.registrar_venta(date, text, text, jsonb) from public, anon;
grant execute on function public.registrar_movimiento_inventario(uuid, text, integer, text, date) to authenticated;
grant execute on function public.registrar_venta(date, text, text, jsonb) to authenticated;
