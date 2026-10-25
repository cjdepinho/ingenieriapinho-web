-- ============ Apertura de clases por fecha ============
-- Cada clase se abre el día de su "fecha de clase" (hora de Lima) y queda abierta para siempre.
-- Sin fecha o con fecha futura: el alumno no ve el video ni el material, ni puede marcar la clase.
-- Un curso sin ninguna clase abierta no está activo, aunque la matrícula esté activa.
-- El administrador y el instructor del curso ven todo siempre. Ejecutar una vez en Supabase > SQL Editor.

create or replace function public.clase_abierta(p_leccion uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lecciones l
    where l.id = p_leccion
      and (public.is_admin() or public.es_instructor_de(l.curso_id)
           or (l.fecha_clase is not null and l.fecha_clase <= (now() at time zone 'America/Lima')::date)));
$$;

create or replace function public.curso_activo(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.es_instructor_de(p_curso) or exists (
    select 1 from public.lecciones l
    where l.curso_id = p_curso and l.fecha_clase is not null
      and l.fecha_clase <= (now() at time zone 'America/Lima')::date);
$$;

-- Clases: el alumno solo recibe las abiertas.
drop policy if exists l_ver on public.lecciones;
create policy l_ver on public.lecciones for select using (public.tiene_acceso(curso_id) and public.clase_abierta(id));

-- Material de una clase: solo si la clase está abierta. Material de todo el curso: solo si el curso está activo.
drop policy if exists m_ver on public.materiales;
create policy m_ver on public.materiales for select using (
  public.tiene_acceso(curso_id)
  and (case when leccion_id is null then public.curso_activo(curso_id) else public.clase_abierta(leccion_id) end));

-- Archivos del almacén: se descargan solo si el material al que pertenecen está abierto.
drop policy if exists mat_descargar on storage.objects;
create policy mat_descargar on storage.objects for select to authenticated
  using (bucket_id = 'materiales' and (
    public.is_admin() or public.es_instructor_de(((storage.foldername(name))[1])::uuid)
    or (public.tiene_acceso(((storage.foldername(name))[1])::uuid) and exists (
          select 1 from public.materiales m
          where m.archivo_path = storage.objects.name
            and (case when m.leccion_id is null then public.curso_activo(m.curso_id) else public.clase_abierta(m.leccion_id) end)))));

-- Avance y tarea completada: solo en clases abiertas.
drop policy if exists av_crear on public.avance;
create policy av_crear on public.avance for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id))
  and public.clase_abierta(leccion_id));
drop policy if exists av_editar on public.avance;
create policy av_editar on public.avance for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.clase_abierta(leccion_id));
drop policy if exists pg_crear on public.progreso;
create policy pg_crear on public.progreso for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id))
  and public.clase_abierta(leccion_id)
  and (public.is_admin() or exists (select 1 from public.avance a where a.user_id = auth.uid() and a.leccion_id = progreso.leccion_id
        and a.video_pct >= 90 and a.descargado)));

-- Cronograma: el alumno ve título y fecha de todas las clases (no el contenido) y si ya están abiertas.
create or replace function public.cronograma(p_curso uuid default null)
returns table (id uuid, curso_id uuid, titulo text, orden int, fecha_clase date, hora_clase text, abierta boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.curso_id, l.titulo, l.orden, l.fecha_clase, l.hora_clase,
         (l.fecha_clase is not null and l.fecha_clase <= (now() at time zone 'America/Lima')::date) as abierta
  from public.lecciones l
  where (p_curso is null or l.curso_id = p_curso) and public.tiene_acceso(l.curso_id)
  order by l.curso_id, l.orden;
$$;
revoke all on function public.cronograma(uuid) from public, anon;
grant execute on function public.cronograma(uuid) to authenticated;
