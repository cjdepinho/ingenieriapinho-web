// Utilidades de interfaz compartidas por el sitio, el campus y el panel.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/** Crea elementos del DOM sin usar innerHTML (evita inyección de código). */
export function h(etiqueta, atributos = {}, ...hijos) {
    const el = document.createElement(etiqueta);
    let valorPendiente;
    for (const [k, v] of Object.entries(atributos || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'value') valorPendiente = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const hijo of hijos.flat(Infinity)) {
        if (hijo === null || hijo === undefined || hijo === false) continue;
        el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
    }
    if (valorPendiente !== undefined) el.value = valorPendiente;
    return el;
}

// ---------- Fechas y montos (el mes siempre se escribe "septiembre") ----------

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function partes(iso) {
    const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
    return { a, m, d };
}

export function fechaLarga(iso) {
    const { a, m, d } = partes(iso);
    if (!a || !m || !d) return '';
    return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function fechaCorta(iso) {
    const { a, m, d } = partes(iso);
    if (!a || !m || !d) return '';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

export function mesEtiqueta(aaaamm) {
    const [a, m] = String(aaaamm).split('-').map(Number);
    return `${MESES[m - 1]} de ${a}`;
}

const formatoSoles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export const soles = (n) => formatoSoles.format(Number(n) || 0);

// ---------- Textos y enlaces ----------

export function urlSegura(url) {
    try {
        const u = new URL(url, location.href);
        return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
    } catch { return null; }
}

export function youtubeId(texto) {
    const t = String(texto || '').trim();
    if (/^[\w-]{11}$/.test(t)) return t;
    const m = t.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
}

export function crearSlug(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function generarCodigo() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const suf = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
    return `PINHO-${new Date().getFullYear()}-${suf}`;
}

export function mensajeError(e) {
    return (e && e.message) ? e.message : String(e);
}

// ---------- Avisos y ventanas ----------

export function aviso(texto, tipo = '') {
    let caja = document.querySelector('.avisos');
    if (!caja) {
        caja = h('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
        document.body.append(caja);
    }
    const el = h('div', { class: `aviso-flotante ${tipo}` }, texto);
    caja.append(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 7000 : 3800);
}

export function abrirModal({ titulo, cuerpo, acciones = [] }) {
    let resolver;
    const promesa = new Promise((r) => { resolver = r; });
    const fondo = h('div', { class: 'modal-fondo', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    const api = {
        promesa,
        cerrar(valor = null) {
            document.removeEventListener('keydown', alTeclear);
            fondo.remove();
            resolver(valor);
        }
    };
    const alTeclear = (e) => { if (e.key === 'Escape') api.cerrar(null); };
    const botones = acciones.map((a) => h('button',
        { type: 'button', class: `boton ${a.clase || ''}`, onClick: () => a.onClick(api) }, a.texto));
    fondo.append(h('div', { class: 'modal' },
        h('h2', { class: 'modal-titulo' }, titulo), cuerpo,
        h('div', { class: 'modal-acciones' }, botones)));
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) api.cerrar(null); });
    document.addEventListener('keydown', alTeclear);
    document.body.append(fondo);
    const primero = fondo.querySelector('input, select, textarea, button');
    if (primero) primero.focus();
    return api;
}

export function confirmar(mensaje, textoOk = 'Confirmar', peligro = false) {
    const m = abrirModal({
        titulo: 'Confirma la acción',
        cuerpo: h('p', {}, mensaje),
        acciones: [
            { texto: 'Cancelar', clase: 'sec', onClick: (api) => api.cerrar(false) },
            { texto: textoOk, clase: peligro ? 'peligro' : '', onClick: (api) => api.cerrar(true) }
        ]
    });
    return m.promesa;
}

/**
 * Construye un formulario a partir de una lista de campos.
 * campo: { n, l, t (text|number|textarea|select|date|time|checkbox|url|email|file), req, ayuda,
 *          op: [[valor, etiqueta]], paso, min, max, mitad }
 */
export function formulario(campos, valores = {}) {
    const entradas = {};
    const filas = campos.map((c) => {
        let entrada;
        const v = valores[c.n];
        if (c.t === 'textarea') {
            entrada = h('textarea', { id: `f-${c.n}`, name: c.n, rows: c.filas || 4 });
            entrada.value = v ?? '';
        } else if (c.t === 'select') {
            entrada = h('select', { id: `f-${c.n}`, name: c.n },
                (c.op || []).map(([val, et]) => h('option', { value: val }, et)));
            entrada.value = v ?? (c.op && c.op[0] ? c.op[0][0] : '');
        } else if (c.t === 'checkbox') {
            entrada = h('input', { id: `f-${c.n}`, name: c.n, type: 'checkbox' });
            entrada.checked = Boolean(v);
        } else {
            entrada = h('input', {
                id: `f-${c.n}`, name: c.n, type: c.t || 'text',
                step: c.paso, min: c.min, max: c.max, list: c.lista, accept: c.accept
            });
            if (c.t !== 'file') entrada.value = v ?? '';
        }
        if (c.req && c.t !== 'checkbox') entrada.required = true;
        entradas[c.n] = entrada;
        const ayuda = c.ayuda ? h('span', { class: 'ayuda' }, c.ayuda) : null;
        if (c.t === 'checkbox') {
            return h('div', { class: 'campo check' }, entrada, h('label', { for: `f-${c.n}` }, c.l));
        }
        return h('div', { class: 'campo' }, h('label', { for: `f-${c.n}` }, c.l), entrada, ayuda);
    });
    const el = h('form', { novalidate: true }, h('div', { class: 'fila-campos' }, filas));
    el.addEventListener('submit', (e) => e.preventDefault());

    function leer() {
        const salida = {};
        for (const c of campos) {
            const e = entradas[c.n];
            if (c.t === 'checkbox') salida[c.n] = e.checked;
            else if (c.t === 'number') salida[c.n] = e.value === '' ? null : Number(e.value);
            else if (c.t === 'file') salida[c.n] = e.files[0] || null;
            else salida[c.n] = e.value.trim();
        }
        return salida;
    }

    function faltantes() {
        const datos = leer();
        return campos.filter((c) => c.req && c.t !== 'checkbox' &&
            (datos[c.n] === '' || datos[c.n] === null || datos[c.n] === undefined)).map((c) => c.l);
    }

    return { el, leer, faltantes, entradas };
}

/** Abre un formulario en una ventana; devuelve los datos o null si se cancela. */
export function pedirFormulario({ titulo, campos, valores = {}, textoGuardar = 'Guardar', nota = null }) {
    const f = formulario(campos, valores);
    const cuerpo = h('div', {}, nota ? h('p', { class: 'ayuda' }, nota) : null, f.el);
    return abrirModal({
        titulo,
        cuerpo,
        acciones: [
            { texto: 'Cancelar', clase: 'sec', onClick: (api) => api.cerrar(null) },
            {
                texto: textoGuardar,
                onClick: (api) => {
                    const falta = f.faltantes();
                    if (falta.length) { aviso(`Completa: ${falta.join(', ')}.`, 'error'); return; }
                    api.cerrar(f.leer());
                }
            }
        ]
    }).promesa;
}

// ---------- Tablas y archivos ----------

/** cols: [{ t: 'Título', f: (fila) => nodo|texto, num: bool }] */
export function tabla(cols, filas, vacio = 'No hay registros.') {
    if (!filas.length) return h('div', { class: 'tabla-caja' }, h('p', { class: 'vacio' }, vacio));
    return h('div', { class: 'tabla-caja' }, h('table', {},
        h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: c.num ? 'num' : '' }, c.t)))),
        h('tbody', {}, filas.map((fila) => h('tr', {},
            cols.map((c) => h('td', { class: c.num ? 'num' : '' }, c.f(fila))))))));
}

export function descargarCSV(nombre, filas) {
    const esc = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const texto = '﻿' + filas.map((f) => f.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function etiquetaEstado(estado) {
    const tipos = {
        pendiente: ['aviso', 'Pendiente de validación'],
        activa: ['ok', 'Activa'],
        completada: ['info', 'Completada'],
        rechazada: ['error', 'Rechazada']
    };
    const [clase, texto] = tipos[estado] || ['', estado];
    return h('span', { class: `etiqueta ${clase}` }, texto);
}

export function bannerDemo(modo) {
    if (modo !== 'demo') return null;
    return h('div', { class: 'banner-demo' },
        'Modo demostración: los datos se guardan solo en este navegador. Conecta Supabase para usar datos reales.');
}
