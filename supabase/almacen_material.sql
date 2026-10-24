-- Almacén privado del material de los cursos (PDF, PowerPoint, Word, Excel...).
-- Ejecuta este bloque una sola vez en el SQL Editor de Supabase.
alter table public.materiales alter column url drop not null;
alter table public.materiales add column if not exists archivo_path text;
alter table public.materiales add column if not exists archivo_nombre text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('materiales', 'materiales', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- El nombre de cada archivo empieza con el id del curso: <curso_id>/<archivo>
drop policy if exists mat_descargar on storage.objects;
create policy mat_descargar on storage.objects for select to authenticated
  using (bucket_id = 'materiales' and (public.is_admin() or public.tiene_acceso(((storage.foldername(name))[1])::uuid)));
drop policy if exists mat_subir on storage.objects;
create policy mat_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'materiales' and public.is_admin());
drop policy if exists mat_borrar on storage.objects;
create policy mat_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'materiales' and public.is_admin());
