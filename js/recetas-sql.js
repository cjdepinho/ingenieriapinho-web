// Recetas precargadas de la consola SQL.
// params: valores que se piden antes de ejecutar y se insertan como {{nombre}} (texto o número ya protegidos).
// modifica: true cuando la receta cambia datos (pide confirmación).

export const RECETAS = [
    {
        grupo: 'Consultas',
        items: [
            {
                id: 'contable-mes', titulo: 'Resumen contable por mes',
                detalle: 'Ingresos, gastos y resultado de cada mes.',
                sql: `select to_char(fecha, 'YYYY-MM') as mes,
       coalesce(sum(monto) filter (where tipo = 'ingreso'), 0) as ingresos,
       coalesce(sum(monto) filter (where tipo = 'gasto'), 0) as gastos,
       coalesce(sum(case when tipo = 'ingreso' then monto else -monto end), 0) as resultado
from public.movimientos
group by 1
order by 1 desc`
            },
            {
                id: 'ingresos-curso', titulo: 'Ingresos por curso',
                detalle: 'Cuántos alumnos y cuánto dinero aportó cada curso.',
                sql: `select c.titulo, count(*) as matriculas, sum(m.monto) as total
from public.matriculas m
join public.cursos c on c.id = m.curso_id
where m.estado in ('activa', 'completada')
group by c.titulo
order by total desc`
            },
            {
                id: 'gastos-categoria', titulo: 'Gastos por categoría de un mes',
                detalle: 'Escribe el mes con formato AAAA-MM, por ejemplo 2026-10.',
                params: [{ n: 'mes', l: 'Mes (AAAA-MM)', t: 'text', v: '' }],
                sql: `select categoria, count(*) as movimientos, sum(monto) as total
from public.movimientos
where tipo = 'gasto' and to_char(fecha, 'YYYY-MM') = {{mes}}
group by categoria
order by total desc`
            },
            {
                id: 'pendientes', titulo: 'Matrículas pendientes de validar',
                detalle: 'Pagos por revisar, del más antiguo al más reciente.',
                sql: `select m.created_at::date as fecha, p.nombre, p.email, c.titulo as curso,
       m.monto, m.metodo, m.referencia
from public.matriculas m
join public.profiles p on p.id = m.user_id
join public.cursos c on c.id = m.curso_id
where m.estado = 'pendiente'
order by m.created_at`
            },
            {
                id: 'alumnos-cursos', titulo: 'Alumnos y sus cursos',
                detalle: 'Todas las matrículas con el nombre del alumno y el estado.',
                sql: `select p.nombre, p.email, c.titulo as curso, m.estado, m.monto, m.created_at::date as fecha
from public.matriculas m
join public.profiles p on p.id = m.user_id
join public.cursos c on c.id = m.curso_id
order by m.created_at desc`
            },
            {
                id: 'avance', titulo: 'Avance de cada alumno',
                detalle: 'Clases vistas sobre el total de clases del curso.',
                sql: `select p.nombre, p.email, c.titulo as curso,
       count(pr.leccion_id) as vistas,
       (select count(*) from public.lecciones l where l.curso_id = c.id) as total_clases
from public.matriculas m
join public.profiles p on p.id = m.user_id
join public.cursos c on c.id = m.curso_id
left join public.lecciones l on l.curso_id = c.id
left join public.progreso pr on pr.leccion_id = l.id and pr.user_id = m.user_id
where m.estado in ('activa', 'completada')
group by p.nombre, p.email, c.id, c.titulo
order by p.nombre`
            },
            {
                id: 'listos-certificar', titulo: 'Alumnos listos para certificar',
                detalle: 'Completaron todas las clases y aún no tienen certificado.',
                sql: `select p.nombre, p.email, c.titulo as curso
from public.matriculas m
join public.profiles p on p.id = m.user_id
join public.cursos c on c.id = m.curso_id
where m.estado in ('activa', 'completada')
  and exists (select 1 from public.lecciones l where l.curso_id = c.id)
  and not exists (
    select 1 from public.lecciones l
    where l.curso_id = c.id
      and not exists (select 1 from public.progreso pr where pr.leccion_id = l.id and pr.user_id = m.user_id))
  and not exists (select 1 from public.certificados ce where ce.user_id = m.user_id and ce.curso_id = m.curso_id)`
            },
            {
                id: 'certificados', titulo: 'Certificados emitidos',
                detalle: 'Códigos, alumnos y estado de cada certificado.',
                sql: `select codigo, alumno_nombre, curso_titulo, horas, fecha_emision,
       case when revocado then 'Anulado' else 'Vigente' end as estado
from public.certificados
order by created_at desc`
            },
            {
                id: 'buscar-alumno', titulo: 'Buscar un alumno',
                detalle: 'Busca por parte del nombre o del correo.',
                params: [{ n: 'texto', l: 'Nombre o correo', t: 'text', v: '' }],
                sql: `select nombre, email, telefono, role, created_at::date as registro
from public.profiles
where nombre ilike '%' || {{texto}} || '%' or email ilike '%' || {{texto}} || '%'
order by nombre`
            },
            {
                id: 'cursos-resumen', titulo: 'Cursos con clases y material',
                detalle: 'Estado de publicación y contenido cargado de cada curso.',
                sql: `select c.titulo, c.precio, c.horas, c.publicado,
       (select count(*) from public.lecciones l where l.curso_id = c.id) as clases,
       (select count(*) from public.materiales m where m.curso_id = c.id) as materiales
from public.cursos c
order by c.orden`
            },
            {
                id: 'consultas-abiertas', titulo: 'Consultas sin atender',
                detalle: 'Mensajes recibidos desde el formulario de contacto.',
                sql: `select created_at::date as fecha, nombre, email, mensaje
from public.consultas
where not atendida
order by created_at`
            }
        ]
    },
    {
        grupo: 'Mantenimiento (modifican datos)',
        items: [
            {
                id: 'hacer-admin', titulo: 'Hacer administrador a un correo', modifica: true,
                detalle: 'La persona debe haberse registrado antes.',
                params: [{ n: 'correo', l: 'Correo', t: 'text', v: '' }],
                sql: `update public.profiles set role = 'admin' where email = {{correo}}`
            },
            {
                id: 'quitar-admin', titulo: 'Quitar el rol de administrador', modifica: true,
                detalle: 'Vuelve la cuenta a alumno. No lo uses con tu propio correo.',
                params: [{ n: 'correo', l: 'Correo', t: 'text', v: '' }],
                sql: `update public.profiles set role = 'alumno' where email = {{correo}}`
            },
            {
                id: 'precio-curso', titulo: 'Cambiar el precio de un curso', modifica: true,
                detalle: 'Usa la dirección del curso, por ejemplo ia-para-ingenieria-civil.',
                params: [{ n: 'slug', l: 'Dirección del curso', t: 'text', v: '' }, { n: 'precio', l: 'Precio (S/)', t: 'number', v: '500' }],
                sql: `update public.cursos set precio = {{precio}} where slug = {{slug}}`
            },
            {
                id: 'precio-todos', titulo: 'Cambiar el precio de todos los cursos', modifica: true,
                detalle: 'Aplica el mismo precio a todos los cursos.',
                params: [{ n: 'precio', l: 'Precio (S/)', t: 'number', v: '500' }],
                sql: `update public.cursos set precio = {{precio}}`
            },
            {
                id: 'nombre-cert', titulo: 'Corregir el nombre en un certificado', modifica: true,
                detalle: 'Cambia el nombre que aparece en el certificado y en su verificación.',
                params: [{ n: 'codigo', l: 'Código del certificado', t: 'text', v: '' }, { n: 'nombre', l: 'Nombre correcto', t: 'text', v: '' }],
                sql: `update public.certificados set alumno_nombre = {{nombre}} where upper(codigo) = upper({{codigo}})`
            },
            {
                id: 'anular-cert', titulo: 'Anular un certificado', modifica: true,
                detalle: 'Deja de verificarse como válido.',
                params: [{ n: 'codigo', l: 'Código del certificado', t: 'text', v: '' }],
                sql: `update public.certificados set revocado = true where upper(codigo) = upper({{codigo}})`
            },
            {
                id: 'restablecer-cert', titulo: 'Restablecer un certificado anulado', modifica: true,
                detalle: 'Vuelve a verificarse como válido.',
                params: [{ n: 'codigo', l: 'Código del certificado', t: 'text', v: '' }],
                sql: `update public.certificados set revocado = false where upper(codigo) = upper({{codigo}})`
            },
            {
                id: 'eliminar-cert', titulo: 'Eliminar un certificado', modifica: true,
                detalle: 'Lo borra por completo; no se puede deshacer.',
                params: [{ n: 'codigo', l: 'Código del certificado', t: 'text', v: '' }],
                sql: `delete from public.certificados where upper(codigo) = upper({{codigo}})`
            },
            {
                id: 'eliminar-matricula', titulo: 'Eliminar la matrícula de un alumno en un curso', modifica: true,
                detalle: 'Borra la matrícula y su ingreso contable. No se puede deshacer.',
                params: [{ n: 'correo', l: 'Correo del alumno', t: 'text', v: '' }, { n: 'slug', l: 'Dirección del curso', t: 'text', v: '' }],
                sql: [
                    `delete from public.movimientos where matricula_id in (
  select m.id from public.matriculas m
  join public.profiles p on p.id = m.user_id
  join public.cursos c on c.id = m.curso_id
  where p.email = {{correo}} and c.slug = {{slug}})`,
                    `delete from public.matriculas where id in (
  select m.id from public.matriculas m
  join public.profiles p on p.id = m.user_id
  join public.cursos c on c.id = m.curso_id
  where p.email = {{correo}} and c.slug = {{slug}})`
                ]
            },
            {
                id: 'borrar-pruebas', titulo: 'Borrar los datos de prueba de una cuenta', modifica: true,
                detalle: 'Elimina certificados, avance, ingresos y matrículas de esa cuenta. No borra la cuenta.',
                params: [{ n: 'correo', l: 'Correo de la cuenta de prueba', t: 'text', v: '' }],
                sql: [
                    `delete from public.certificados where user_id in (select id from public.profiles where email = {{correo}})`,
                    `delete from public.progreso where user_id in (select id from public.profiles where email = {{correo}})`,
                    `delete from public.movimientos where matricula_id in (
  select m.id from public.matriculas m join public.profiles p on p.id = m.user_id where p.email = {{correo}})`,
                    `delete from public.matriculas where user_id in (select id from public.profiles where email = {{correo}})`
                ]
            },
            {
                id: 'atender-todas', titulo: 'Marcar todas las consultas como atendidas', modifica: true,
                detalle: 'Útil después de responder los mensajes pendientes.',
                sql: `update public.consultas set atendida = true where not atendida`
            }
        ]
    }
];

/** Convierte un valor del formulario en un literal SQL seguro. */
export function literalSQL(param, valor) {
    if (param.t === 'number') {
        const n = Number(valor);
        if (!Number.isFinite(n)) throw new Error(`"${param.l}" debe ser un número.`);
        return String(n);
    }
    return `'${String(valor).replace(/'/g, "''")}'`;
}

/** Devuelve el texto SQL de una receta con sus parámetros reemplazados. */
export function armarSQL(receta, valores = {}) {
    const partes = [].concat(receta.sql);
    return partes.map((q) => q.replace(/\{\{(\w+)\}\}/g, (_, n) => {
        const p = (receta.params || []).find((x) => x.n === n);
        return literalSQL(p || { t: 'text', l: n }, valores[n] ?? '');
    })).join(';\n\n');
}
