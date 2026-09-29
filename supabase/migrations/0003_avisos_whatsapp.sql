-- ════════════════════════════════════════════════════════════════════
--  ProyectoGimnasio · Avisos por WhatsApp desde la app de escritorio
--  Ya no hay tarea programada ni correos: recepción ve la lista de
--  avisos pendientes y los manda a mano por WhatsApp.
--  Ejecuta este archivo en Supabase > SQL Editor después de 0002.
-- ════════════════════════════════════════════════════════════════════

-- El personal registra los avisos que manda (antes solo lo hacía el cron con service_role).
create policy "El personal registra avisos" on public.avisos_enviados
  for insert to authenticated with check (public.es_personal());

create policy "El personal corrige avisos" on public.avisos_enviados
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

alter table public.avisos_enviados
  add constraint avisos_dias_validos check (dias_antes in (7, 3, 1));

-- La búsqueda de pendientes ahora la hace la app.
drop function if exists public.suscripciones_pendientes_de_aviso(date, integer);

-- Todo socio necesita celular: es el único canal de avisos.
alter table public.socios drop constraint socios_contacto;
alter table public.socios add constraint socios_celular check (telefono is not null);
