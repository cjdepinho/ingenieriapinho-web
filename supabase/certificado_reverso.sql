-- ============ Reverso del certificado: temario y nota del alumno ============
-- Cada certificado guarda el temario del curso (tal como estaba al emitirlo) y la nota con que aprobó.
-- Los certificados nuevos los completan solos: temario desde el curso y nota desde la mejor evaluación aprobada.
-- Ejecutar una vez en Supabase > SQL Editor.

alter table public.certificados add column if not exists nota numeric;
alter table public.certificados add column if not exists temario text[] not null default '{}';

create or replace function public.certificado_completar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.temario is null or cardinality(new.temario) = 0 then
    select cu.temario into new.temario from public.cursos cu where cu.id = new.curso_id;
  end if;
  if new.nota is null then
    select max(i.nota) into new.nota from public.intentos i
    where i.user_id = new.user_id and i.curso_id = new.curso_id and i.aprobado;
  end if;
  return new;
end $$;
drop trigger if exists certificado_completar_t on public.certificados;
create trigger certificado_completar_t before insert on public.certificados
  for each row execute function public.certificado_completar();

-- Certificados ya emitidos: se completan con el temario actual del curso y su mejor nota aprobada.
update public.certificados c set temario = cu.temario
  from public.cursos cu where cu.id = c.curso_id and cardinality(c.temario) = 0;
update public.certificados c set nota = (
  select max(i.nota) from public.intentos i where i.user_id = c.user_id and i.curso_id = c.curso_id and i.aprobado)
  where c.nota is null;

-- Verificación pública: ahora también devuelve el temario y la nota.
drop function if exists public.verificar_certificado(text);
create function public.verificar_certificado(p_codigo text)
returns table (codigo text, alumno_nombre text, curso_titulo text, horas numeric, fecha_emision date, revocado boolean,
               nota numeric, temario text[])
language sql stable security definer set search_path = public as $$
  select c.codigo, c.alumno_nombre, c.curso_titulo, c.horas, c.fecha_emision, c.revocado, c.nota, c.temario
  from public.certificados c where upper(c.codigo) = upper(trim(p_codigo)) limit 1;
$$;
grant execute on function public.verificar_certificado(text) to anon, authenticated;
