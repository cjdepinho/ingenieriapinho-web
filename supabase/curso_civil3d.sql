-- Curso "IA para Civil 3D con Claude" (4 horas, 6 módulos prácticos).
-- Ejecutar en Supabase > SQL Editor, o pegar en la consola SQL del panel de administración.
-- Es seguro volver a ejecutarlo: actualiza el curso y no duplica las clases.
-- Los videos de YouTube se enlazan después, clase por clase, desde el panel (Clases > Editar).
-- El material (presentaciones) se sube desde el panel, al almacén privado del curso.

insert into public.cursos (slug, titulo, subtitulo, descripcion, nivel, horas, precio, modalidad, incluye, temario, publicado, orden)
values (
  'ia-para-civil-3d-con-claude',
  'IA para Civil 3D con Claude',
  'Tu equipo de agentes de IA para proyectos viales',
  'Curso 100 % práctico: arma un sistema multiagente con Claude y úsalo en Civil 3D para limpiar datos topográficos, diseñar y revisar una vía, calcular volúmenes y automatizar reportes.',
  'Intermedio', 4, 500, 'Virtual',
  array['4 horas de formación virtual en 6 módulos 100 % prácticos','Presentaciones de cada módulo','Instrucciones de cada agente y scripts de ejemplo','Práctica guiada en Civil 3D en cada módulo','Certificado de 4 horas con código QR verificable'],
  array['Tu equipo de agentes: coordinador y especialistas, y cómo trabajan juntos (30 min)','Agente Topógrafo: del archivo de puntos a una superficie verificada en Civil 3D (45 min)','Agente Diseñador Vial: alineamiento, perfil y tabla de cumplimiento de criterios (45 min)','Agente Cubicador: corredor, secciones y verificación independiente de volúmenes (45 min)','Agente Automatizador: scripts, tablas y reportes que ahorran horas de trabajo (45 min)','Agente Revisor e integración: control de calidad y proyecto integrador de punta a punta (30 min)'],
  true, 3
)
on conflict (slug) do update set
  titulo = excluded.titulo, subtitulo = excluded.subtitulo, descripcion = excluded.descripcion,
  nivel = excluded.nivel, horas = excluded.horas, precio = excluded.precio, modalidad = excluded.modalidad,
  incluye = excluded.incluye, temario = excluded.temario, publicado = excluded.publicado, orden = excluded.orden;

insert into public.lecciones (curso_id, titulo, descripcion, orden)
select c.id, v.titulo, v.descripcion, v.orden
from public.cursos c,
(values
  (1, 'Módulo 1 · Tu equipo de agentes', 'Qué es un agente, cómo se organiza un equipo y cómo armas tu coordinador. 30 min.'),
  (2, 'Módulo 2 · Agente Topógrafo', 'Limpieza de puntos con Python, importación a Civil 3D, grupos de puntos y superficie TIN. 45 min.'),
  (3, 'Módulo 3 · Agente Diseñador Vial', 'Tabla de criterios, alineamiento, perfil y tabla de cumplimiento. 45 min.'),
  (4, 'Módulo 4 · Agente Cubicador', 'Corredor, secciones, volúmenes y verificación independiente por áreas medias. 45 min.'),
  (5, 'Módulo 5 · Agente Automatizador', 'Encargos claros, scripts seguros, reportes y tablas a Excel. 45 min.'),
  (6, 'Módulo 6 · Agente Revisor e integración', 'Informe de observaciones, proyecto integrador y buenas prácticas. 30 min.')
) as v(orden, titulo, descripcion)
where c.slug = 'ia-para-civil-3d-con-claude'
  and not exists (select 1 from public.lecciones l where l.curso_id = c.id and l.orden = v.orden);
