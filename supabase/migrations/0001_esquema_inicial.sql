-- ════════════════════════════════════════════════════════════════════
--  ProyectoGimnasio · Esquema inicial
--  Ejecuta este archivo completo en Supabase > SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── Personal autorizado ─────────────────────────────────────────────
-- Solo los usuarios registrados en esta tabla pueden usar el panel.
-- Crear una cuenta en Supabase Auth NO basta para ver datos.
create table public.personal (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'recepcion' check (rol in ('administrador', 'recepcion')),
  creado_en  timestamptz not null default now()
);

create or replace function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.personal where usuario_id = auth.uid());
$$;

-- ── Socios ──────────────────────────────────────────────────────────
create table public.socios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(nombre) >= 2),
  apellidos  text not null check (char_length(apellidos) >= 2),
  email      text,
  telefono   text,
  notas      text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  constraint socios_contacto check (email is not null or telefono is not null)
);
create unique index socios_email_unico on public.socios (lower(email)) where email is not null;

-- ── Planes ──────────────────────────────────────────────────────────
create table public.planes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  precio      numeric(10, 2) not null check (precio >= 0),
  duracion    integer not null check (duracion > 0),
  unidad      text not null check (unidad in ('dias', 'semanas', 'meses')),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ── Suscripciones (periodos de membresía) ───────────────────────────
create table public.suscripciones (
  id           uuid primary key default gen_random_uuid(),
  socio_id     uuid not null references public.socios (id) on delete cascade,
  plan_id      uuid not null references public.planes (id),
  fecha_inicio date not null,
  fecha_fin    date not null,
  creado_en    timestamptz not null default now(),
  constraint suscripciones_fechas check (fecha_fin >= fecha_inicio)
);
create index suscripciones_socio_idx on public.suscripciones (socio_id, fecha_fin desc);
create index suscripciones_fin_idx on public.suscripciones (fecha_fin);

-- ── Pagos (registrados en mostrador) ────────────────────────────────
create table public.pagos (
  id             uuid primary key default gen_random_uuid(),
  socio_id       uuid not null references public.socios (id) on delete cascade,
  suscripcion_id uuid references public.suscripciones (id) on delete set null,
  monto          numeric(10, 2) not null check (monto >= 0),
  metodo         text not null check (metodo in ('efectivo', 'transferencia', 'tarjeta')),
  fecha          date not null default current_date,
  nota           text,
  registrado_por uuid default auth.uid() references auth.users (id),
  creado_en      timestamptz not null default now()
);
create index pagos_fecha_idx on public.pagos (fecha);
create index pagos_socio_idx on public.pagos (socio_id);

-- ── Registro de avisos enviados (evita duplicados) ──────────────────
create table public.avisos_enviados (
  suscripcion_id uuid not null references public.suscripciones (id) on delete cascade,
  dias_antes     integer not null,
  canal          text not null,
  enviado_en     timestamptz not null default now(),
  primary key (suscripcion_id, dias_antes)
);

-- ── Vista: la suscripción más reciente de cada socio ────────────────
-- security_invoker hace que la vista respete las políticas RLS.
create view public.ultima_suscripcion_por_socio
with (security_invoker = true) as
select distinct on (s.socio_id)
  s.id, s.socio_id, s.plan_id, s.fecha_inicio, s.fecha_fin, s.creado_en,
  p.nombre as plan_nombre
from public.suscripciones s
join public.planes p on p.id = s.plan_id
order by s.socio_id, s.fecha_fin desc, s.creado_en desc;

-- ── Función: suscripciones que necesitan aviso ──────────────────────
create or replace function public.suscripciones_pendientes_de_aviso(p_fecha_fin date, p_dias_antes integer)
returns table (
  id uuid, socio_id uuid, plan_id uuid, fecha_inicio date, fecha_fin date,
  creado_en timestamptz, plan_nombre text
)
language sql
stable
set search_path = ''
as $$
  select s.id, s.socio_id, s.plan_id, s.fecha_inicio, s.fecha_fin, s.creado_en, p.nombre
  from public.suscripciones s
  join public.planes p on p.id = s.plan_id
  where s.fecha_fin = p_fecha_fin
    and not exists (
      select 1 from public.avisos_enviados a
      where a.suscripcion_id = s.id and a.dias_antes = p_dias_antes
    );
$$;

-- ════════════════════════════════════════════════════════════════════
--  Seguridad: Row Level Security (RLS)
--  Sin estas políticas, cualquiera con la URL podría leer los datos.
-- ════════════════════════════════════════════════════════════════════
alter table public.personal        enable row level security;
alter table public.socios          enable row level security;
alter table public.planes          enable row level security;
alter table public.suscripciones   enable row level security;
alter table public.pagos           enable row level security;
alter table public.avisos_enviados enable row level security;

create policy "El personal ve su propio registro" on public.personal
  for select to authenticated using (usuario_id = auth.uid());

create policy "El personal gestiona socios" on public.socios
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal gestiona planes" on public.planes
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal gestiona suscripciones" on public.suscripciones
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal gestiona pagos" on public.pagos
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

create policy "El personal consulta avisos" on public.avisos_enviados
  for select to authenticated using (public.es_personal());
-- Los avisos solo los escribe la tarea programada (service_role, que ignora RLS).

revoke execute on function public.suscripciones_pendientes_de_aviso(date, integer) from public, anon;
grant execute on function public.suscripciones_pendientes_de_aviso(date, integer) to authenticated, service_role;
