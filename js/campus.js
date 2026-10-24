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
    if (sesion.perfil.role === 'instructor') nav.append(h('a', { href: '../admin/' }, 'Panel de instructor'));
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
// Descarga el material. Si pertenece a una clase, avisa para registrar la descarga.
async function descargar(m, alDescargar) {
    try {
        const url = await db.storage.urlFirmada(m.archivo_path, 'materiales', m.archivo_nombre || true);
        if (!url) return aviso('En modo demostración no hay archivos para descargar.', 'error');
        if (alDescargar) alDescargar();
        window.location.assign(url);
    } catch (e) { aviso(mensajeError(e), 'error'); }
}

// Seguimiento del video con la API de YouTube: cuenta el tiempo realmente reproducido (los saltos no suman).
let detenerVideo = null;
function cargarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!cargarYT.p) cargarYT.p = new Promise((res) => {
        const previo = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (previo) previo(); res(); };
        const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.append(sc);
    });
    return cargarYT.p;
}
async function seguirVideo(caja, videoId, pctInicial, alCambiar) {
    await cargarYT();
    const lugar = h('div');
    caja.replaceChildren(lugar);
    let vistos = null, ultimo = null, dur = 0, pct = pctInicial, guardado = pctInicial;
    const guardar = () => { if (pct > guardado) { guardado = pct; alCambiar(pct); } };
    const reproductor = new window.YT.Player(lugar, {
        videoId, host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onStateChange: (e) => { if (e.data !== 1) { ultimo = null; guardar(); } } }
    });
    const reloj = setInterval(() => {
        try {
            if (reproductor.getPlayerState() !== 1) return;
            dur = reproductor.getDuration();
            if (!dur) return;
            if (vistos === null) vistos = pctInicial / 100 * dur;
            const t = reproductor.getCurrentTime();
            if (ultimo !== null) { const d = t - ultimo; if (d > 0 && d <= 2.6) vistos += d; }
            ultimo = t;
            pct = Math.min(100, Math.floor(vistos / dur * 100));
            if (pct >= guardado + 5 || (pct >= 90 && guardado < 90)) guardar();
        } catch { /* el reproductor aún no está listo */ }
    }, 1000);
    detenerVideo = () => { clearInterval(reloj); guardar(); try { reproductor.destroy(); } catch { /* ya no existe */ } detenerVideo = null; };
}

