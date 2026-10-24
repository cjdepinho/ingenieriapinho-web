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
