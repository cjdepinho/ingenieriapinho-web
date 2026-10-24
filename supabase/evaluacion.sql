-- Avance real por clase, evaluación final y certificado manual o automático.
-- Ejecutar completo, una sola vez, en Supabase > SQL Editor. Es seguro volver a ejecutarlo.

-- ============ Configuración por curso ============
alter table public.cursos add column if not exists certificado_auto boolean not null default false;
alter table public.cursos add column if not exists nota_minima int not null default 14;
alter table public.cursos add column if not exists intentos_max int not null default 3;
alter table public.cursos add column if not exists preguntas_por_examen int not null default 10;  -- cuántas preguntas se sortean del banco en cada intento

-- ============ Avance por clase: video visto y material descargado ============
create table if not exists public.avance (
  user_id uuid not null references public.profiles(id) on delete cascade,
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  video_pct int not null default 0 check (video_pct between 0 and 100),
  descargado boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (user_id, leccion_id)
);
alter table public.avance enable row level security;
drop policy if exists av_ver on public.avance;
create policy av_ver on public.avance for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists av_crear on public.avance;
create policy av_crear on public.avance for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id)));
drop policy if exists av_editar on public.avance;
create policy av_editar on public.avance for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Una clase solo se marca como completada si el avance lo respalda (video al 90 % y material descargado).
drop policy if exists pg_crear on public.progreso;
create policy pg_crear on public.progreso for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id))
  and (public.is_admin() or exists (select 1 from public.avance a where a.user_id = auth.uid() and a.leccion_id = progreso.leccion_id
        and a.video_pct >= 90 and a.descargado)));

-- ============ Evaluación final ============
create table if not exists public.preguntas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  orden int not null default 0,
  tipo text not null check (tipo in ('opcion','numero')),
  enunciado text not null,
  opciones text[] not null default '{}',
  correcta text not null,           -- opcion: posición (0,1,2…) de la alternativa correcta; numero: valor esperado
  tolerancia numeric not null default 0,   -- numero: error relativo permitido, en %
  explicacion text not null default '',
  puntos int not null default 2
);
alter table public.preguntas enable row level security;
drop policy if exists pr_admin on public.preguntas;
create policy pr_admin on public.preguntas for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.intentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  nota numeric not null,
  aprobado boolean not null,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.intentos enable row level security;
drop policy if exists in_ver on public.intentos;
create policy in_ver on public.intentos for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists in_admin on public.intentos;
create policy in_admin on public.intentos for delete using (public.is_admin());

-- Sorteo vigente de cada alumno: las preguntas que le tocaron del banco. Nadie lo lee directamente: solo las funciones.
create table if not exists public.sorteos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  preguntas uuid[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, curso_id)
);
alter table public.sorteos enable row level security;