async function vistaAula(cursoId, leccionId) {
    if (detenerVideo) detenerVideo();
    mostrar(h('p', { class: 'cargando' }, 'Cargando el aula…'));
    const [mats, [curso]] = await Promise.all([db.list('matriculas', { eq: { user_id: sesion.user.id, curso_id: cursoId } }), db.list('cursos', { eq: { id: cursoId } })]);
    if (!curso || !mats.some((m) => m.estado === 'activa' || m.estado === 'completada') && sesion.perfil.role !== 'admin')
        return mostrar(h('h1', {}, 'Sin acceso'), h('p', {}, 'Este curso aún no está habilitado en tu cuenta.'), h('a', { class: 'boton', href: '#/' }, 'Volver'));
    const [lecc, materiales, progreso, certs, avances, intentos, info] = await Promise.all([
        db.list('lecciones', { eq: { curso_id: cursoId }, order: 'orden' }), db.list('materiales', { eq: { curso_id: cursoId } }),
        db.list('progreso', { eq: { user_id: sesion.user.id } }), db.list('certificados', { eq: { user_id: sesion.user.id, curso_id: cursoId } }),
        db.list('avance', { eq: { user_id: sesion.user.id } }).catch(() => []),
        db.list('intentos', { eq: { user_id: sesion.user.id, curso_id: cursoId } }).catch(() => []),
        db.rpc('examen_info', { p_curso: cursoId }).catch(() => null)]);
    const hechas = new Set(progreso.map((p) => p.leccion_id));
    const av = new Map(avances.map((a) => [a.leccion_id, a]));
    const actual = lecc.find((l) => l.id === leccionId) || lecc.find((l) => !hechas.has(l.id)) || lecc[0];
    const vid = actual && youtubeId(actual.video_url);
    const matClase = (l) => materiales.filter((m) => m.leccion_id === l.id && (m.archivo_path || urlSegura(m.url)));
    // Una clase exige lo que tenga: video al 90 % y/o material descargado.
    const estado = (l) => {
        const a = av.get(l.id) || {}, nv = !!youtubeId(l.video_url), nm = matClase(l).length > 0;
        const pct = a.video_pct || 0, desc = !!a.descargado;
        const pend = !nv && !!l.fecha_clase;   // clase programada cuyo video aún no se publicó
        return { nv, nm, pend, pct, desc, listo: !pend && (!nv || pct >= 90) && (!nm || desc) };
    };
    const total = lecc.length;
    const examen = !!(info && info.preguntas > 0);
    const cert = certs.find((c) => !c.revocado);

    const chipVideo = h('span', { class: 'etiqueta' }), chipMat = h('span', { class: 'etiqueta' });
    const nota = h('p', { class: 'sub' });
    const marcasLista = new Map();
    const barra = h('i'), textoAvance = h('p', { class: 'sub' }), cajaExamen = h('div');
    const btnManual = h('button', { class: 'boton', type: 'button', onClick: () => guardarAvance(actual, {}) }, 'Marcar como vista');

    const pintarExamen = () => {
        if (!examen) { cajaExamen.replaceChildren(); return; }
        const aprobado = intentos.find((i) => i.aprobado), usados = intentos.length, max = curso.intentos_max || 3, min = curso.nota_minima || 14;
        const mejor = intentos.reduce((m, i) => Math.max(m, Number(i.nota)), 0);
        const todas = total > 0 && lecc.every((l) => hechas.has(l.id));
        let cuerpo;
        if (aprobado) cuerpo = [h('p', { class: 'aviso ok' }, `Aprobaste con nota ${aprobado.nota} / 20.`),
            cert ? h('a', { class: 'boton peq', href: `../certificado.html?c=${encodeURIComponent(cert.codigo)}`, target: '_blank', rel: 'noopener' }, 'Ver mi certificado')
                 : h('p', { class: 'sub' }, curso.certificado_auto ? 'Tu certificado se está generando.' : 'El instructor emitirá tu certificado en breve.')];
        else if (usados >= max && sesion.perfil.role !== 'admin') cuerpo = [h('p', { class: 'aviso error' }, `Usaste tus ${max} intentos (mejor nota: ${mejor} / 20). Escribe al instructor si necesitas otra oportunidad.`)];
        else if (todas) cuerpo = [h('p', { class: 'sub' }, `Intento ${usados + 1} de ${max}. Nota mínima: ${min} sobre 20.`),
            h('a', { class: 'boton', href: `#/examen/${cursoId}` }, 'Rendir la evaluación')];
        else cuerpo = [h('p', { class: 'sub' }, 'Se habilita cuando completes las clases: ve el video al 90 % y descarga el material de cada una.')];
        cajaExamen.replaceChildren(h('div', { class: 'panel' }, h('h3', {}, 'Evaluación final'), ...cuerpo));
    };
    const pintar = () => {
        const e = estado(actual);
        chipVideo.hidden = !e.nv; chipMat.hidden = !e.nm;
        chipVideo.className = `etiqueta ${e.pct >= 90 ? 'ok' : 'aviso'}`; chipVideo.textContent = `Video: ${Math.min(e.pct, 100)} %${e.pct >= 90 ? ' ✓' : ' (mínimo 90 %)'}`;
        chipMat.className = `etiqueta ${e.desc ? 'ok' : 'aviso'}`; chipMat.textContent = e.desc ? 'Material descargado ✓' : 'Material por descargar';
        btnManual.hidden = e.nv || e.nm || e.pend || hechas.has(actual.id);
        nota.textContent = (e.nv || e.nm) ? (hechas.has(actual.id) ? 'Clase completada.' : 'La clase se marca sola cuando ves el 90 % del video y descargas el material.') : '';
        for (const l of lecc) { const m = marcasLista.get(l.id); m.a.classList.toggle('hecha', hechas.has(l.id)); m.marca.textContent = hechas.has(l.id) ? '✓' : ''; }
        const n = lecc.filter((l) => hechas.has(l.id)).length;
        barra.style.width = `${total ? Math.round(n * 100 / total) : 0}%`; textoAvance.textContent = `${n} de ${total} clases`;
        pintarExamen();
    };
    const guardarAvance = async (l, parche) => {
        try {
            const previo = av.get(l.id) || {};
            const a = { user_id: sesion.user.id, leccion_id: l.id, video_pct: previo.video_pct || 0, descargado: !!previo.descargado, ...parche };
            a.video_pct = Math.max(previo.video_pct || 0, a.video_pct);
            const e = estado(l);
            if (!e.nv && !e.pend) a.video_pct = 100;
            if (!e.nm) a.descargado = true;
            a.actualizado = new Date().toISOString();
            await db.upsert('avance', a, ['user_id', 'leccion_id']);
            av.set(l.id, a);
            if (estado(l).listo && !hechas.has(l.id)) {
                await db.insert('progreso', { user_id: sesion.user.id, leccion_id: l.id }, { retornar: false });
                hechas.add(l.id); aviso('¡Clase completada!', 'ok');
            }
        } catch (err) { aviso(mensajeError(err), 'error'); }
        pintar();
    };

    const panelMaterial = (titulo, lista, alDescargar) => {
        const ver = lista.filter((m) => m.archivo_path || urlSegura(m.url));
        return ver.length ? h('div', { class: 'panel' }, h('h3', {}, titulo),
            h('ul', { class: 'lista-check' }, ver.map((m) =>
                h('li', {}, m.archivo_path
                    ? h('a', { href: '#', onClick: (e) => { e.preventDefault(); descargar(m, alDescargar); } }, m.titulo)
                    : h('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer', onClick: alDescargar }, m.titulo), ` (${m.tipo || 'Documento'})`)))) : null;
    };
    const aviso_sin_video = actual && actual.fecha_clase
        ? h('div', { class: 'sin-video' }, h('div', {}, h('strong', {}, 'Esta clase se emitirá en vivo'), h('br'),
            `${fechaLarga(actual.fecha_clase)}${actual.hora_clase ? `, ${actual.hora_clase}` : ''}`, h('br'),
            'La grabación aparecerá aquí cuando el instructor la publique.'))
        : h('div', { class: 'sin-video' }, 'Esta clase no tiene video.');
    const cajaVideo = h('div', { class: 'video' }, vid ? null : aviso_sin_video);
    mostrar(h('p', { class: 'migas' }, h('a', { href: '#/' }, 'Mis cursos'), ` / ${curso.titulo}`),
        h('h1', {}, curso.titulo),
        !lecc.length ? h('div', { class: 'panel' }, 'El instructor aún no publicó las clases de este curso.') :
        h('div', { class: 'aula' },
            h('div', {},
                cajaVideo,
                h('h2', {}, actual.titulo), h('p', {}, actual.descripcion || ''),
                h('div', { class: 'acciones' }, chipVideo, chipMat, btnManual), nota,
                panelMaterial('Material de esta clase', matClase(actual), () => guardarAvance(actual, { descargado: true })),
                panelMaterial('Material del curso', materiales.filter((m) => !m.leccion_id))),
            h('aside', {},
                h('div', { class: 'panel' }, h('h3', {}, 'Tu avance'),
                    h('div', { class: 'barra' }, barra), textoAvance,
                    cert ? h('a', { class: 'boton peq', href: `../certificado.html?c=${encodeURIComponent(cert.codigo)}`, target: '_blank', rel: 'noopener' }, 'Ver mi certificado') : null),
                cajaExamen,
                h('ol', { class: 'lecciones' }, lecc.map((l) => {
                    const marca = h('span', { class: 'marca-leccion' });
                    const a = h('a', { href: `#/aula/${cursoId}/${l.id}`, class: l.id === actual.id ? 'actual' : '' }, marca, h('span', {}, l.titulo, (!youtubeId(l.video_url) && l.fecha_clase) ? h('small', { class: 'fecha-clase' }, `En vivo: ${fechaLarga(l.fecha_clase)}`) : null));
                    marcasLista.set(l.id, { a, marca });
                    return h('li', {}, a);
                })))));
    pintar();
    if (vid) seguirVideo(cajaVideo, vid, estado(actual).pct, (pct) => guardarAvance(actual, { video_pct: pct }));
}

