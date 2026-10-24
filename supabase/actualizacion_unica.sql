-- ACTUALIZACIÓN ÚNICA (pégala completa en el SQL Editor de Supabase y pulsa Run, una sola vez).
-- Incluye: avance por clase, evaluación final con banco de preguntas, certificado automático,
-- calendario de clases en vivo, 32 preguntas del curso de Civil 3D y rol de instructor.

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

-- ============ Banco de preguntas: IA para Civil 3D con Claude ============
-- Banco de preguntas del curso "IA para Civil 3D con Claude": 32 preguntas; cada intento sortea 10 (2 puntos c/u, máximo 20, aprobatoria 14).
-- Ejecutar después de evaluacion.sql. Se puede volver a ejecutar: reemplaza el banco del curso.
-- Fuentes: DG-2018 (tablas 302.04, 303.01 a 303.03, 304.01 a 304.03, 304.10, 304.11), EG-2013 (Sección 201) y las cifras del ejemplo del curso.

update public.cursos set nota_minima = 14, intentos_max = 3, preguntas_por_examen = 10 where slug = 'ia-para-civil-3d-con-claude';

delete from public.preguntas where curso_id = (select id from public.cursos where slug = 'ia-para-civil-3d-con-claude');

insert into public.preguntas (curso_id, orden, tipo, enunciado, opciones, correcta, tolerancia, explicacion, puntos)
select c.id, v.orden, v.tipo, v.enunciado, v.opciones, v.correcta, v.tolerancia, v.explicacion, 2
from public.cursos c,
(values
  (1, 'opcion', 'Según el DG-2018 (Tabla 303.01), ¿cuál es la pendiente máxima del ejemplo del curso (Tercera Clase, por debajo de 3 000 msnm)?', array['6 %','8 %','10 %','12 %']::text[], '2', 0, 'La Tabla 303.01 fija 10 % para el ejemplo.'),
  (2, 'opcion', 'La alternativa A del Diseñador Vial tiene pendiente de 16,29 % y K = 2,5 en la curva cóncava. ¿Qué concluye el Revisor?', array['Cumple, porque el radio de 60 m supera el mínimo','No cumple: la pendiente pasa de 10 % y K es menor a 6','Cumple, porque el alineamiento es corto','No se puede evaluar sin el corredor']::text[], '1', 0, 'Pendiente máxima 10 % (Tabla 303.01) y K mínimo 6 en curva cóncava a 30 km/h (Tabla 303.03): A incumple ambos.'),
  (3, 'opcion', '¿Cuál es el parámetro K mínimo de una curva vertical cóncava a 30 km/h según la Tabla 303.03 del DG-2018?', array['1,9','3','6','29,7']::text[], '2', 0, 'La Tabla 303.03 da K = 6. El 1,9 es de la curva convexa y 29,7 es el K de la alternativa B.'),
  (4, 'opcion', 'En el flujo de trabajo con agentes, ¿quién toma la decisión final del proyecto?', array['El Agente Revisor, porque revisa todo','El Agente Coordinador','El ingeniero responsable','Civil 3D, al calcular los volúmenes']::text[], '2', 0, 'Los agentes proponen y observan; el ingeniero responsable verifica, decide y firma.'),
  (5, 'opcion', 'El Automatizador te entrega un script. ¿Qué haces antes de ejecutarlo?', array['Lo ejecuto directamente sobre el dibujo original','Lo leo y lo pruebo primero en una copia del dibujo','Se lo pido al Revisor para que lo apruebe y lo ejecuto','Lo ejecuto solo si el agente dice que es seguro']::text[], '1', 0, 'Ningún script corre sin revisión previa: se lee, se entiende y se prueba en una copia.'),
  (6, 'opcion', 'En Civil 3D, ¿cómo se escribe un punto por teclado en la línea de comandos?', array['Norte,Este','Este,Norte','Cota,Este','Este;Norte;Cota']::text[], '1', 0, 'El Este es X y el Norte es Y: se escribe Este,Norte.'),
  (7, 'opcion', 'Según la Tabla 304.01 del DG-2018, ¿cuál es el ancho de calzada del ejemplo (dos carriles de 3,00 m)?', array['5,00 m','6,00 m','7,20 m','7,50 m']::text[], '1', 0, 'Dos carriles de 3,00 m suman 6,00 m de calzada.'),
  (8, 'opcion', 'Según la Tabla 304.02 del DG-2018, ¿qué ancho de berma usa el ejemplo?', array['0,25 m','0,50 m','1,00 m','1,50 m']::text[], '1', 0, 'La berma del ejemplo es de 0,50 m.'),
  (9, 'opcion', 'Según la Tabla 304.03 del DG-2018, ¿qué bombeo tiene la calzada asfáltica del ejemplo?', array['1 %','2 %','3 %','4 %']::text[], '1', 0, 'El bombeo del pavimento asfáltico es de 2 %.'),
  (10, 'opcion', '¿Cuál es el radio mínimo del ejemplo a 30 km/h con peralte máximo de 8 % (Tabla 302.04)?', array['15 m','30 m','60 m','100 m']::text[], '1', 0, 'La Tabla 302.04 da 30 m para 30 km/h con peralte de 8 %.'),
  (11, 'opcion', '¿Cuál es el parámetro K mínimo de una curva vertical convexa a 30 km/h según el ejemplo (Tabla 303.02)?', array['1,9','6','10','29,7']::text[], '0', 0, 'La curva convexa usa K = 1,9; la cóncava, K = 6.'),
  (12, 'opcion', 'Si el proyecto está por encima de 3 000 msnm, ¿qué pasa con la pendiente máxima de 10 % del ejemplo?', array['Se mantiene igual','El manual reduce el límite','Aumenta','La altitud no influye']::text[], '1', 0, 'El 10 % del ejemplo vale para menos de 3 000 msnm; sobre esa altitud el DG-2018 reduce el límite.'),
  (13, 'opcion', '¿Qué talud de corte usa el ejemplo (Tabla 304.10 del DG-2018)?', array['1:1 (H:V)','2:1 (H:V)','1,5:1 (H:V)','1:2 (H:V)']::text[], '0', 0, 'El talud de corte del ejemplo es 1:1.'),
  (14, 'opcion', '¿Qué talud de relleno usa el ejemplo (Tabla 304.11 del DG-2018)?', array['1V:1H','1V:1,5H','1V:2H','1V:3H']::text[], '1', 0, 'El relleno del ejemplo es 1V:1,5H, es decir 1,5:1 en el assembly.'),
  (15, 'opcion', '¿Qué pendiente tiene la berma en la sección tipo del ejemplo?', array['2 %','4 %','6 %','8 %']::text[], '1', 0, 'La berma tiene 4 % (Figura 304.03 del DG-2018).'),
  (16, 'opcion', 'El Topógrafo encuentra puntos duplicados y una cota atípica. ¿Qué hace?', array['Los borra para que la superficie quede limpia','Los marca y los reporta; nunca los borra','Los corrige a mano sin avisar','Los ignora']::text[], '1', 0, 'El agente no borra datos: los marca y los reporta para que decida el ingeniero.'),
  (17, 'opcion', '¿Qué entrega el Diseñador Vial?', array['Los planos de planta y perfil terminados','Alternativas con PI, radios, PVI y una tabla de cumplimiento','El metrado de movimiento de tierras','La superficie del terreno natural']::text[], '1', 0, 'Propone alternativas y una tabla CUMPLE / NO CUMPLE; el dibujo lo haces tú en Civil 3D.'),
  (18, 'opcion', '¿Cómo calcula el Cubicador el volumen entre dos secciones por el método de áreas medias?', array['Suma las dos áreas','Promedio de las dos áreas × distancia entre secciones','Área mayor × distancia','Promedio de las áreas × número de secciones']::text[], '1', 0, 'Volumen = promedio de áreas × distancia.'),
  (19, 'opcion', '¿Qué hace el Agente Revisor con lo que encuentra?', array['Aprueba el proyecto si todo está bien','Reporta observaciones con severidad y responsable; no aprueba','Corrige directamente los datos de los demás agentes','Elimina las alternativas que no cumplen']::text[], '1', 0, 'El revisor reporta; la decisión final es del ingeniero responsable.'),
  (20, 'opcion', 'Antes de programar, ¿qué debe pedirte el Automatizador?', array['Tu contraseña de Civil 3D','Las entradas, las salidas y qué NO debe tocar','Permiso para borrar el original','Nada: programa de inmediato']::text[], '1', 0, 'Un encargo claro define entradas, salidas y lo que no se debe modificar.'),
  (21, 'opcion', '¿Qué comando crea las láminas de planta y perfil a partir de los View Frames?', array['COMPUTEMATERIALS','CVREBUILDALLCORRIDORS','CREATESHEETS','QSAVE']::text[], '2', 0, 'CREATEVIEWFRAMES crea los marcos y CREATESHEETS genera las láminas.'),
  (22, 'opcion', '¿Con qué comando se carga un archivo .lsp de AutoLISP en Civil 3D?', array['SCRIPT','APPLOAD','PUBLISH','QSAVE']::text[], '1', 0, 'APPLOAD carga el .lsp; SCRIPT ejecuta un archivo .scr.'),
  (23, 'opcion', 'Según el EG-2013 (Sección 201), el desbroce y limpieza del terreno se mide en:', array['m³','Hectárea (ha)','Metro lineal','Kilogramo']::text[], '1', 0, 'El desbroce y limpieza se mide en hectáreas, en proyección horizontal.'),
  (24, 'numero', 'Con tu ejemplo terminado, ¿cuántos m³ de CORTE total indica tu Total Volume Table? (escribe solo el número)', '{}'::text[], '695.54', 2, 'Debe dar 695,54 m³. Si te sale distinto, revisa el assembly y vuelve a ejecutar Compute Materials.'),
  (25, 'numero', 'Con tu ejemplo terminado, ¿cuántos m³ de RELLENO total indica tu Total Volume Table? (escribe solo el número)', '{}'::text[], '156.42', 2, 'Debe dar 156,42 m³.'),
  (26, 'numero', '¿Cuántos m³ de EXCEDENTE (corte menos relleno) tiene tu tramo? (escribe solo el número)', '{}'::text[], '539.12', 2, '695,54 − 156,42 = 539,12 m³.'),
  (27, 'numero', '¿Cuántos metros mide la longitud total de tu alineamiento Eje_Via_Ejemplo? (escribe solo el número)', '{}'::text[], '104.10', 1, 'Recto de 40,695 m + curva de 29,785 m + recto de 33,620 m = 104,10 m.'),
  (28, 'numero', '¿Cuántos m² tiene el área 2D de tu superficie Terreno_Natural? (escribe solo el número)', '{}'::text[], '6800', 1, 'El borde de 85 × 80 m da 6 800 m².'),
  (29, 'numero', '¿Qué radio, en metros, tiene la curva horizontal de tu alineamiento? (escribe solo el número)', '{}'::text[], '60', 0, 'El ejemplo usa R = 60 m, mayor al mínimo de 30 m.'),
  (30, 'numero', '¿Cuántos metros mide la curva circular de tu alineamiento? (escribe solo el número)', '{}'::text[], '29.785', 1, 'La curva de R = 60 m mide 29,785 m.'),
  (31, 'numero', '¿Cuál es el valor de K de la curva vertical de 30 m de la alternativa B? (escribe solo el número)', '{}'::text[], '29.7', 2, 'K = longitud de curva ÷ diferencia de pendientes = 30 ÷ 1,01 ≈ 29,7.'),
  (32, 'numero', '¿Cuál es la mayor de las dos pendientes (en %) de la rasante de la alternativa B? (escribe solo el número)', '{}'::text[], '9.90', 1, 'Las pendientes de la rasante B son 8,89 % y 9,90 %.')
) as v(orden, tipo, enunciado, opciones, correcta, tolerancia, explicacion)
where c.slug = 'ia-para-civil-3d-con-claude';

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
