// Panel de administración: cursos, matrículas y pagos, certificados, planificación, contabilidad y ajustes.

import { db, modo } from './db.js';
import { RECETAS, armarSQL } from './recetas-sql.js';
import { $, h, aviso, soles, hoyISO, fechaCorta, mesEtiqueta, MESES, crearSlug, generarCodigo, mensajeError,
         confirmar, pedirFormulario, formulario, abrirModal, tabla, descargarCSV, etiquetaEstado, bannerDemo } from './ui.js';

const raiz = $('#raiz');
let sesion = null;
let esInstr = false;      // true si la cuenta es de instructor (acceso limitado)
let mesSel = hoyISO().slice(0, 7);
let mesCal = hoyISO().slice(0, 7);
let filtroMat = 'pendiente';

const SECCIONES = [
    ['resumen', 'Resumen'], ['cursos', 'Cursos y clases'], ['matriculas', 'Matrículas y pagos'], ['alumnos', 'Alumnos'],
    ['certificados', 'Certificados'], ['planificacion', 'Planificación'], ['contabilidad', 'Contabilidad'],
    ['consultas', 'Consultas'], ['sql', 'Consola SQL'], ['ajustes', 'Ajustes']];

const CATEGORIAS = ['Matrículas', 'Publicidad', 'Plataforma y herramientas', 'Honorarios', 'Impuestos y tasas', 'Otros'];
const linea = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
const seguro = async (fn) => { try { await fn(); } catch (e) { aviso(mensajeError(e), 'error'); } };

// ---------- Estructura ----------
function marco(seccion, contador, ...contenido) {
    raiz.replaceChildren(h('div', { class: 'admin' },
        h('aside', { class: 'lateral' },
            h('a', { href: '../', class: 'marca' }, h('img', { src: '../assets/logo.svg', alt: '', width: 30, height: 30 }), h('span', {}, 'Pinho ', h('b', {}, 'Admin'))),
            (esInstr ? [['cursos', 'Mis cursos']] : SECCIONES).map(([id, et]) => h('a', { href: `#/${id}`, class: id === seccion ? 'activo' : '' }, et,
                id === 'matriculas' && contador.pend ? h('span', { class: 'contador' }, contador.pend) : null,
                id === 'consultas' && contador.cons ? h('span', { class: 'contador' }, contador.cons) : null)),
            h('div', { class: 'separador' }),
            h('a', { href: '../campus/' }, 'Ver campus'),
            h('button', { class: 'enlace', type: 'button', onClick: async () => { await db.auth.salir(); location.href = '../campus/'; } }, 'Salir')),
        h('main', { class: 'admin-principal' }, bannerDemo(modo), ...contenido)));
    window.scrollTo(0, 0);
}

async function contadores() {
    const [m, c] = await Promise.all([db.list('matriculas', { eq: { estado: 'pendiente' } }), db.list('consultas', { eq: { atendida: false } })]);
    return { pend: m.length, cons: c.length };
}

// ---------- Resumen ----------
async function resumen(cnt) {
    const [movs, mats, eventos, cursos] = await Promise.all([db.list('movimientos'), db.list('matriculas'), db.list('eventos', { order: 'fecha' }), db.list('cursos')]);
    const mes = hoyISO().slice(0, 7);
    const del = (t) => movs.filter((m) => m.tipo === t && m.fecha.startsWith(mes)).reduce((s, m) => s + Number(m.monto), 0);
    const prox = eventos.filter((e) => e.fecha >= hoyISO()).slice(0, 5);
    marco('resumen', cnt, h('h1', {}, 'Resumen'),
        h('div', { class: 'kpis' },
            h('div', { class: 'kpi ingreso' }, h('small', {}, `Ingresos de ${mesEtiqueta(mes)}`), h('b', {}, soles(del('ingreso')))),
            h('div', { class: 'kpi gasto' }, h('small', {}, `Gastos de ${mesEtiqueta(mes)}`), h('b', {}, soles(del('gasto')))),
            h('div', { class: 'kpi' }, h('small', {}, 'Pagos por validar'), h('b', {}, cnt.pend)),
            h('div', { class: 'kpi' }, h('small', {}, 'Alumnos con curso activo'), h('b', {}, new Set(mats.filter((m) => m.estado === 'activa').map((m) => m.user_id)).size)),
            h('div', { class: 'kpi' }, h('small', {}, 'Consultas sin atender'), h('b', {}, cnt.cons))),
        h('div', { class: 'rejilla-2' },
            h('div', { class: 'panel' }, h('h3', {}, 'Próximas fechas'),
                prox.length ? h('ul', { class: 'lista-check' }, prox.map((e) => h('li', {}, `${fechaCorta(e.fecha)}${e.hora ? ' ' + e.hora : ''}: ${e.titulo}`))) : h('p', { class: 'vacio' }, 'No hay fechas próximas. Agrégalas en Planificación.')),
            h('div', { class: 'panel' }, h('h3', {}, 'Cursos'), h('p', {}, `${cursos.filter((c) => c.publicado).length} publicados de ${cursos.length}.`),
                h('a', { class: 'boton sec peq', href: '#/cursos' }, 'Gestionar cursos'))));
}

// ---------- Cursos y clases ----------
const camposCurso = [
    { n: 'titulo', l: 'Título', req: true }, { n: 'slug', l: 'Dirección (opcional)', ayuda: 'Se genera sola a partir del título.' },
    { n: 'subtitulo', l: 'Subtítulo' }, { n: 'descripcion', l: 'Descripción', t: 'textarea' },
    { n: 'nivel', l: 'Nivel', t: 'select', op: [['Básico', 'Básico'], ['Intermedio', 'Intermedio'], ['Avanzado', 'Avanzado']] },
    { n: 'horas', l: 'Horas (opcional)', t: 'number', min: 0, paso: '0.5' }, { n: 'precio', l: 'Precio (S/)', t: 'number', min: 0, paso: '0.01', req: true },
    { n: 'modalidad', l: 'Modalidad' }, { n: 'incluye', l: 'Qué incluye (uno por línea)', t: 'textarea' },
    { n: 'temario', l: 'Temario (uno por línea)', t: 'textarea' }, { n: 'orden', l: 'Orden en la web', t: 'number', min: 0 },
    { n: 'publicado', l: 'Publicado en la web', t: 'checkbox' },
    { n: 'certificado_auto', l: 'Emitir el certificado automáticamente al aprobar la evaluación', t: 'checkbox' },
    { n: 'nota_minima', l: 'Nota mínima aprobatoria (sobre 20)', t: 'number', min: 1, req: true },
    { n: 'intentos_max', l: 'Intentos permitidos en la evaluación', t: 'number', min: 1, req: true },
    { n: 'preguntas_por_examen', l: 'Preguntas que se sortean del banco en cada intento', t: 'number', min: 1, req: true }];

