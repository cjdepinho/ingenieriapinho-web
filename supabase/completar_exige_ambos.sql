-- ============ Una clase se completa solo con las dos cosas ============
-- Video visto al 90 % o más Y todo el material descargado. Si la clase aún no tiene video publicado
-- o no tiene material, no se puede completar: el alumno espera a que se publiquen.
-- Ejecutar una vez en Supabase > SQL Editor (después de apertura_por_fecha.sql).

create or replace function public.clase_completable(p_leccion uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lecciones l where l.id = p_leccion and coalesce(btrim(l.video_url), '') <> '')
     and exists (select 1 from public.materiales m where m.leccion_id = p_leccion
                 and (coalesce(m.archivo_path, '') <> '' or coalesce(m.url, '') <> ''));
$$;

drop policy if exists pg_crear on public.progreso;
create policy pg_crear on public.progreso for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id))
  and public.clase_abierta(leccion_id)
  and (public.is_admin() or (
        public.clase_completable(leccion_id)
        and exists (select 1 from public.avance a where a.user_id = auth.uid() and a.leccion_id = progreso.leccion_id
                    and a.video_pct >= 90 and a.descargado))));
