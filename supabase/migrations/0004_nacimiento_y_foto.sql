-- ════════════════════════════════════════════════════════════════════
--  ProyectoGimnasio · Fecha de nacimiento y foto del socio
--  Ya no se pide correo al socio: los avisos van por WhatsApp.
--  Ejecuta este archivo en Supabase > SQL Editor después de 0003.
-- ════════════════════════════════════════════════════════════════════

-- ── Socios: fuera el correo, entran nacimiento y foto ──────────────
drop index if exists public.socios_email_unico;
alter table public.socios drop column if exists email;

alter table public.socios
  add column fecha_nacimiento date,
  -- Ruta del archivo dentro de la carpeta "fotos-socios" de Storage.
  add column foto text;

alter table public.socios
  add constraint socios_nacimiento_valido check (fecha_nacimiento is null or fecha_nacimiento >= date '1900-01-01');

-- ── Carpeta privada para las fotos ─────────────────────────────────
-- Privada: las fotos solo se ven con enlaces temporales que genera la app.
-- Límite de 1 MB por foto (la app las reduce a ~50 KB antes de subirlas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-socios', 'fotos-socios', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "El personal ve fotos de socios" on storage.objects
  for select to authenticated using (bucket_id = 'fotos-socios' and public.es_personal());

create policy "El personal sube fotos de socios" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-socios' and public.es_personal());

create policy "El personal borra fotos de socios" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-socios' and public.es_personal());
