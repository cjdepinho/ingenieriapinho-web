-- Material por clase: cada archivo puede pertenecer a una clase (leccion) o a todo el curso.
-- Ejecutar una vez en Supabase > SQL Editor.
alter table public.materiales add column if not exists leccion_id uuid references public.lecciones(id) on delete set null;

-- Asigna cada presentación del curso "IA para Civil 3D con Claude" a su módulo (por el número del título).
update public.materiales m set leccion_id = l.id
from public.lecciones l, public.cursos c
where c.slug = 'ia-para-civil-3d-con-claude' and m.curso_id = c.id and l.curso_id = c.id
  and l.orden = substring(m.titulo from 'Módulo ([0-9]+)')::int;