async function cursos(cnt) {
    let lista = await db.list('cursos', { order: 'orden' });
    if (esInstr) { const asig = (await db.list('cursos_instructores', { eq: { user_id: sesion.user.id } })).map((x) => x.curso_id); lista = lista.filter((c) => asig.includes(c.id)); }
    const editar = async (c) => {
        const v = c ? { ...c, incluye: (c.incluye || []).join('\n'), temario: (c.temario || []).join('\n') } : { precio: 500, modalidad: 'Virtual', orden: lista.length + 1, nota_minima: 14, intentos_max: 3, preguntas_por_examen: 10, certificado_auto: false };
        const d = await pedirFormulario({ titulo: c ? 'Editar curso' : 'Nuevo curso', campos: camposCurso, valores: v });
        if (!d) return;
        const fila = { ...d, slug: crearSlug(d.slug || d.titulo), incluye: linea(d.incluye), temario: linea(d.temario) };
        await seguro(async () => { c ? await db.update('cursos', c.id, fila) : await db.insert('cursos', fila); aviso('Curso guardado.', 'ok'); cursos(cnt); });
    };
    marco('cursos', cnt, h('h1', {}, esInstr ? 'Mis cursos' : 'Cursos y clases'),
        esInstr ? null : h('div', { class: 'barra-herramientas' }, h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: () => editar(null) }, 'Nuevo curso')),
        tabla([{ t: 'Curso', f: (c) => c.titulo }, { t: 'Nivel', f: (c) => c.nivel }, { t: 'Precio', num: true, f: (c) => soles(c.precio) },
            { t: 'Estado', f: (c) => h('span', { class: `etiqueta ${c.publicado ? 'ok' : ''}` }, c.publicado ? 'Publicado' : 'Borrador') },
            { t: '', f: (c) => h('div', { class: 'acciones-fila' },
                h('a', { class: 'boton sec peq', href: `#/clases/${c.id}` }, 'Clases y material'),
                esInstr ? null : h('button', { class: 'boton sec peq', onClick: () => editar(c) }, 'Editar'),
                esInstr ? null : h('button', { class: 'boton peligro peq', onClick: async () => { if (await confirmar(`¿Eliminar "${c.titulo}" con sus clases y matrículas?`, 'Eliminar', true)) seguro(async () => { await db.remove('cursos', c.id); cursos(cnt); }); } }, 'Eliminar')) }],
            lista, esInstr ? 'Aún no tienes cursos asignados. Pídele al administrador que te asigne uno.' : 'Aún no hay cursos.'));
}

