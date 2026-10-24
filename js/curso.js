// Detalle público de un curso.

import { db, CURSOS_SEMILLA } from './db.js';
import { $, h, soles } from './ui.js';

const slug = new URLSearchParams(location.search).get('c') || '';
const caja = $('#detalle');

async function buscar() {
    try {
        const lista = await db.list('cursos', { eq: { slug } });
        return lista[0] || null;
    } catch {
        return CURSOS_SEMILLA.find((c) => c.slug === slug) || null;
    }
}

function noEncontrado() {
    caja.replaceChildren(
        h('h1', {}, 'No encontramos ese curso'),
        h('p', {}, 'Puede que el enlace esté incompleto o que el curso ya no esté disponible.'),
        h('a', { class: 'boton', href: './#cursos' }, 'Ver todos los cursos'));
}

const curso = await buscar();

if (!curso) {
    noEncontrado();
} else {
    document.title = `${curso.titulo} | Ingeniería Pinho`;
    const datos = [['Nivel', curso.nivel], ['Modalidad', curso.modalidad || 'Virtual']];
    if (curso.horas) datos.push(['Duración', `${curso.horas} horas`]);

    caja.replaceChildren(
        h('p', { class: 'migas' }, h('a', { href: './#cursos' }, 'Cursos'), ` / ${curso.titulo}`),
        h('div', { class: 'detalle-rejilla' },
            h('div', {},
                h('h1', {}, curso.titulo),
                curso.subtitulo ? h('p', { style: 'font-size:1.2rem;color:var(--tinta-2)' }, curso.subtitulo) : null,
                h('p', {}, curso.descripcion),
                h('img', { class: 'afiche-curso', src: `assets/cursos/${curso.slug}.jpg`, alt: `Afiche y temario del curso ${curso.titulo}`, loading: 'lazy',
                    style: 'display:block;width:100%;max-width:420px;height:auto;margin:1.4rem 0;border:2px solid var(--tinta)',
                    onError: (e) => e.target.remove() }),
                (curso.incluye || []).length
                    ? h('div', {}, h('h3', { style: 'margin:1.6rem 0 .4rem' }, 'Qué incluye'),
                        h('ul', { class: 'lista-check' }, curso.incluye.map((t) => h('li', {}, t))))
                    : null,
                (curso.temario || []).length
                    ? h('div', {}, h('h3', { style: 'margin:1.8rem 0 .6rem' }, 'Temario'),
                        h('ol', { class: 'temario' }, curso.temario.map((t) => h('li', {}, t))))
                    : null),
            h('aside', { class: 'caja-matricula' },
                h('div', { class: 'curso-cab' }, h('span', {}, 'Matrícula'), h('span', {}, `Nivel ${String(curso.nivel).toLowerCase()}`)),
                h('div', { class: 'cuerpo' },
                    h('p', { class: 'precio' }, soles(curso.precio)),
                    h('ul', { class: 'lista-check' }, datos.map(([k, v]) => h('li', {}, `${k}: ${v}`))),
                    h('p', { class: 'ayuda', style: 'margin-top:1rem' },
                        'Pagas por Yape, Plin o transferencia y subes tu comprobante. Activamos tu acceso al validar el pago.'),
                    h('a', { class: 'boton casco', style: 'width:100%', href: `campus/#/matricula/${encodeURIComponent(curso.slug)}` }, 'Matricularme')))));
}
