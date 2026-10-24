-- Material de cada curso (visible solo para alumnos con matrícula activa).
-- Antes de ejecutar: en cada enlace usa Compartir > "Cualquier persona con el enlace puede ver".
insert into public.materiales (curso_id, titulo, url, tipo)
select id, 'Presentaciones de las 6 clases', 'https://claude.ai/artifact/C3Wm2sPmWRRH4qgLFndQPC', 'Presentación'
from public.cursos where slug = 'inteligencia-artificial-para-ingenieros';
insert into public.materiales (curso_id, titulo, url, tipo)
select id, 'Guía de trabajo y ejercicios', 'https://claude.ai/artifact/LGxPBEAQkzwT2BQ1aT4M7E', 'Documento'
from public.cursos where slug = 'inteligencia-artificial-para-ingenieros';
insert into public.materiales (curso_id, titulo, url, tipo)
select id, 'Presentaciones de las 6 clases', 'https://claude.ai/artifact/D79kFP9eNjt2rxNjJeHu2Z', 'Presentación'
from public.cursos where slug = 'ia-para-ingenieria-civil';
insert into public.materiales (curso_id, titulo, url, tipo)
select id, 'Guía de trabajo y ejercicios', 'https://claude.ai/artifact/C6dCtp17gPXHBuppaStfkr', 'Documento'
from public.cursos where slug = 'ia-para-ingenieria-civil';