async function clases(cnt, cursoId) {
    const [[curso], lecc, mats] = await Promise.all([db.list('cursos', { eq: { id: cursoId } }), db.list('lecciones', { eq: { curso_id: cursoId }, order: 'orden' }), db.list('materiales', { eq: { curso_id: cursoId } })]);
    if (!curso) return cursos(cnt);
    const campL = [{ n: 'titulo', l: 'Título de la clase', req: true }, { n: 'video_url', l: 'Enlace de YouTube (no listado)', t: 'url', ayuda: 'Pega el enlace del video.' },
        { n: 'fecha_clase', l: 'Fecha de la clase en vivo (opcional)', t: 'date', ayuda: 'Es la fecha en que se habilita la clase: desde ese día el alumno ve el video y el material, y la clase queda abierta. Sin fecha, o con fecha futura, el alumno no ve nada. Mientras no pegues el enlace del video, verá que la clase se emitirá ese día.' },
        { n: 'hora_clase', l: 'Horario (opcional)', ayuda: 'Por ejemplo: 7:00 p. m. a 9:00 p. m.' },
        { n: 'descripcion', l: 'Descripción', t: 'textarea' }, { n: 'orden', l: 'Orden', t: 'number', min: 0, req: true }];
    const campM = [{ n: 'titulo', l: 'Título', req: true }, { n: 'archivo', l: 'Archivo (PDF, PowerPoint, Word, Excel…; máx. 50 MB)', t: 'file', ayuda: 'Se guarda en la página y solo lo descargan los alumnos matriculados.' },
        { n: 'url', l: 'O un enlace externo (opcional)', t: 'url' },
        { n: 'leccion_id', l: 'Clase a la que pertenece', t: 'select', op: [['', 'Todo el curso (material general)'], ...lecc.map((l) => [l.id, `${l.orden}. ${l.titulo}`])] },
        { n: 'tipo', l: 'Tipo', t: 'select', op: [['Documento', 'Documento'], ['Hoja de cálculo', 'Hoja de cálculo'], ['Presentación', 'Presentación'], ['Plantilla', 'Plantilla'], ['Otro', 'Otro']] }];
    const edL = async (l) => { const d = await pedirFormulario({ titulo: l ? 'Editar clase' : 'Nueva clase', campos: campL, valores: l || { orden: lecc.length + 1 } });
        if (d) { if (!d.fecha_clase) d.fecha_clase = null; seguro(async () => { l ? await db.update('lecciones', l.id, d) : await db.insert('lecciones', { ...d, curso_id: cursoId }); clases(cnt, cursoId); }); } };
    const edM = async (m) => { const d = await pedirFormulario({ titulo: m ? 'Editar material' : 'Nuevo material', campos: campM, valores: m || {} });
        if (!d) return;
        const archivo = d.archivo; delete d.archivo;
        if (!archivo && !d.url && !(m && m.archivo_path)) return aviso('Sube un archivo o pega un enlace.', 'error');
        if (archivo && archivo.size > 50 * 1024 * 1024) return aviso('El archivo supera los 50 MB.', 'error');
        seguro(async () => {
            if (archivo) {
                const limpio = archivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
                const ruta = `${cursoId}/${Date.now()}-${limpio}`;
                await db.storage.subir(ruta, archivo, 'materiales');
                if (m && m.archivo_path) await db.storage.borrar(m.archivo_path, 'materiales').catch(() => null);
                d.archivo_path = ruta; d.archivo_nombre = archivo.name;
            }
            if (!d.url) d.url = null;
            if (!d.leccion_id) d.leccion_id = null;
            m ? await db.update('materiales', m.id, d) : await db.insert('materiales', { ...d, curso_id: cursoId });
            aviso('Material guardado.', 'ok'); clases(cnt, cursoId);
        }); };
    const borrarMat = (m) => async () => { if (await confirmar(`¿Eliminar "${m.titulo}"?`, 'Eliminar', true)) seguro(async () => {
        if (m.archivo_path) await db.storage.borrar(m.archivo_path, 'materiales').catch(() => null);
        await db.remove('materiales', m.id); clases(cnt, cursoId); }); };
    const borrar = (t, fila, id) => async () => { if (await confirmar(`¿Eliminar "${fila.titulo}"?`, 'Eliminar', true)) seguro(async () => { await db.remove(t, id); clases(cnt, cursoId); }); };
    let bloqueInstr = null;
    if (!esInstr) {
        const [asig, perf] = await Promise.all([db.list('cursos_instructores', { eq: { curso_id: cursoId } }).catch(() => []), db.list('profiles')]);
        const porId = Object.fromEntries(perf.map((p) => [p.id, p]));
        const agregar = async () => {
            const cand = perf.filter((p) => p.role !== 'admin' && !asig.some((x) => x.user_id === p.id));
            if (!cand.length) return aviso('No hay usuarios disponibles. El instructor debe registrarse primero en el campus.', 'error');
            const d = await pedirFormulario({ titulo: 'Asignar instructor', campos: [{ n: 'user_id', l: 'Usuario (debe estar registrado en el campus)', t: 'select', op: cand.map((p) => [p.id, `${p.nombre || '(sin nombre)'} · ${p.email}`]), req: true }] });
            if (!d) return;
            seguro(async () => { await db.update('profiles', d.user_id, { role: 'instructor' }); await db.insert('cursos_instructores', { curso_id: cursoId, user_id: d.user_id }); aviso('Instructor asignado.', 'ok'); clases(cnt, cursoId); });
        };
        const quitar = (x) => async () => { if (await confirmar(`¿Quitar a ${(porId[x.user_id] || {}).email || 'este usuario'} de este curso?`, 'Quitar', true)) seguro(async () => {
            await db.removeWhere('cursos_instructores', { curso_id: cursoId, user_id: x.user_id });
            const otros = await db.list('cursos_instructores', { eq: { user_id: x.user_id } });
            if (!otros.length) await db.update('profiles', x.user_id, { role: 'alumno' });
            clases(cnt, cursoId); }); };
        bloqueInstr = h('div', {}, h('div', { class: 'barra-herramientas', style: 'margin-top:2rem' }, h('h2', {}, 'Instructores del curso'), h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: agregar }, 'Asignar instructor')),
            tabla([{ t: 'Nombre', f: (x) => (porId[x.user_id] || {}).nombre || '' }, { t: 'Correo', f: (x) => (porId[x.user_id] || {}).email || '' },
                { t: '', f: (x) => h('button', { class: 'boton peligro peq', onClick: quitar(x) }, 'Quitar') }], asig, 'Este curso aún no tiene instructores. Puede subir clases y material solo en los cursos asignados.'));
    }
    marco('cursos', cnt, h('p', { class: 'migas' }, h('a', { href: '#/cursos' }, esInstr ? 'Mis cursos' : 'Cursos'), ` / ${curso.titulo}`), h('h1', {}, 'Clases y material'),
        h('div', { class: 'barra-herramientas' }, h('h2', {}, 'Clases'), h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: () => edL(null) }, 'Nueva clase')),
        tabla([{ t: 'N.º', num: true, f: (l) => l.orden }, { t: 'Clase', f: (l) => l.titulo }, { t: 'Clase en vivo', f: (l) => l.fecha_clase ? `${fechaCorta(l.fecha_clase)}${l.hora_clase ? ` · ${l.hora_clase}` : ''}` : '—' }, { t: 'Acceso del alumno', f: (l) => !l.fecha_clase ? h('span', { class: 'etiqueta aviso' }, 'Cerrada (sin fecha)') : l.fecha_clase <= hoyISO() ? h('span', { class: 'etiqueta ok' }, 'Abierta') : h('span', { class: 'etiqueta' }, 'Se abre el ' + fechaCorta(l.fecha_clase)) }, { t: 'Video', f: (l) => l.video_url ? 'Sí' : 'No' },
            { t: '', f: (l) => h('div', { class: 'acciones-fila' }, h('button', { class: 'boton sec peq', onClick: () => edL(l) }, 'Editar'), h('button', { class: 'boton peligro peq', onClick: borrar('lecciones', l, l.id) }, 'Eliminar')) }], lecc, 'Aún no hay clases.'),
        h('div', { class: 'barra-herramientas', style: 'margin-top:2rem' }, h('h2', {}, 'Material educativo'), h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: () => edM(null) }, 'Nuevo material')),
        tabla([{ t: 'Material', f: (m) => m.titulo }, { t: 'Clase', f: (m) => { const l = lecc.find((x) => x.id === m.leccion_id); return l ? `${l.orden}. ${l.titulo}` : 'Todo el curso'; } }, { t: 'Tipo', f: (m) => m.tipo }, { t: 'Origen', f: (m) => m.archivo_path ? `Archivo: ${m.archivo_nombre || ''}` : 'Enlace' }, { t: '', f: (m) => h('div', { class: 'acciones-fila' }, h('button', { class: 'boton sec peq', onClick: () => edM(m) }, 'Editar'), h('button', { class: 'boton peligro peq', onClick: borrarMat(m) }, 'Eliminar')) }], mats, 'Aún no hay material.'),
        bloqueInstr,
        h('p', { class: 'nota-pie' }, 'Los archivos que subes se guardan en un espacio privado de la página: solo los descargan alumnos con matrícula activa y quienes administran el curso.'));
}

