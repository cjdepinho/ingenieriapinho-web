-- ============ Rol de instructor ============
-- Un instructor puede crear/editar las clases (video, calendario) y subir o borrar el material
-- SOLO de los cursos que el administrador le asigne. No ve matrículas, pagos ni contabilidad.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('alumno','admin','instructor'));

create table if not exists public.cursos_instructores (
  curso_id uuid not null references public.cursos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (curso_id, user_id)
);
alter table public.cursos_instructores enable row level security;
drop policy if exists ci_ver on public.cursos_instructores;
create policy ci_ver on public.cursos_instructores for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists ci_admin on public.cursos_instructores;
create policy ci_admin on public.cursos_instructores for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.es_instructor_de(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cursos_instructores ci join public.profiles p on p.id = ci.user_id
    where ci.user_id = auth.uid() and ci.curso_id = p_curso and p.role = 'instructor');
$$;

-- El instructor ve (y descarga) todo el contenido de sus cursos.
create or replace function public.tiene_acceso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.es_instructor_de(p_curso) or exists (
    select 1 from public.matriculas
    where user_id = auth.uid() and curso_id = p_curso and estado in ('activa','completada'));
$$;

drop policy if exists c_instr on public.cursos;
create policy c_instr on public.cursos for select using (public.es_instructor_de(id));
drop policy if exists l_instr on public.lecciones;
create policy l_instr on public.lecciones for all using (public.es_instructor_de(curso_id)) with check (public.es_instructor_de(curso_id));
drop policy if exists m_instr on public.materiales;
create policy m_instr on public.materiales for all using (public.es_instructor_de(curso_id)) with check (public.es_instructor_de(curso_id));

-- Almacén de material: la carpeta de cada archivo es el id del curso.
drop policy if exists mat_subir on storage.objects;
create policy mat_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'materiales' and (public.is_admin() or public.es_instructor_de(((storage.foldername(name))[1])::uuid)));
drop policy if exists mat_borrar on storage.objects;
create policy mat_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'materiales' and (public.is_admin() or public.es_instructor_de(((storage.foldername(name))[1])::uuid)));
