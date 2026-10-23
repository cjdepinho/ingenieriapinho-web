// Verificación pública de certificados por código.

import { db } from './db.js';
import { $, h, fechaLarga, mensajeError } from './ui.js';

const entrada = $('#codigo');
const salida = $('#resultado');

async function verificar(codigo) {
    const limpio = String(codigo || '').trim();
    if (!limpio) return;
    entrada.value = limpio;
    salida.replaceChildren(h('p', {}, 'Verificando…'));
    try {
        const filas = await db.rpc('verificar_certificado', { p_codigo: limpio });
        const c = filas && filas[0];
        if (!c || c.revocado) {
            salida.replaceChildren(h('div', { class: 'resultado invalido' },
                h('h2', {}, c ? 'Certificado anulado' : 'No encontramos ese código'),
                h('p', { style: 'margin:.6rem 0 0' }, c
                    ? 'Este certificado fue anulado por Ingeniería Pinho y ya no es válido.'
                    : 'Revisa que esté escrito igual que en el certificado. Si el problema continúa, escríbenos desde la página principal.')));
            return;
        }
        salida.replaceChildren(h('div', { class: 'resultado valido' },
            h('h2', { style: 'color:var(--ok)' }, 'Certificado auténtico'),
            h('dl', {},
                h('dt', {}, 'Código'), h('dd', {}, c.codigo),
                h('dt', {}, 'Otorgado a'), h('dd', {}, c.alumno_nombre),
                h('dt', {}, 'Curso'), h('dd', {}, c.curso_titulo),
                c.horas ? [h('dt', {}, 'Duración'), h('dd', {}, `${c.horas} horas`)] : null,
                h('dt', {}, 'Fecha de emisión'), h('dd', {}, fechaLarga(c.fecha_emision)))));
    } catch (e) {
        salida.replaceChildren(h('div', { class: 'resultado invalido' },
            h('h2', {}, 'No se pudo verificar'),
            h('p', { style: 'margin:.6rem 0 0' }, `${mensajeError(e)} Inténtalo de nuevo en unos minutos.`)));
    }
}

$('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('c', entrada.value.trim());
    history.replaceState(null, '', url);
    verificar(entrada.value);
});

verificar(new URLSearchParams(location.search).get('c'));