// ---------- Evaluación final ----------
const mezclar = (lista) => {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

async function vistaExamen(cursoId) {
    if (detenerVideo) detenerVideo();
    mostrar(h('p', { class: 'cargando' }, 'Cargando la evaluación…'));
    const volver = h('a', { class: 'boton sec', href: `#/aula/${cursoId}` }, 'Volver al aula');
    let preguntas, curso;
    try {
        [[curso], preguntas] = await Promise.all([db.list('cursos', { eq: { id: cursoId } }), db.rpc('examen_preguntas', { p_curso: cursoId })]);
    } catch (e) { return mostrar(h('h1', {}, 'Evaluación final'), h('p', {}, mensajeError(e)), volver); }
    if (!preguntas || !preguntas.length) return mostrar(h('h1', {}, 'Evaluación final'), h('p', {}, 'Este curso aún no tiene evaluación.'), volver);
    const orden = mezclar(preguntas);
    const campos = new Map();
    const bloques = orden.map((q, i) => {
        let entrada;
        if (q.tipo === 'opcion') {
            const radios = mezclar(q.opciones.map((t, k) => ({ t, k }))).map((o) => {
                const r = h('input', { type: 'radio', name: `p-${q.id}`, value: String(o.k) });
                return { r, el: h('label', { class: 'opcion' }, r, h('span', {}, o.t)) };
            });
            campos.set(q.id, () => { const x = radios.find((o) => o.r.checked); return x ? x.r.value : ''; });
            entrada = h('div', { class: 'opciones' }, radios.map((o) => o.el));
        } else {
            const inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'numero', placeholder: 'Escribe tu respuesta' });
            campos.set(q.id, () => inp.value.trim());
            entrada = inp;
        }
        return h('div', { class: 'panel pregunta' }, h('h3', {}, `${i + 1}. ${q.enunciado}`), entrada);
    });
    const enviar = h('button', { class: 'boton', type: 'button' }, 'Enviar mis respuestas');
    enviar.addEventListener('click', async () => {
        const respuestas = {}; let faltan = 0;
        for (const [id, leer] of campos) { respuestas[id] = leer(); if (!respuestas[id]) faltan++; }
        if (faltan) return aviso(`Te falta responder ${faltan} pregunta${faltan > 1 ? 's' : ''}.`, 'error');
        enviar.disabled = true;
        try {
            const r = await db.rpc('examen_enviar', { p_curso: cursoId, p_respuestas: respuestas });
            resultado(r);
        } catch (e) { aviso(mensajeError(e), 'error'); enviar.disabled = false; }
    });
    const resultado = (r) => {
        const porId = new Map((r.detalle || []).map((d) => [d.id, d]));
        mostrar(h('h1', {}, r.aprobado ? '¡Aprobaste la evaluación!' : 'Aún no alcanzas la nota mínima'),
            h('div', { class: 'panel' }, h('p', { class: 'nota-final' }, `${r.nota} / 20`),
                h('p', { class: 'sub' }, `Nota mínima: ${r.nota_minima}. Intento ${r.intento} de ${r.intentos_max}.`),
                r.certificado ? h('p', { class: 'aviso ok' }, 'Tu certificado ya fue emitido. Lo encuentras en el aula.')
                    : (r.aprobado ? h('p', { class: 'aviso ok' }, 'El instructor emitirá tu certificado en breve.') :
                       (r.intento < r.intentos_max ? h('p', { class: 'aviso' }, 'Repasa el material y vuelve a intentarlo: las preguntas cambian de orden.') : null))),
            ...orden.map((q, i) => { const d = porId.get(q.id) || {};
                return h('div', { class: `panel pregunta ${d.ok ? 'bien' : 'mal'}` }, h('h3', {}, `${i + 1}. ${q.enunciado}`),
                    h('p', { class: 'veredicto' }, d.ok ? '✓ Correcta' : '✗ Incorrecta'), d.explicacion ? h('p', { class: 'sub' }, d.explicacion) : null); }),
            h('div', { class: 'acciones' }, volver));
    };
    mostrar(h('p', { class: 'migas' }, h('a', { href: '#/' }, 'Mis cursos'), ` / ${curso ? curso.titulo : ''}`), h('h1', {}, 'Evaluación final'),
        h('p', { class: 'sub' }, `${orden.length} preguntas. Nota mínima ${curso ? curso.nota_minima : 14} sobre 20. En las preguntas con cifras, escribe el valor de tu propio ejemplo en Civil 3D.`),
        ...bloques, h('div', { class: 'acciones' }, enviar, volver));
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
        if (ruta === 'examen') return await vistaExamen(a);
        if (ruta === 'perfil') return vistaPerfil();
        return await vistaInicio();
    } catch (e) {
        mostrar(h('h1', {}, 'No se pudo cargar'), h('p', {}, mensajeError(e)), h('button', { class: 'boton', onClick: render }, 'Reintentar'));
    }
}
window.addEventListener('hashchange', render);
render();
