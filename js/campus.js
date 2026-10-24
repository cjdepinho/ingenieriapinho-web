// Campus virtual del alumno: acceso, matrícula con comprobante, aula, progreso y certificados.

import { db, modo } from './db.js';
import { $, h, aviso, soles, fechaLarga, urlSegura, youtubeId, mensajeError,
         formulario, etiquetaEstado, bannerDemo } from './ui.js';

const vista = $('#vista');
const nav = $('#nav');
let sesion = null;

const ir = (ruta) => { location.hash = ruta; };

function pintarNav() {
    nav.replaceChildren();
    if (!sesion) return;
    nav.append(h('a', { href: '#/' }, 'Mis cursos'), h('a', { href: '../#cursos' }, 'Catálogo'));
    if (sesion.perfil.role === 'admin') nav.append(h('a', { href: '../admin/' }, 'Administración'));
    nav.append(h('a', { href: '#/perfil' }, 'Mi perfil'),
        h('button', { class: 'enlace', type: 'button', onClick: async () => { await db.auth.salir(); sesion = null; ir('#/'); render(); } }, 'Salir'));
}

function mostrar(...nodos) {
    vista.replaceChildren(...[bannerDemo(modo), ...nodos].filter(Boolean));
    window.scrollTo(0, 0);
}

// ---------- Acceso ----------
function vistaAcceso(destino) {
    let registrando = false;
    const caja = h('div', { class: 'panel estrecho' });
    const dibujar = () => {
        const campos = registrando
            ? [{ n: 'nombre', l: 'Nombre y apellidos', req: true }, { n: 'telefono', l: 'Celular (opcional)', t: 'tel' },
               { n: 'email', l: 'Correo electrónico', t: 'email', req: true },
               { n: 'password', l: 'Contraseña', t: 'password', req: true, ayuda: 'Mínimo 8 caracteres.' }]
            : [{ n: 'email', l: 'Correo electrónico', t: 'email', req: true },
               ...(modo === 'demo' ? [] : [{ n: 'password', l: 'Contraseña', t: 'password', req: true }])];
        const f = formulario(campos);
        const boton = h('button', { class: 'boton', type: 'submit' }, registrando ? 'Crear cuenta' : 'Entrar');
        f.el.append(boton);
        f.el.addEventListener('submit', async () => {
            const falta = f.faltantes();
            if (falta.length) return aviso(`Completa: ${falta.join(', ')}.`, 'error');
            const d = f.leer();
            if (registrando && d.password.length < 8) return aviso('La contraseña debe tener al menos 8 caracteres.', 'error');
            boton.disabled = true;
            try {
                if (registrando) {
                    const r = await db.auth.registrar(d);
                    if (r.confirmar) {
                        caja.replaceChildren(h('h2', {}, 'Revisa tu correo'),
                            h('p', {}, 'Te enviamos un enlace para confirmar tu cuenta. Después de confirmarla, vuelve aquí y entra.'));
                        return;
                    }
                } else {
                    await db.auth.entrar(d);
                }
                sesion = await db.auth.sesion();
                ir(destino || '#/'); render();
            } catch (e) { aviso(mensajeError(e), 'error'); } finally { boton.disabled = false; }
        });
        const demo = modo === 'demo' ? h('div', { class: 'aviso' },
            h('p', { style: 'margin:0 0 .6rem' }, 'Para probar sin crear datos:'),
            h('div', { class: 'acciones' },
                h('button', { class: 'boton sec peq', type: 'button', onClick: async () => { await db.auth.entrarDemo('alumno'); sesion = await db.auth.sesion(); ir(destino || '#/'); render(); } }, 'Entrar como alumno de prueba'),
                h('button', { class: 'boton sec peq', type: 'button', onClick: async () => { await db.auth.entrarDemo('admin'); sesion = await db.auth.sesion(); ir('#/'); render(); } }, 'Entrar como administrador de prueba'))) : null;
        caja.replaceChildren(h('h2', {}, registrando ? 'Crea tu cuenta' : 'Entra al campus'), f.el, demo || '',
            h('p', { style: 'margin-top:1rem' }, registrando ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? ',
                h('a', { href: '#', onClick: (e) => { e.preventDefault(); registrando = !registrando; dibujar(); } }, registrando ? 'Entrar' : 'Crear cuenta')));
    };
    dibujar();
    mostrar(h('h1', {}, 'Campus virtual'), h('p', { class: 'sub' }, 'Accede a tus cursos, material y certificados.'), caja);
}

