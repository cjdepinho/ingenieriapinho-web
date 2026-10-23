// Sitio público: cursos, contacto y menú.

import { db, CURSOS_SEMILLA } from './db.js';
import { $, h, soles, mensajeError } from './ui.js';

// Menú en celular
const botonMenu = $('#menu-boton');
const menu = $('#menu');
botonMenu.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    botonMenu.setAttribute('aria-expanded', String(abierto));
});
menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) { menu.classList.remove('abierto'); botonMenu.setAttribute('aria-expanded', 'false'); }
});

$('#anio').textContent = `© ${new Date().getFullYear()}`;

// Cursos
function tarjetaCurso(c, i) {
    const codigo = `IA-${String(c.orden || i + 1).padStart(2, '0')}`;
    const datos = [['Modalidad', c.modalidad || 'Virtual']];
    if (c.horas) datos.push(['Duración', `${c.horas} horas`]);
    datos.push(['Certificado', 'Con código QR']);

    return h('article', { class: 'curso' },
        h('div', { class: 'curso-cab' }, h('span', {}, codigo), h('span', {}, `Nivel ${String(c.nivel || '').toLowerCase()}`)),
        h('div', { class: 'curso-cuerpo' },
            h('h3', {}, c.titulo),
            h('p', {}, c.descripcion),
            h('ul', { class: 'lista-check' }, (c.incluye || []).map((t) => h('li', {}, t)))),
        h('div', { class: 'curso-datos' }, datos.map(([k, v]) => h('div', {}, h('small', {}, k), v))),
        h('div', { class: 'curso-pie' },
            h('span', { class: 'precio' }, soles(c.precio)),
            h('a', { class: 'boton sec', href: `curso.html?c=${encodeURIComponent(c.slug)}` }, 'Ver detalles')));
}

async function cargarCursos() {
    const caja = $('#lista-cursos');
    let cursos;
    try {
        cursos = await db.list('cursos', { eq: { publicado: true }, order: 'orden' });
    } catch {
        cursos = CURSOS_SEMILLA;
    }
    caja.replaceChildren(...(cursos.length
        ? cursos.map(tarjetaCurso)
        : [h('p', {}, 'Pronto publicaremos nuevos cursos. Escríbenos si quieres que te avisemos.')]));
}

// Medios de contacto (se editan en Ajustes del panel)
async function cargarContacto() {
    let ajustes = {};
    try { ajustes = (await db.list('ajustes'))[0] || {}; } catch { /* sin datos */ }
    const lista = $('#medios-contacto');
    const items = [];
    const digitos = String(ajustes.whatsapp || '').replace(/\D/g, '');
    if (digitos) {
        items.push(h('li', {}, 'WhatsApp: ',
            h('a', { href: `https://wa.me/${digitos}`, rel: 'noopener' }, ajustes.whatsapp)));
    }
    if (ajustes.email_contacto) {
        items.push(h('li', {}, 'Correo: ', h('a', { href: `mailto:${ajustes.email_contacto}` }, ajustes.email_contacto)));
    }
    lista.replaceChildren(...items);
}

// Formulario de contacto
$('#form-contacto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const estado = $('#estado-contacto');
    const boton = $('#enviar-contacto');
    const nombre = f.nombre.value.trim();
    const email = f.email.value.trim();
    const mensaje = f.mensaje.value.trim();
    estado.className = '';

    if (!nombre || !/^\S+@\S+\.\S+$/.test(email) || mensaje.length < 5) {
        estado.className = 'mensaje-error';
        estado.textContent = 'Revisa tu nombre, un correo válido y un mensaje de al menos 5 caracteres.';
        return;
    }
    if (f.empresa.value) { // campo trampa para programas automáticos
        estado.className = 'mensaje-ok';
        estado.textContent = 'Mensaje enviado. Te responderemos pronto.';
        return;
    }
    boton.disabled = true;
    try {
        await db.insert('consultas', { nombre, email, mensaje }, { retornar: false });
        f.reset();
        estado.className = 'mensaje-ok';
        estado.textContent = 'Mensaje enviado. Te responderemos pronto.';
    } catch (err) {
        estado.className = 'mensaje-error';
        estado.textContent = `No se pudo enviar: ${mensajeError(err)}`;
    } finally {
        boton.disabled = false;
    }
});

cargarCursos();
cargarContacto();