-- ¿Puede esta persona rendir la evaluación? (matrícula activa y todas las clases completadas)
create or replace function public.puede_examen(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tiene_acceso(p_curso) and (
    public.is_admin() or (
      exists (select 1 from public.lecciones where curso_id = p_curso)
      and not exists (select 1 from public.lecciones l where l.curso_id = p_curso
        and not exists (select 1 from public.progreso g where g.user_id = auth.uid() and g.leccion_id = l.id))));
$$;

-- Sortea las preguntas del intento desde el banco y las devuelve SIN las respuestas correctas.
-- Si el alumno sale y vuelve sin enviar, recibe las mismas preguntas (no puede "re-sortear" hasta que le salga un examen fácil).
create or replace function public.examen_preguntas(p_curso uuid)
returns table (id uuid, orden int, tipo text, enunciado text, opciones text[], puntos int)
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; n int;
begin
  if not public.puede_examen(p_curso) then raise exception 'Aún no puedes rendir la evaluación.'; end if;
  if exists (select 1 from public.intentos i where i.user_id = auth.uid() and i.curso_id = p_curso and i.aprobado) then
    raise exception 'Ya aprobaste la evaluación.'; end if;
  if not public.is_admin() and (select count(*) from public.intentos i where i.user_id = auth.uid() and i.curso_id = p_curso)
       >= (select c.intentos_max from public.cursos c where c.id = p_curso) then
    raise exception 'Ya usaste todos tus intentos.'; end if;
  select s.preguntas into ids from public.sorteos s where s.user_id = auth.uid() and s.curso_id = p_curso;
  if ids is null then
    select c.preguntas_por_examen into n from public.cursos c where c.id = p_curso;
    select array_agg(x.qid) into ids from (
      select p2.id as qid from public.preguntas p2 where p2.curso_id = p_curso order by random() limit n) x;
    if ids is null then raise exception 'La evaluación aún no tiene preguntas.'; end if;
    insert into public.sorteos (user_id, curso_id, preguntas) values (auth.uid(), p_curso, ids)
      on conflict (user_id, curso_id) do update set preguntas = excluded.preguntas, created_at = now();
  end if;
  return query select p.id, p.orden, p.tipo, p.enunciado, p.opciones, p.puntos
    from public.preguntas p where p.id = any(ids) order by p.orden;
end $$;

-- Califica en el servidor, guarda el intento y emite el certificado si el curso es automático.
create or replace function public.examen_enviar(p_curso uuid, p_respuestas jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.cursos%rowtype; q public.preguntas%rowtype; perfil public.profiles%rowtype;
  ids uuid[]; usados int; total int := 0; ganados int := 0; det jsonb := '[]'::jsonb;
  resp text; acierto boolean; v numeric; v_nota numeric; v_ok boolean; revelar boolean; v_cert boolean := false;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; suf text := ''; i int;
begin
  if auth.uid() is null or not public.puede_examen(p_curso) then raise exception 'Aún no puedes rendir la evaluación.'; end if;
  select * into c from public.cursos where id = p_curso;
  if exists (select 1 from public.intentos i2 where i2.user_id = auth.uid() and i2.curso_id = p_curso and i2.aprobado) then
    raise exception 'Ya aprobaste la evaluación.'; end if;
  select count(*) into usados from public.intentos where user_id = auth.uid() and curso_id = p_curso;
  if usados >= c.intentos_max and not public.is_admin() then raise exception 'Ya usaste todos tus intentos.'; end if;

  select so.preguntas into ids from public.sorteos so where so.user_id = auth.uid() and so.curso_id = p_curso;
  if ids is null then raise exception 'Abre primero la evaluación para recibir tus preguntas.'; end if;

  for q in select * from public.preguntas where id = any(ids) order by orden loop
    total := total + q.puntos;
    resp := btrim(coalesce(p_respuestas ->> q.id::text, ''));
    acierto := false;
    if q.tipo = 'opcion' then
      acierto := resp = q.correcta;
    else
      begin
        v := replace(regexp_replace(resp, '[^0-9,.-]', '', 'g'), ',', '.')::numeric;
        acierto := abs(v - q.correcta::numeric) <= abs(q.correcta::numeric) * q.tolerancia / 100.0;
      exception when others then acierto := false;
      end;
    end if;
    if acierto then ganados := ganados + q.puntos; end if;
    det := det || jsonb_build_array(jsonb_build_object('id', q.id, 'ok', acierto, 'explicacion', q.explicacion));
  end loop;
  if total = 0 then raise exception 'La evaluación aún no tiene preguntas.'; end if;

  v_nota := round(20.0 * ganados / total, 1);
  v_ok := v_nota >= c.nota_minima;
  insert into public.intentos (user_id, curso_id, nota, aprobado, respuestas)
    values (auth.uid(), p_curso, v_nota, v_ok, coalesce(p_respuestas, '{}'::jsonb));
  delete from public.sorteos where user_id = auth.uid() and curso_id = p_curso;  -- el próximo intento tendrá otras preguntas

  -- Las explicaciones se muestran al aprobar o al agotar los intentos (para que no sirvan de "chuleta").
  revelar := v_ok or usados + 1 >= c.intentos_max;
  if not revelar then
    select coalesce(jsonb_agg(e - 'explicacion'), '[]'::jsonb) into det from jsonb_array_elements(det) e;
  end if;

  if v_ok and c.certificado_auto
     and not exists (select 1 from public.certificados where user_id = auth.uid() and curso_id = p_curso) then
    select * into perfil from public.profiles where id = auth.uid();
    for i in 1..6 loop suf := suf || substr(alfabeto, 1 + floor(random() * 32)::int, 1); end loop;
    insert into public.certificados (codigo, user_id, curso_id, alumno_nombre, curso_titulo, horas, fecha_emision)
      values ('PINHO-' || extract(year from current_date)::int || '-' || suf, auth.uid(), p_curso,
              coalesce(nullif(perfil.nombre, ''), perfil.email), c.titulo, c.horas, current_date);
    update public.matriculas set estado = 'completada'
      where user_id = auth.uid() and curso_id = p_curso and estado = 'activa';
    v_cert := true;
  end if;

  return jsonb_build_object('nota', v_nota, 'aprobado', v_ok, 'intento', usados + 1,
    'intentos_max', c.intentos_max, 'nota_minima', c.nota_minima, 'detalle', det, 'certificado', v_cert);
end $$;

revoke all on function public.puede_examen(uuid) from public, anon;
revoke all on function public.examen_preguntas(uuid) from public, anon;
revoke all on function public.examen_enviar(uuid, jsonb) from public, anon;
grant execute on function public.puede_examen(uuid) to authenticated;
grant execute on function public.examen_preguntas(uuid) to authenticated;
grant execute on function public.examen_enviar(uuid, jsonb) to authenticated;

-- ¿Este curso tiene evaluación? (el alumno no puede leer la tabla de preguntas, solo saber cuántas hay)
create or replace function public.examen_info(p_curso uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('preguntas', (select count(*) from public.preguntas where curso_id = p_curso))
  where public.tiene_acceso(p_curso);
$$;
revoke all on function public.examen_info(uuid) from public, anon;
grant execute on function public.examen_info(uuid) to authenticated;

-- ============ Calendario de clases en vivo ============
-- Mientras la clase no tenga video, el alumno ve "Esta clase se emitirá el <fecha> a las <hora>".
alter table public.lecciones add column if not exists fecha_clase date;
alter table public.lecciones add column if not exists hora_clase text default '';