// ---------- Mis cursos ----------
async function vistaInicio() {
    mostrar(h('p', { class: 'cargando' }, 'Cargando tus cursos…'));
    const [mats, cursos, lecciones, progreso, certs] = await Promise.all([
        db.list('matriculas', { eq: { user_id: sesion.user.id }, order: ['created_at', 'desc'] }),
        db.list('cursos'), db.list('lecciones'), db.list('progreso', { eq: { user_id: sesion.user.id } }),
        db.list('certificados', { eq: { user_id: sesion.user.id } })]);
    const tarjetas = mats.filter((m) => m.estado !== 'rechazada').map((m) => {
        const c = cursos.find((x) => x.id === m.curso_id); if (!c) return null;
        const ls = lecciones.filter((l) => l.curso_id === c.id);
        const hechas = ls.filter((l) => progreso.some((p) => p.leccion_id === l.id)).length;
        const pct = ls.length ? Math.round(hechas * 100 / ls.length) : 0;
        const cert = certs.find((x) => x.curso_id === c.id && !x.revocado);
        const activa = m.estado === 'activa' || m.estado === 'completada';
        return h('article', { class: 'tarjeta' },
            etiquetaEstado(m.estado), h('h3', {}, c.titulo),
            activa ? h('div', {}, h('div', { class: 'barra', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${pct}%` })),
                h('p', { class: 'sub' }, `${hechas} de ${ls.length} clases · ${pct}%`))
                : h('p', { class: 'sub' }, 'Estamos validando tu pago. Te habilitaremos el curso al confirmarlo.'),
            h('div', { class: 'pie-tarjeta' },
                activa ? h('a', { class: 'boton peq', href: `#/aula/${c.id}` }, 'Ir al aula') : null,
                cert ? h('a', { class: 'boton sec peq', href: `../certificado.html?c=${encodeURIComponent(cert.codigo)}`, target: '_blank', rel: 'noopener' }, 'Ver certificado') : null));
    }).filter(Boolean);
    const rechazadas = mats.filter((m) => m.estado === 'rechazada').length;
    mostrar(h('h1', {}, `Hola, ${sesion.perfil.nombre || 'alumno'}`), h('p', { class: 'sub' }, 'Tus cursos'),
        rechazadas ? h('div', { class: 'aviso error' }, `Tienes ${rechazadas} matrícula(s) rechazada(s). Revisa tu comprobante y vuelve a matricularte, o escríbenos.`) : null,
        tarjetas.length ? h('div', { class: 'tarjetas' }, tarjetas)
            : h('div', { class: 'panel' }, h('p', {}, 'Aún no tienes cursos.'), h('a', { class: 'boton', href: '../#cursos' }, 'Ver los cursos disponibles')));
}

// ---------- Matrícula ----------
async function vistaMatricula(slug) {
    const [curso] = await db.list('cursos', { eq: { slug } });
    if (!curso) return mostrar(h('h1', {}, 'Curso no encontrado'), h('a', { class: 'boton', href: '../#cursos' }, 'Ver cursos'));
    const [existentes, aj] = await Promise.all([db.list('matriculas', { eq: { user_id: sesion.user.id, curso_id: curso.id } }), db.list('ajustes')]);
    const vigente = existentes.find((m) => m.estado !== 'rechazada');
    if (vigente) return mostrar(h('h1', {}, curso.titulo), h('div', { class: 'aviso ok' }, 'Ya tienes una matrícula en este curso.'), h('a', { class: 'boton', href: '#/' }, 'Ir a mis cursos'));
    const a = aj[0] || {};
    const f = formulario([
        { n: 'metodo', l: 'Método de pago', t: 'select', op: [['Yape', 'Yape'], ['Plin', 'Plin'], ['Transferencia', 'Transferencia bancaria']], req: true },
        { n: 'referencia', l: 'Número de operación', req: true, ayuda: 'Aparece en la constancia de tu pago.' },
        { n: 'comprobante', l: 'Captura o foto del comprobante', t: 'file', accept: 'image/*,application/pdf', req: true, ayuda: 'Imagen o PDF de hasta 5 MB.' }]);
    const boton = h('button', { class: 'boton casco', type: 'submit' }, 'Enviar matrícula');
    f.el.append(boton);
    f.el.addEventListener('submit', async () => {
        const falta = f.faltantes(); if (falta.length) return aviso(`Completa: ${falta.join(', ')}.`, 'error');
        const d = f.leer();
        if (d.comprobante.size > 5 * 1024 * 1024) return aviso('El archivo supera los 5 MB.', 'error');
        boton.disabled = true;
        try {
            const ext = (d.comprobante.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
            const ruta = `${sesion.user.id}/${Date.now()}.${ext}`;
            await db.storage.subir(ruta, d.comprobante);
            await db.insert('matriculas', { user_id: sesion.user.id, curso_id: curso.id, estado: 'pendiente', monto: curso.precio,
                metodo: d.metodo, referencia: d.referencia, comprobante_path: ruta });
            aviso('Matrícula enviada. Validaremos tu pago pronto.', 'ok'); ir('#/'); render();
        } catch (e) { aviso(mensajeError(e), 'error'); boton.disabled = false; }
    });
    const dato = (k, v) => v ? h('li', {}, `${k}: `, h('strong', {}, v)) : null;
    mostrar(h('h1', {}, 'Matrícula'), h('p', { class: 'sub' }, `${curso.titulo} · ${soles(curso.precio)}`),
        h('div', { class: 'rejilla-2' },
            h('div', { class: 'panel' }, h('h3', {}, '1. Realiza el pago'), h('p', {}, a.instrucciones_pago || ''),
                h('ul', { class: 'lista-check' }, dato('Yape', a.yape), dato('Plin', a.plin), dato('Cuenta', a.cuenta), dato('Titular', a.titular), dato('Monto', soles(curso.precio)))),
            h('div', { class: 'panel' }, h('h3', {}, '2. Sube tu comprobante'), f.el)));
}

// ---------- Aula ----------
async function descargar(m) {
    try {
        const url = await db.storage.urlFirmada(m.archivo_path, 'materiales', m.archivo_nombre || true);
        if (!url) return aviso('En modo demostración no hay archivos para descargar.', 'error');
        window.location.assign(url);
    } catch (e) { aviso(mensajeError(e), 'error'); }
}

async function vistaAula(cursoId, leccionId) {
    mostrar(h('p', { class: 'cargando' }, 'Cargando el aula…'));
    const [mats, [curso]] = await Promise.all([db.list('matriculas', { eq: { user_id: sesion.user.id, curso_id: cursoId } }), db.list('cursos', { eq: { id: cursoId } })]);
    if (!curso || !mats.some((m) => m.estado === 'activa' || m.estado === 'completada') && sesion.perfil.role !== 'admin')
        return mostrar(h('h1', {}, 'Sin acceso'), h('p', {}, 'Este curso aún no está habilitado en tu cuenta.'), h('a', { class: 'boton', href: '#/' }, 'Volver'));
    const [lecc, materiales, progreso, certs] = await Promise.all([
        db.list('lecciones', { eq: { curso_id: cursoId }, order: 'orden' }), db.list('materiales', { eq: { curso_id: cursoId } }),
        db.list('progreso', { eq: { user_id: sesion.user.id } }), db.list('certificados', { eq: { user_id: sesion.user.id, curso_id: cursoId } })]);
    const hechas = new Set(progreso.map((p) => p.leccion_id));
    const actual = lecc.find((l) => l.id === leccionId) || lecc.find((l) => !hechas.has(l.id)) || lecc[0];
    const vid = actual && youtubeId(actual.video_url);
    const marcar = async () => {
        try {
            if (hechas.has(actual.id)) await db.removeWhere('progreso', { user_id: sesion.user.id, leccion_id: actual.id });
            else await db.insert('progreso', { user_id: sesion.user.id, leccion_id: actual.id }, { retornar: false });
            vistaAula(cursoId, actual.id);
        } catch (e) { aviso(mensajeError(e), 'error'); }
    };
    const total = lecc.length, n = lecc.filter((l) => hechas.has(l.id)).length;
    const cert = certs.find((c) => !c.revocado);
    mostrar(h('p', { class: 'migas' }, h('a', { href: '#/' }, 'Mis cursos'), ` / ${curso.titulo}`),
        h('h1', {}, curso.titulo),
        !lecc.length ? h('div', { class: 'panel' }, 'El instructor aún no publicó las clases de este curso.') :
        h('div', { class: 'aula' },
            h('div', {},
                h('div', { class: 'video' }, vid
                    ? h('iframe', { src: `https://www.youtube-nocookie.com/embed/${vid}`, title: actual.titulo, allowfullscreen: true, loading: 'lazy',
                        allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin' })
                    : h('div', { class: 'sin-video' }, 'Esta clase no tiene video.')),
                h('h2', {}, actual.titulo), h('p', {}, actual.descripcion || ''),
                h('div', { class: 'acciones' }, h('button', { class: 'boton', type: 'button', onClick: marcar }, hechas.has(actual.id) ? 'Marcar como pendiente' : 'Marcar como vista')),
                materiales.length ? h('div', { class: 'panel' }, h('h3', {}, 'Material del curso'),
                    h('ul', { class: 'lista-check' }, materiales.filter((m) => m.archivo_path || urlSegura(m.url)).map((m) =>
                        h('li', {}, m.archivo_path
                            ? h('a', { href: '#', onClick: (e) => { e.preventDefault(); descargar(m); } }, m.titulo)
                            : h('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer' }, m.titulo), ` (${m.tipo || 'Documento'})`)))) : null),
            h('aside', {},
                h('div', { class: 'panel' }, h('h3', {}, 'Tu avance'),
                    h('div', { class: 'barra' }, h('i', { style: `width:${total ? Math.round(n * 100 / total) : 0}%` })),
                    h('p', { class: 'sub' }, `${n} de ${total} clases`),
                    cert ? h('a', { class: 'boton peq', href: `../certificado.html?c=${encodeURIComponent(cert.codigo)}`, target: '_blank', rel: 'noopener' }, 'Ver mi certificado')
                        : (n === total && total ? h('p', { class: 'aviso ok' }, 'Completaste el curso. El instructor emitirá tu certificado en breve.') : null)),
                h('ol', { class: 'lecciones' }, lecc.map((l) => h('li', {}, h('a', { href: `#/aula/${cursoId}/${l.id}`, class: `${l.id === actual.id ? 'actual' : ''} ${hechas.has(l.id) ? 'hecha' : ''}` },
                    h('span', { class: 'marca-leccion' }, hechas.has(l.id) ? '✓' : ''), l.titulo)))))));
}

// ---------- Perfil ----------
function vistaPerfil() {
    const f = formulario([{ n: 'nombre', l: 'Nombre y apellidos (como saldrá en tus certificados)', req: true }, { n: 'telefono', l: 'Celular', t: 'tel' }],
        { nombre: sesion.perfil.nombre, telefono: sesion.perfil.telefono });
    const b = h('button', { class: 'boton', type: 'submit' }, 'Guardar cambios');
    f.el.append(b);
    f.el.addEventListener('submit', async () => {
        const falta = f.faltantes(); if (falta.length) return aviso('Escribe tu nombre.', 'error');
        try { await db.auth.actualizarPerfil(sesion.user.id, f.leer()); sesion = await db.auth.sesion(); aviso('Perfil actualizado.', 'ok'); }
        catch (e) { aviso(mensajeError(e), 'error'); }
    });
    mostrar(h('h1', {}, 'Mi perfil'), h('p', { class: 'sub' }, sesion.user.email), h('div', { class: 'panel estrecho' }, f.el));
}

// ---------- Enrutador ----------
async function render() {
    try {
        sesion = sesion || await db.auth.sesion();
        pintarNav();
        const [, ruta = '', a, b] = location.hash.split('/');
        if (!sesion) return vistaAcceso(location.hash.startsWith('#/matricula') ? location.hash : null);
        if (ruta === 'matricula') return await vistaMatricula(decodeURIComponent(a || ''));
        if (ruta === 'aula') return await vistaAula(a, b);
        if (ruta === 'perfil') return vistaPerfil();
        return await vistaInicio();
    } catch (e) {
        mostrar(h('h1', {}, 'No se pudo cargar'), h('p', {}, mensajeError(e)), h('button', { class: 'boton', onClick: render }, 'Reintentar'));
    }
}
window.addEventListener('hashchange', render);
render();
