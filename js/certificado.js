// Certificado imprimible (A4 horizontal) con código QR de verificación.

import { db } from './db.js';
import { CONFIG } from './config.js';
import { $, h, fechaLarga, mensajeError, urlSegura } from './ui.js';

const codigo = (new URLSearchParams(location.search).get('c') || '').trim();
const salida = $('#salida');
$('#imprimir').addEventListener('click', () => window.print());

function qr(texto) {
    const cont = h('div', { class: 'qr', 'aria-label': 'Código QR de verificación' });
    try {
        const q = window.qrcode(0, 'M');
        q.addData(texto);
        q.make();
        cont.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); // SVG generado localmente, sin datos del usuario
    } catch { cont.textContent = ''; }
    return cont;
}

try {
    const filas = codigo ? await db.rpc('verificar_certificado', { p_codigo: codigo }) : [];
    const c = filas && filas[0];
    if (!c || c.revocado) {
        salida.replaceChildren(h('div', { class: 'resultado invalido' },
            h('h2', {}, c ? 'Certificado anulado' : 'No encontramos ese certificado'),
            h('p', {}, 'Revisa el código o verifícalo en la página de verificación.')));
    } else {
        const base = location.origin + location.pathname.replace(/[^/]*$/, '');
        const enlace = `${base}verificar.html?c=${encodeURIComponent(c.codigo)}`;
        const avales = (CONFIG.avales || []).filter((a) => urlSegura(a.logo)).map((a) =>
            h('img', { src: a.logo, alt: a.nombre || 'Aval' }));
        const cabecera = () => h('div', { class: 'cab' },
            h('img', { src: 'assets/logo.svg', alt: '' }),
            h('div', {}, h('b', {}, CONFIG.marca.nombre), h('small', {}, 'Inteligencia artificial aplicada a la ingeniería')));
        const temario = (c.temario || []).filter(Boolean);
        const nota = c.nota === null || c.nota === undefined || c.nota === '' ? null : String(Number(c.nota)).replace('.', ',');
        const frente = h('section', { class: 'hoja' },
            cabecera(),
            h('div', { class: 'centro' },
                h('div', { class: 'tipo' }, 'Certificado de finalización'),
                h('div', { class: 'otorga' }, 'Se otorga a'),
                h('div', { class: 'nombre' }, c.alumno_nombre),
                h('div', { class: 'detalle' }, 'por haber completado satisfactoriamente el curso'),
                h('div', { class: 'c-nombre' }, c.curso_titulo),
                h('div', { class: 'detalle' }, [c.horas ? `${c.horas} horas` : null, nota ? `Nota final: ${nota} / 20` : null, `Emitido el ${fechaLarga(c.fecha_emision)}`].filter(Boolean).join(' · ')),
                avales.length ? h('div', { class: 'avales' }, avales) : null),
            h('div', { class: 'pie-cert' },
                h('div', { class: 'firma' }, CONFIG.marca.firma ? h('img', { src: CONFIG.marca.firma, alt: 'Firma del instructor' }) : null, h('i'), h('strong', {}, CONFIG.marca.instructor), h('br'), `Instructor, ${CONFIG.marca.cip}`),
                h('div', { class: 'verif' },
                    h('div', {}, h('div', {}, 'Código ', h('strong', {}, c.codigo)), h('div', {}, 'Verifica en'), h('div', {}, enlace.replace(/^https?:\/\//, ''))),
                    qr(enlace))));
        // Reverso: contenido del curso y nota (segunda hoja del PDF).
        const reverso = h('section', { class: 'hoja reverso' },
            cabecera(),
            h('div', { class: 'cuerpo-rev' },
                h('div', { class: 'tipo-rev' }, 'Contenido del curso'),
                h('div', { class: 'c-nombre' }, c.curso_titulo),
                temario.length ? h('ol', { class: 'temario-rev' }, temario.map((t) => h('li', {}, t))) : null,
                h('div', { class: 'datos-rev' },
                    h('div', {}, h('small', {}, 'Alumno'), h('strong', {}, c.alumno_nombre)),
                    c.horas ? h('div', {}, h('small', {}, 'Duración'), h('strong', {}, `${c.horas} horas`)) : null,
                    nota ? h('div', { class: 'nota' }, h('small', {}, 'Nota final'), h('strong', {}, `${nota} / 20`)) : null,
                    h('div', {}, h('small', {}, 'Fecha de emisión'), h('strong', {}, fechaLarga(c.fecha_emision))))),
            h('div', { class: 'pie-rev' }, h('span', {}, 'Código ', h('strong', {}, c.codigo)), h('span', {}, `Verifica en ${enlace.replace(/^https?:\/\//, '')}`)));
        salida.replaceChildren(frente, reverso);
        document.title = `Certificado ${c.codigo}`;
    }
} catch (e) {
    salida.replaceChildren(h('p', {}, mensajeError(e)));
}