// ---------- Matrículas y pagos ----------
async function matriculas(cnt) {
    const [mats, perfiles, cs] = await Promise.all([db.list('matriculas', { order: ['created_at', 'desc'] }), db.list('profiles'), db.list('cursos')]);
    const nombre = (id) => { const p = perfiles.find((x) => x.id === id); return p ? (p.nombre || p.email) : '(sin perfil)'; };
    const curso = (id) => (cs.find((x) => x.id === id) || {}).titulo || '(curso eliminado)';
    const lista = filtroMat === 'todas' ? mats : mats.filter((m) => m.estado === filtroMat);
    const registrarIngreso = async (m) => {
        const ya = (await db.list('movimientos', { eq: { matricula_id: m.id } })).length;
        if (!ya) await db.insert('movimientos', { fecha: hoyISO(), tipo: 'ingreso', categoria: 'Matrículas', descripcion: `${nombre(m.user_id)}: ${curso(m.curso_id)}`, monto: m.monto, matricula_id: m.id });
    };
    const aprobar = (m) => seguro(async () => { await db.update('matriculas', m.id, { estado: 'activa' }); await registrarIngreso(m); aviso('Matrícula activada e ingreso registrado.', 'ok'); matriculas(await contadores()); });
    const rechazar = async (m) => {
        const d = await pedirFormulario({ titulo: 'Rechazar matrícula', campos: [{ n: 'nota', l: 'Motivo (opcional)', t: 'textarea' }], textoGuardar: 'Rechazar' });
        if (d) seguro(async () => { await db.update('matriculas', m.id, { estado: 'rechazada', nota: d.nota }); matriculas(await contadores()); });
    };
    const verComprobante = (m) => seguro(async () => {
        if (!m.comprobante_path) return aviso('Esta matrícula no tiene comprobante.', 'error');
        const url = await db.storage.urlFirmada(m.comprobante_path);
        if (!url) return aviso('En modo demostración no se guardan los archivos.', 'error');
        window.open(url, '_blank', 'noopener');
    });
    const manual = async () => {
        const alumnos = perfiles.filter((p) => p.role === 'alumno');
        if (!alumnos.length || !cs.length) return aviso('Necesitas al menos un alumno registrado y un curso.', 'error');
        const d = await pedirFormulario({ titulo: 'Matricular manualmente', textoGuardar: 'Matricular', nota: 'Úsalo para pagos recibidos fuera de la web (efectivo, por ejemplo). Registra el ingreso automáticamente.',
            campos: [{ n: 'user_id', l: 'Alumno', t: 'select', op: alumnos.map((p) => [p.id, `${p.nombre || 'Sin nombre'} (${p.email})`]) },
                { n: 'curso_id', l: 'Curso', t: 'select', op: cs.map((c) => [c.id, c.titulo]) },
                { n: 'monto', l: 'Monto cobrado (S/)', t: 'number', min: 0, paso: '0.01', req: true },
                { n: 'metodo', l: 'Método', t: 'select', op: [['Efectivo', 'Efectivo'], ['Yape', 'Yape'], ['Plin', 'Plin'], ['Transferencia', 'Transferencia']] }],
            valores: { monto: cs[0].precio } });
        if (d) seguro(async () => { const m = await db.insert('matriculas', { ...d, estado: 'activa' }); await db.update('matriculas', m.id, { estado: 'activa', monto: d.monto }); await registrarIngreso({ ...m, monto: d.monto }); matriculas(await contadores()); });
    };
    marco('matriculas', cnt, h('h1', {}, 'Matrículas y pagos'),
        h('div', { class: 'barra-herramientas' },
            h('label', {}, 'Ver: '), (() => { const s = h('select', {}, [['pendiente', 'Por validar'], ['activa', 'Activas'], ['completada', 'Completadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([v, e]) => h('option', { value: v }, e))); s.value = filtroMat; s.addEventListener('change', async () => { filtroMat = s.value; matriculas(await contadores()); }); return s; })(),
            h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: manual }, 'Matricular manualmente')),
        tabla([{ t: 'Fecha', f: (m) => fechaCorta(m.created_at.slice(0, 10)) }, { t: 'Alumno', f: (m) => nombre(m.user_id) }, { t: 'Curso', f: (m) => curso(m.curso_id) },
            { t: 'Monto', num: true, f: (m) => soles(m.monto) }, { t: 'Pago', f: (m) => `${m.metodo || ''}${m.referencia ? ' · op. ' + m.referencia : ''}` }, { t: 'Estado', f: (m) => etiquetaEstado(m.estado) },
            { t: '', f: (m) => h('div', { class: 'acciones-fila' },
                m.comprobante_path ? h('button', { class: 'boton sec peq', onClick: () => verComprobante(m) }, 'Comprobante') : null,
                m.estado === 'pendiente' || m.estado === 'rechazada' ? h('button', { class: 'boton peq', onClick: () => aprobar(m) }, 'Aprobar') : null,
                m.estado === 'pendiente' ? h('button', { class: 'boton peligro peq', onClick: () => rechazar(m) }, 'Rechazar') : null,
                h('button', { class: 'boton sec peq', onClick: async () => { if (await confirmar('¿Eliminar esta matrícula? No se puede deshacer; el ingreso registrado en Contabilidad se conserva.', 'Eliminar', true)) seguro(async () => { await db.remove('matriculas', m.id); matriculas(await contadores()); }); } }, 'Eliminar')) }], lista, 'No hay matrículas en este estado.'));
}

// ---------- Alumnos ----------
async function alumnos(cnt) {
    const [ps, ms] = await Promise.all([db.list('profiles', { order: ['created_at', 'desc'] }), db.list('matriculas')]);
    marco('alumnos', cnt, h('h1', {}, 'Alumnos'),
        h('div', { class: 'barra-herramientas' }, h('span', { class: 'espacio' }), h('button', { class: 'boton sec', onClick: () => descargarCSV('alumnos.csv', [['Nombre', 'Correo', 'Celular', 'Cursos activos'], ...ps.map((p) => [p.nombre, p.email, p.telefono, ms.filter((m) => m.user_id === p.id && m.estado !== 'rechazada').length])]) }, 'Exportar CSV')),
        tabla([{ t: 'Nombre', f: (p) => p.nombre || '(sin nombre)' }, { t: 'Correo', f: (p) => p.email }, { t: 'Celular', f: (p) => p.telefono || '' }, { t: 'Rol', f: (p) => p.role },
            { t: 'Matrículas', num: true, f: (p) => ms.filter((m) => m.user_id === p.id && m.estado !== 'rechazada').length }], ps, 'Todavía no hay alumnos registrados.'));
}

// ---------- Certificados ----------
async function certificados(cnt) {
    const [cert, mats, perfiles, cs, lecc, prog, preg, intentos] = await Promise.all([db.list('certificados', { order: ['created_at', 'desc'] }), db.list('matriculas'), db.list('profiles'), db.list('cursos'), db.list('lecciones'), db.list('progreso'), db.list('preguntas').catch(() => []), db.list('intentos').catch(() => [])]);
    const completo = (m) => { const ls = lecc.filter((l) => l.curso_id === m.curso_id); return ls.length > 0 && ls.every((l) => prog.some((p) => p.user_id === m.user_id && p.leccion_id === l.id)); };
    const aprobo = (m) => !preg.some((p) => p.curso_id === m.curso_id) || intentos.some((i) => i.user_id === m.user_id && i.curso_id === m.curso_id && i.aprobado);
    const candidatos = mats.filter((m) => (m.estado === 'activa' || m.estado === 'completada') && completo(m) && aprobo(m) && !cert.some((c) => c.user_id === m.user_id && c.curso_id === m.curso_id));
    const emitir = async (m) => {
        const p = perfiles.find((x) => x.id === m.user_id), c = cs.find((x) => x.id === m.curso_id);
        if (!p || !c) return;
        const d = await pedirFormulario({ titulo: 'Emitir certificado', textoGuardar: 'Emitir', nota: 'Revisa cómo está escrito el nombre: así saldrá en el certificado.',
            campos: [{ n: 'alumno_nombre', l: 'Nombre en el certificado', req: true }, { n: 'horas', l: 'Horas del curso (opcional)', t: 'number', min: 0, paso: '0.5' }], valores: { alumno_nombre: p.nombre, horas: c.horas } });
        if (!d) return;
        seguro(async () => { await db.insert('certificados', { codigo: generarCodigo(), user_id: m.user_id, curso_id: m.curso_id, alumno_nombre: d.alumno_nombre, curso_titulo: c.titulo, horas: d.horas, fecha_emision: hoyISO(), revocado: false });
            await db.update('matriculas', m.id, { estado: 'completada' }); aviso('Certificado emitido.', 'ok'); certificados(cnt); });
    };
    marco('certificados', cnt, h('h1', {}, 'Certificados'),
        h('h2', {}, 'Listos para emitir'),
        tabla([{ t: 'Alumno', f: (m) => (perfiles.find((x) => x.id === m.user_id) || {}).nombre || '' }, { t: 'Curso', f: (m) => (cs.find((x) => x.id === m.curso_id) || {}).titulo || '' },
            { t: '', f: (m) => h('button', { class: 'boton peq', onClick: () => emitir(m) }, 'Emitir certificado') }], candidatos, 'Ningún alumno ha completado todas las clases y aprobado la evaluación pendientes de certificar.'),
        h('h2', { style: 'margin-top:2rem' }, 'Emitidos'),
        tabla([{ t: 'Código', f: (c) => c.codigo }, { t: 'Alumno', f: (c) => c.alumno_nombre }, { t: 'Curso', f: (c) => c.curso_titulo }, { t: 'Fecha', f: (c) => fechaCorta(c.fecha_emision) },
            { t: 'Estado', f: (c) => h('span', { class: `etiqueta ${c.revocado ? 'error' : 'ok'}` }, c.revocado ? 'Anulado' : 'Vigente') },
            { t: '', f: (c) => h('div', { class: 'acciones-fila' }, h('a', { class: 'boton sec peq', href: `../certificado.html?c=${encodeURIComponent(c.codigo)}`, target: '_blank', rel: 'noopener' }, 'Ver'),
                h('button', { class: 'boton sec peq', onClick: async () => { if (await confirmar(c.revocado ? '¿Restablecer este certificado?' : '¿Anular este certificado? Dejará de verificarse como válido.', c.revocado ? 'Restablecer' : 'Anular', !c.revocado)) seguro(async () => { await db.update('certificados', c.id, { revocado: !c.revocado }); certificados(cnt); }); } }, c.revocado ? 'Restablecer' : 'Anular'),
                h('button', { class: 'boton sec peq', onClick: async () => { if (await confirmar(`¿Eliminar el certificado ${c.codigo}? Dejará de existir y no podrá verificarse.`, 'Eliminar', true)) seguro(async () => { await db.remove('certificados', c.id); certificados(cnt); }); } }, 'Eliminar')) }], cert, 'Aún no emitiste certificados.'));
}

// ---------- Planificación ----------
async function planificacion(cnt) {
    const [eventos, tareas, cs] = await Promise.all([db.list('eventos', { order: 'fecha' }), db.list('tareas', { order: ['created_at', 'asc'] }), db.list('cursos')]);
    const [anio, mes] = mesCal.split('-').map(Number);
    const primero = new Date(anio, mes - 1, 1), dias = new Date(anio, mes, 0).getDate(), desfase = (primero.getDay() + 6) % 7;
    const mover = (d) => { const f = new Date(anio, mes - 1 + d, 1); mesCal = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; planificacion(cnt); };
    const campE = [{ n: 'titulo', l: 'Título', req: true }, { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'hora', l: 'Hora (opcional)', t: 'time' },
        { n: 'curso_id', l: 'Curso', t: 'select', op: [['', 'Sin curso'], ...cs.map((c) => [c.id, c.titulo])] }, { n: 'nota', l: 'Nota', t: 'textarea' }];
    const edE = async (e, fecha) => {
        const d = await pedirFormulario({ titulo: e ? 'Editar evento' : 'Nuevo evento', campos: campE, valores: e || { fecha } });
        if (!d) return; const fila = { ...d, curso_id: d.curso_id || null };
        seguro(async () => { e ? await db.update('eventos', e.id, fila) : await db.insert('eventos', fila); planificacion(cnt); });
    };
    const menuEvento = async (e) => { const m = abrirModal({ titulo: e.titulo, cuerpo: h('p', {}, `${fechaCorta(e.fecha)}${e.hora ? ' · ' + e.hora : ''}${e.nota ? ' — ' + e.nota : ''}`),
        acciones: [{ texto: 'Cerrar', clase: 'sec', onClick: (a) => a.cerrar() }, { texto: 'Eliminar', clase: 'peligro', onClick: (a) => { a.cerrar(); seguro(async () => { await db.remove('eventos', e.id); planificacion(cnt); }); } }, { texto: 'Editar', onClick: (a) => { a.cerrar(); edE(e); } }] }); return m; };
    const celdas = [...Array(desfase).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
    const campT = [{ n: 'titulo', l: 'Tarea', req: true }, { n: 'fecha', l: 'Fecha límite (opcional)', t: 'date' }, { n: 'estado', l: 'Estado', t: 'select', op: [['por_hacer', 'Por hacer'], ['en_curso', 'En curso'], ['hecha', 'Hecha']] }, { n: 'nota', l: 'Nota', t: 'textarea' }];
    const edT = async (t) => { const d = await pedirFormulario({ titulo: t ? 'Editar tarea' : 'Nueva tarea', campos: campT, valores: t || { estado: 'por_hacer' } });
        if (d) seguro(async () => { const fila = { ...d, fecha: d.fecha || null }; t ? await db.update('tareas', t.id, fila) : await db.insert('tareas', fila); planificacion(cnt); }); };
    const sig = { por_hacer: 'en_curso', en_curso: 'hecha' };
    const columna = (est, tit) => h('div', { class: 'columna' }, h('h4', {}, tit), tareas.filter((t) => t.estado === est).map((t) => h('div', { class: 'nota' },
        h('strong', {}, t.titulo), t.fecha ? h('p', {}, `Hasta ${fechaCorta(t.fecha)}`) : null, t.nota ? h('p', {}, t.nota) : null,
        h('div', { class: 'acciones-fila' }, sig[est] ? h('button', { class: 'boton peq', onClick: () => seguro(async () => { await db.update('tareas', t.id, { estado: sig[est] }); planificacion(cnt); }) }, 'Avanzar') : null,
            h('button', { class: 'boton sec peq', onClick: () => edT(t) }, 'Editar'),
            h('button', { class: 'boton peligro peq', onClick: () => seguro(async () => { if (await confirmar('¿Eliminar la tarea?', 'Eliminar', true)) { await db.remove('tareas', t.id); planificacion(cnt); } }) }, 'Eliminar')))));
    marco('planificacion', cnt, h('h1', {}, 'Planificación'),
        h('div', { class: 'cal-cab' }, h('button', { class: 'boton sec peq', onClick: () => mover(-1) }, 'Anterior'), h('h3', {}, mesEtiqueta(mesCal)), h('button', { class: 'boton sec peq', onClick: () => mover(1) }, 'Siguiente'),
            h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: () => edE(null, hoyISO()) }, 'Nuevo evento')),
        h('div', { class: 'calendario' }, ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => h('div', { class: 'cal-dia-nombre' }, d)),
            celdas.map((n) => { if (!n) return h('div', { class: 'dia fuera' }); const f = `${mesCal}-${String(n).padStart(2, '0')}`;
                return h('div', { class: `dia ${f === hoyISO() ? 'hoy' : ''}`, onClick: (ev) => { if (ev.target === ev.currentTarget || ev.target.classList.contains('num')) edE(null, f); } }, h('span', { class: 'num' }, n),
                    eventos.filter((e) => e.fecha === f).map((e) => h('button', { class: 'evento', type: 'button', onClick: () => menuEvento(e) }, `${e.hora ? e.hora + ' ' : ''}${e.titulo}`))); })),
        h('div', { class: 'barra-herramientas', style: 'margin-top:2rem' }, h('h2', {}, 'Tareas'), h('span', { class: 'espacio' }), h('button', { class: 'boton', onClick: () => edT(null) }, 'Nueva tarea')),
        h('div', { class: 'tablero' }, columna('por_hacer', 'Por hacer'), columna('en_curso', 'En curso'), columna('hecha', 'Hechas')));
}

// ---------- Contabilidad ----------
async function contabilidad(cnt) {
    const todos = await db.list('movimientos', { order: ['fecha', 'desc'] });
    const del = todos.filter((m) => m.fecha.startsWith(mesSel));
    const suma = (t) => del.filter((m) => m.tipo === t).reduce((s, m) => s + Number(m.monto), 0);
    const ing = suma('ingreso'), gas = suma('gasto');
    const porCat = {}; del.filter((m) => m.tipo === 'gasto').forEach((m) => { porCat[m.categoria] = (porCat[m.categoria] || 0) + Number(m.monto); });
    const campos = [{ n: 'tipo', l: 'Tipo', t: 'select', op: [['ingreso', 'Ingreso'], ['gasto', 'Gasto']] }, { n: 'fecha', l: 'Fecha', t: 'date', req: true },
        { n: 'categoria', l: 'Categoría', t: 'select', op: CATEGORIAS.map((c) => [c, c]) }, { n: 'descripcion', l: 'Descripción', req: true }, { n: 'monto', l: 'Monto (S/)', t: 'number', min: 0, paso: '0.01', req: true }];
    const ed = async (m) => { const d = await pedirFormulario({ titulo: m ? 'Editar movimiento' : 'Nuevo movimiento', campos, valores: m || { tipo: 'gasto', fecha: hoyISO(), categoria: 'Otros' } });
        if (d) seguro(async () => { m ? await db.update('movimientos', m.id, d) : await db.insert('movimientos', d); contabilidad(cnt); }); };
    const selMes = (() => { const meses = [...new Set([hoyISO().slice(0, 7), mesSel, ...todos.map((m) => m.fecha.slice(0, 7))])].sort().reverse();
        const s = h('select', {}, meses.map((v) => h('option', { value: v }, mesEtiqueta(v)))); s.value = mesSel; s.addEventListener('change', () => { mesSel = s.value; contabilidad(cnt); }); return s; })();
    const maxCat = Math.max(1, ...Object.values(porCat));
    marco('contabilidad', cnt, h('h1', {}, 'Contabilidad'),
        h('div', { class: 'barra-herramientas' }, h('label', {}, 'Mes: '), selMes, h('span', { class: 'espacio' }),
            h('button', { class: 'boton sec', onClick: () => descargarCSV(`movimientos-${mesSel}.csv`, [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'], ...del.map((m) => [m.fecha, m.tipo, m.categoria, m.descripcion, Number(m.monto).toFixed(2)])]) }, 'Exportar mes (CSV)'),
            h('button', { class: 'boton sec', onClick: () => descargarCSV('movimientos-todos.csv', [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'], ...todos.map((m) => [m.fecha, m.tipo, m.categoria, m.descripcion, Number(m.monto).toFixed(2)])]) }, 'Exportar todo'),
            h('button', { class: 'boton', onClick: () => ed(null) }, 'Nuevo movimiento')),
        h('div', { class: 'kpis' }, h('div', { class: 'kpi ingreso' }, h('small', {}, 'Ingresos'), h('b', {}, soles(ing))), h('div', { class: 'kpi gasto' }, h('small', {}, 'Gastos'), h('b', {}, soles(gas))), h('div', { class: 'kpi' }, h('small', {}, 'Resultado del mes'), h('b', {}, soles(ing - gas)))),
        Object.keys(porCat).length ? h('div', { class: 'panel' }, h('h3', {}, 'Gastos por categoría'), Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) =>
            h('div', { class: 'fila-barra gasto' }, h('span', {}, c), h('div', { class: 'barra' }, h('i', { style: `width:${Math.round(v * 100 / maxCat)}%` })), h('b', {}, soles(v))))) : null,
        tabla([{ t: 'Fecha', f: (m) => fechaCorta(m.fecha) }, { t: 'Tipo', f: (m) => h('span', { class: `etiqueta ${m.tipo === 'ingreso' ? 'ok' : 'aviso'}` }, m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') }, { t: 'Categoría', f: (m) => m.categoria },
            { t: 'Descripción', f: (m) => m.descripcion }, { t: 'Monto', num: true, f: (m) => soles(m.monto) },
            { t: '', f: (m) => h('div', { class: 'acciones-fila' }, h('button', { class: 'boton sec peq', onClick: () => ed(m) }, 'Editar'),
                h('button', { class: 'boton peligro peq', onClick: async () => { if (await confirmar('¿Eliminar este movimiento?', 'Eliminar', true)) seguro(async () => { await db.remove('movimientos', m.id); contabilidad(cnt); }); } }, 'Eliminar')) }], del, 'No hay movimientos en este mes.'),
        h('p', { class: 'nota-pie' }, 'Este módulo es un control interno de ingresos y gastos. No reemplaza tu contabilidad tributaria ni la emisión de comprobantes electrónicos; consulta con tu contador para esas obligaciones.'));
}

// ---------- Consultas ----------
async function consultas(cnt) {
    const lista = await db.list('consultas', { order: ['created_at', 'desc'] });
    marco('consultas', cnt, h('h1', {}, 'Consultas'), lista.length ? lista.map((c) => h('div', { class: 'panel' },
        h('div', { class: 'barra-herramientas' }, h('strong', {}, c.nombre), h('a', { href: `mailto:${c.email}` }, c.email), h('span', { class: 'espacio' }), h('small', {}, fechaCorta(c.created_at.slice(0, 10))), h('span', { class: `etiqueta ${c.atendida ? 'ok' : 'aviso'}` }, c.atendida ? 'Atendida' : 'Sin atender')),
        h('p', { style: 'white-space:pre-wrap' }, c.mensaje),
        h('div', { class: 'acciones' }, h('button', { class: 'boton sec peq', onClick: () => seguro(async () => { await db.update('consultas', c.id, { atendida: !c.atendida }); consultas(await contadores()); }) }, c.atendida ? 'Marcar sin atender' : 'Marcar atendida'),
            h('button', { class: 'boton peligro peq', onClick: async () => { if (await confirmar('¿Eliminar la consulta?', 'Eliminar', true)) seguro(async () => { await db.remove('consultas', c.id); consultas(await contadores()); }); } }, 'Eliminar')))) : h('p', { class: 'vacio' }, 'No hay consultas.'));
}

// ---------- Ajustes ----------
async function ajustes(cnt) {
    const [a = {}] = await db.list('ajustes');
    const f = formulario([{ n: 'instituto', l: 'Nombre comercial' }, { n: 'titular', l: 'Titular de las cuentas' }, { n: 'yape', l: 'Número de Yape' }, { n: 'plin', l: 'Número de Plin' },
        { n: 'cuenta', l: 'Cuenta bancaria (banco, número y CCI)', t: 'textarea', filas: 3 }, { n: 'instrucciones_pago', l: 'Instrucciones de pago para el alumno', t: 'textarea' },
        { n: 'whatsapp', l: 'WhatsApp de contacto (con código de país)', ayuda: 'Aparece en la sección Contacto de la web.' }, { n: 'email_contacto', l: 'Correo de contacto', t: 'email' }], a);
    const b = h('button', { class: 'boton', type: 'submit' }, 'Guardar ajustes'); f.el.append(b);
    f.el.addEventListener('submit', () => seguro(async () => { await db.update('ajustes', 1, f.leer()); aviso('Ajustes guardados.', 'ok'); }));
    marco('ajustes', cnt, h('h1', {}, 'Ajustes'), h('p', { class: 'sub' }, 'Estos datos se muestran a los alumnos al matricularse y en la sección Contacto.'), h('div', { class: 'panel estrecho' }, f.el),
        modo === 'demo' ? h('div', { class: 'panel estrecho' }, h('h3', {}, 'Datos de demostración'), h('p', {}, 'Borra todo lo guardado en este navegador para empezar de cero.'),
            h('button', { class: 'boton peligro', onClick: async () => { if (await confirmar('¿Borrar los datos de demostración?', 'Borrar', true)) { db.reiniciarDemo(); location.href = '../campus/'; } } }, 'Reiniciar demostración')) : null);
}


// ---------- Consola SQL ----------
let ultimoSQL = '';
let ultimoResultado = null;

const dividirSQL = (texto) => texto.split(/;[ \t]*(?:\r?\n|$)/).map((q) => q.trim()).filter(Boolean);
const modifica = (q) => !/^(select|with|values)\b/i.test(q.trim());

function pintarResultados(caja, resultado, sentencias) {
    ultimoResultado = null;
    const bloques = resultado.map((r, i) => {
        if (r.tipo === 'comando') return h('div', { class: 'aviso ok' }, `Instrucción ${i + 1}: se afectaron ${r.afectadas} fila(s).`);
        const filas = r.filas || [];
        if (!filas.length) return h('div', { class: 'aviso' }, `Consulta ${i + 1}: sin resultados.`);
        const cols = Object.keys(filas[0]);
        const texto = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
        ultimoResultado = [cols, ...filas.map((f) => cols.map((c) => texto(f[c])))];
        return h('div', {},
            h('p', { class: 'sub' }, `${filas.length} fila(s)${filas.length >= 500 ? ' (se muestran las primeras 500)' : ''}`),
            tabla(cols.map((c) => ({ t: c, f: (f) => texto(f[c]) })), filas));
    });
    const csv = ultimoResultado ? h('button', { class: 'boton sec peq', onClick: () => descargarCSV('consulta.csv', ultimoResultado) }, 'Exportar CSV') : null;
    caja.replaceChildren(csv, ...bloques);
}

async function consolaSQL(cnt) {
    const editor = h('textarea', { id: 'sql-editor', rows: 12, spellcheck: 'false', placeholder: 'Escribe una consulta o elige una receta de la lista…',
        style: 'width:100%;font-family:ui-monospace,Consolas,monospace;font-size:.9rem;line-height:1.45' });
    editor.value = ultimoSQL;
    const salida = h('div', { id: 'sql-salida', style: 'margin-top:1rem' });
    const ejecutar = h('button', { class: 'boton', type: 'button' }, 'Ejecutar');

    const elegir = async (rec) => {
        let valores = {};
        if (rec.params && rec.params.length) {
            valores = await pedirFormulario({ titulo: rec.titulo, textoGuardar: 'Cargar receta', nota: rec.detalle,
                campos: rec.params.map((p) => ({ n: p.n, l: p.l, t: p.t === 'number' ? 'number' : 'text', req: true, paso: p.t === 'number' ? '0.01' : undefined })),
                valores: Object.fromEntries(rec.params.map((p) => [p.n, p.v])) });
            if (!valores) return;
        }
        try { editor.value = armarSQL(rec, valores); } catch (e) { return aviso(mensajeError(e), 'error'); }
        ultimoSQL = editor.value;
        salida.replaceChildren(rec.modifica
            ? h('div', { class: 'aviso' }, 'Esta receta modifica datos. Revisa el texto y pulsa Ejecutar para confirmarla.')
            : h('div', { class: 'aviso' }, 'Receta cargada. Pulsa Ejecutar.'));
        editor.focus();
    };

    ejecutar.addEventListener('click', async () => {
        const sentencias = dividirSQL(editor.value);
        if (!sentencias.length) return aviso('Escribe una consulta o elige una receta.', 'error');
        ultimoSQL = editor.value;
        if (sentencias.some(modifica)) {
            const n = sentencias.filter(modifica).length;
            if (!await confirmar(`Vas a ejecutar ${n} instrucción(es) que modifican datos. No se pueden deshacer. ¿Continuar?`, 'Ejecutar', true)) return;
        }
        ejecutar.disabled = true;
        salida.replaceChildren(h('p', { class: 'cargando' }, 'Ejecutando…'));
        try {
            const resultado = await db.rpc('admin_sql', { p_consultas: sentencias });
            pintarResultados(salida, resultado, sentencias);
        } catch (e) {
            const msg = mensajeError(e);
            const falta = /admin_sql|Could not find the function|schema cache/i.test(msg);
            salida.replaceChildren(h('div', { class: 'aviso error' }, falta
                ? 'La consola aún no está activada en tu base de datos. Ejecuta el archivo supabase/admin_sql.sql en el SQL Editor de Supabase.'
                : `Error: ${msg}`));
        } finally { ejecutar.disabled = false; }
    });

    const lista = RECETAS.map((g) => h('div', { class: 'panel', style: 'padding:.9rem 1rem' },
        h('h3', { style: 'margin:0 0 .5rem' }, g.grupo),
        g.items.map((r) => h('button', { class: `boton sec peq ${r.modifica ? '' : ''}`, type: 'button', title: r.detalle,
            style: 'display:block;width:100%;text-align:left;margin-bottom:.35rem', onClick: () => elegir(r) }, r.titulo))));

    marco('sql', cnt, h('h1', {}, 'Consola SQL'),
        h('p', { class: 'sub' }, 'Elige una receta o escribe tu propia consulta. Se ejecuta con tus permisos de administrador; no puede crear ni borrar tablas.'),
        modo === 'demo' ? h('div', { class: 'aviso' }, 'La consola solo funciona conectada a Supabase.') : null,
        h('div', { class: 'rejilla-2', style: 'grid-template-columns:minmax(220px,1fr) 2fr;align-items:start' },
            h('div', {}, lista),
            h('div', {}, editor, h('div', { class: 'acciones', style: 'margin-top:.6rem' }, ejecutar,
                h('button', { class: 'boton sec', type: 'button', onClick: () => { editor.value = ''; ultimoSQL = ''; salida.replaceChildren(); } }, 'Limpiar')), salida)));
}

// ---------- Enrutador ----------
async function render() {
    try {
        sesion = sesion || await db.auth.sesion();
        if (!sesion) return raiz.replaceChildren(h('main', { class: 'app-principal contenedor' }, h('h1', {}, 'Administración'), h('p', {}, 'Entra primero al campus con tu cuenta de administrador.'), h('a', { class: 'boton', href: '../campus/' }, 'Ir al campus')));
        esInstr = sesion.perfil.role === 'instructor';
        if (sesion.perfil.role !== 'admin' && !esInstr) return raiz.replaceChildren(h('main', { class: 'app-principal contenedor' }, h('h1', {}, 'Acceso restringido'), h('p', {}, 'Tu cuenta no tiene permisos de administración.'), h('a', { class: 'boton', href: '../campus/' }, 'Volver al campus')));
        const cnt = esInstr ? {} : await contadores();
        const [, ruta = 'resumen', id] = location.hash.split('/');
        const mapa = { resumen, cursos, matriculas, alumnos, certificados, planificacion, contabilidad, consultas, sql: consolaSQL, ajustes };
        if (ruta === 'clases') return await clases(cnt, id);
        if (esInstr) return await cursos(cnt);
        return await (mapa[ruta] || resumen)(cnt);
    } catch (e) {
        raiz.replaceChildren(h('main', { class: 'app-principal contenedor' }, h('h1', {}, 'No se pudo cargar'), h('p', {}, mensajeError(e)), h('button', { class: 'boton', onClick: render }, 'Reintentar')));
    }
}
window.addEventListener('hashchange', render);
render();
