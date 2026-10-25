// Capa de datos. La misma interfaz funciona con dos adaptadores:
//  - Supabase (cuando config.js tiene supabaseUrl y supabaseAnonKey)
//  - Demostración (datos guardados en el navegador, para probar sin conectar nada)

import { CONFIG } from './config.js';

const configurado = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
export const modo = configurado ? 'supabase' : 'demo';

export const CURSOS_SEMILLA = [
    {
        slug: 'inteligencia-artificial-para-ingenieros',
        titulo: 'Inteligencia Artificial para Ingenieros',
        subtitulo: 'Desde cero hasta usarla en tu trabajo diario',
        descripcion: 'Aprende desde cero a utilizar herramientas de Inteligencia Artificial para mejorar tu productividad profesional.',
        nivel: 'Básico', horas: 6, precio: 500, modalidad: 'Virtual',
        incluye: ["6 horas de formación virtual en 6 clases de 1 hora", "Presentaciones de cada clase", "Guía de trabajo con ejercicios prácticos", "Casos y ejercicios aplicados a ingeniería", "Certificado de 6 horas con código QR verificable"],
        temario: ["Fundamentos de la IA generativa y sus límites: qué hace, dónde falla y cómo reconocer una alucinación", "Cómo pedir bien: el método Rol, Contexto, Tarea, Formato y Criterios, e iteración", "Documentos técnicos: resumir normas y contratos; redactar cartas, informes y actas", "Datos y cálculos: tablas, hojas de cálculo, código y revisión de unidades y totales", "Verificación, criterio profesional, trazabilidad y confidencialidad de la información", "Tu flujo de trabajo y proyecto final: documento técnico asistido y verificado"], publicado: true, orden: 1
    },
    {
        slug: 'ia-para-ingenieria-civil',
        titulo: 'IA para Ingeniería Civil',
        subtitulo: 'Aplicaciones y casos prácticos de ingeniería',
        descripcion: 'Profundiza en el uso de Inteligencia Artificial mediante aplicaciones y casos prácticos de ingeniería.',
        nivel: 'Intermedio', horas: 6, precio: 500, modalidad: 'Virtual',
        incluye: ["6 horas de formación virtual en 6 clases de 1 hora", "Presentaciones de cada clase", "Guía de trabajo con ejercicios prácticos", "Casos prácticos de ingeniería civil", "Certificado de 6 horas con código QR verificable"],
        temario: ["Prediseño y comparación de alternativas con matriz multicriterio", "Memorias de cálculo y verificación: hipótesis, cargas y scripts en Python", "Metrados, presupuestos y cronogramas: partidas, APU, ruta crítica y curva S", "Inspección y supervisión: informes de campo, cuaderno de obra, ensayos y no conformidades", "Gestión contractual y documental: cartas, ampliaciones de plazo y adicionales", "Casos integrados y proyecto final"], publicado: true, orden: 2
    },
    {
        slug: 'ia-para-civil-3d-con-claude',
        titulo: 'IA para Civil 3D con Claude',
        subtitulo: 'Tu equipo de agentes de IA para proyectos viales',
        descripcion: 'Curso 100 % práctico: arma un sistema multiagente con Claude y úsalo en Civil 3D para limpiar datos topográficos, diseñar y revisar una vía, calcular volúmenes y automatizar reportes.',
        nivel: 'Intermedio', horas: 4, precio: 500, modalidad: 'En vivo',
        incluye: ["4 horas de curso en vivo en 6 módulos 100 % prácticos", "Grabación de cada clase en el campus para repasar cuando quieras", "Presentaciones de cada módulo", "Instrucciones de cada agente y scripts de ejemplo", "Práctica guiada en Civil 3D en cada módulo", "Certificado de 4 horas con código QR verificable"],
        temario: ["Tu equipo de agentes: coordinador y especialistas, y cómo trabajan juntos (30 min)", "Agente Topógrafo: del archivo de puntos a una superficie verificada en Civil 3D (45 min)", "Agente Diseñador Vial: alineamiento, perfil y tabla de cumplimiento de criterios (45 min)", "Agente Cubicador: corredor, secciones y verificación independiente de volúmenes (45 min)", "Agente Automatizador: scripts, tablas y reportes que ahorran horas de trabajo (45 min)", "Agente Revisor e integración: control de calidad y proyecto integrador de punta a punta (30 min)"], publicado: true, orden: 3
    }
];

// ====================== Adaptador de demostración ======================

const CLAVE_DEMO = 'pinho_demo_v1';

function semilla() {
    const ahora = new Date().toISOString();
    return {
        t: {
            cursos: CURSOS_SEMILLA.map((c) => ({ id: crypto.randomUUID(), created_at: ahora, ...c })),
            ajustes: [{
                id: 1, instituto: 'Ingeniería Pinho', titular: '', yape: '', plin: '', cuenta: '',
                instrucciones_pago: 'Realiza el pago por Yape, Plin o transferencia y sube la captura del comprobante.',
                whatsapp: '', email_contacto: ''
            }]
        },
        sesion: null
    };
}

function cargar() {
    try {
        const s = JSON.parse(localStorage.getItem(CLAVE_DEMO));
        if (s && s.t) return s;
    } catch { /* se recrea */ }
    const s = semilla();
    localStorage.setItem(CLAVE_DEMO, JSON.stringify(s));
    return s;
}

const guardar = (s) => localStorage.setItem(CLAVE_DEMO, JSON.stringify(s));

function ordenar(filas, orden) {
    if (!orden) return filas;
    const [col, dir = 'asc'] = [].concat(orden);
    return filas.sort((a, b) => ((a[col] > b[col]) - (a[col] < b[col])) * (dir === 'desc' ? -1 : 1));
}

const local = {
    async list(t, { eq = {}, order } = {}) {
        let filas = (cargar().t[t] || []).slice();
        for (const [k, v] of Object.entries(eq)) filas = filas.filter((r) => r[k] === v);
        return ordenar(filas, order);
    },
    async insert(t, fila) {
        const s = cargar();
        const nueva = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...fila };
        (s.t[t] = s.t[t] || []).push(nueva);
        guardar(s);
        return nueva;
    },
    async update(t, id, cambios) {
        const s = cargar();
        const fila = (s.t[t] || []).find((r) => r.id === id);
        if (!fila) throw new Error('Registro no encontrado.');
        Object.assign(fila, cambios);
        guardar(s);
        return fila;
    },
    async remove(t, id) {
        const s = cargar();
        s.t[t] = (s.t[t] || []).filter((r) => r.id !== id);
        guardar(s);
    },
    async removeWhere(t, eq) {
        const s = cargar();
        s.t[t] = (s.t[t] || []).filter((r) => !Object.entries(eq).every(([k, v]) => r[k] === v));
        guardar(s);
    },
    async upsert(t, fila, claves) {
        const s = cargar();
        const lista = (s.t[t] = s.t[t] || []);
        const existente = lista.find((r) => claves.every((k) => r[k] === fila[k]));
        if (existente) Object.assign(existente, fila);
        else lista.push({ created_at: new Date().toISOString(), ...fila });
        guardar(s);
    },
    async rpc(nombre, args) {
        if (nombre === 'cronograma') {
            const hoy = new Date().toISOString().slice(0, 10), t = cargar().t;
            return (t.lecciones || []).filter((l) => !args || !args.p_curso || l.curso_id === args.p_curso)
                .map((l) => ({ ...l, abierta: !!l.fecha_clase && l.fecha_clase <= hoy })).sort((a, b) => a.orden - b.orden);
        }
        if (nombre !== 'verificar_certificado') throw new Error('Función no disponible.');
        const codigo = String(args.p_codigo || '').trim().toUpperCase();
        const c = (cargar().t.certificados || []).find((r) => String(r.codigo).toUpperCase() === codigo);
        return c ? [{
            codigo: c.codigo, alumno_nombre: c.alumno_nombre, curso_titulo: c.curso_titulo,
            horas: c.horas, fecha_emision: c.fecha_emision, revocado: c.revocado
        }] : [];
    },
    auth: {
        async sesion() {
            const s = cargar();
            if (!s.sesion) return null;
            const perfil = (s.t.profiles || []).find((p) => p.id === s.sesion);
            return perfil ? { user: { id: perfil.id, email: perfil.email }, perfil } : null;
        },
        async entrar({ email }) {
            const s = cargar();
            let perfil = (s.t.profiles || []).find((p) => p.email === email);
            if (!perfil) throw new Error('Ese correo no está registrado en la demostración. Crea una cuenta.');
            s.sesion = perfil.id;
            guardar(s);
            return perfil;
        },
        async registrar({ email, nombre, telefono }) {
            const s = cargar();
            s.t.profiles = s.t.profiles || [];
            if (s.t.profiles.some((p) => p.email === email)) throw new Error('Ese correo ya está registrado.');
            const perfil = { id: crypto.randomUUID(), email, nombre, telefono: telefono || '', role: 'alumno', created_at: new Date().toISOString() };
            s.t.profiles.push(perfil);
            s.sesion = perfil.id;
            guardar(s);
            return { confirmar: false };
        },
        async entrarDemo(rol) {
            const s = cargar();
            s.t.profiles = s.t.profiles || [];
            const email = rol === 'admin' ? 'admin@demo.local' : 'alumno@demo.local';
            let perfil = s.t.profiles.find((p) => p.email === email);
            if (!perfil) {
                perfil = {
                    id: crypto.randomUUID(), email, role: rol,
                    nombre: rol === 'admin' ? 'Administrador de prueba' : 'Alumno de prueba',
                    telefono: '', created_at: new Date().toISOString()
                };
                s.t.profiles.push(perfil);
            }
            s.sesion = perfil.id;
            guardar(s);
        },
        async salir() {
            const s = cargar();
            s.sesion = null;
            guardar(s);
        },
        async actualizarPerfil(id, cambios) {
            return local.update('profiles', id, cambios);
        }
    },
    storage: {
        async subir(ruta, archivo) { return { ruta, nombre: archivo.name }; },
        async urlFirmada() { return null; },
        async borrar() { return null; }
    },
    reiniciar() { localStorage.removeItem(CLAVE_DEMO); }
};

// ====================== Adaptador de Supabase ======================

const TRADUCCIONES = [
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/user already registered/i, 'Ese correo ya está registrado.'],
    [/email not confirmed/i, 'Confirma tu correo con el enlace que te enviamos antes de entrar.'],
    [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [/row-level security/i, 'No tienes permiso para realizar esta acción.'],
    [/duplicate key/i, 'Ese registro ya existe.']
];

function traducir(error) {
    const texto = (error && error.message) || String(error);
    for (const [patron, mensaje] of TRADUCCIONES) if (patron.test(texto)) return new Error(mensaje);
    return new Error(texto);
}

async function crearSupabase() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const ok = ({ data, error }) => { if (error) throw traducir(error); return data; };

    return {
        async list(t, { eq = {}, order } = {}) {
            let q = sb.from(t).select('*');
            for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
            if (order) { const [col, dir = 'asc'] = [].concat(order); q = q.order(col, { ascending: dir !== 'desc' }); }
            return ok(await q);
        },
        async insert(t, fila, { retornar = true } = {}) {
            if (!retornar) { ok(await sb.from(t).insert(fila)); return null; }
            return ok(await sb.from(t).insert(fila).select().single());
        },
        async update(t, id, cambios) { return ok(await sb.from(t).update(cambios).eq('id', id).select().single()); },
        async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
        async removeWhere(t, eq) {
            let q = sb.from(t).delete();
            for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
            ok(await q);
        },
        async upsert(t, fila, claves) { ok(await sb.from(t).upsert(fila, { onConflict: claves.join(',') })); },
        async rpc(nombre, args) { return ok(await sb.rpc(nombre, args)); },
        auth: {
            async sesion() {
                const { data } = await sb.auth.getSession();
                const user = data.session && data.session.user;
                if (!user) return null;
                const { data: perfil, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
                if (error) throw traducir(error);
                return { user: { id: user.id, email: user.email }, perfil: perfil || { id: user.id, email: user.email, nombre: '', role: 'alumno' } };
            },
            async entrar({ email, password }) {
                ok(await sb.auth.signInWithPassword({ email, password }));
            },
            async registrar({ email, password, nombre, telefono }) {
                const data = ok(await sb.auth.signUp({ email, password, options: { data: { nombre, telefono }, emailRedirectTo: `${location.origin}/campus/` } }));
                return { confirmar: !data.session };
            },
            async entrarDemo() { throw new Error('No disponible con el servicio real.'); },
            async salir() { await sb.auth.signOut(); },
            async actualizarPerfil(id, cambios) {
                return ok(await sb.from('profiles').update(cambios).eq('id', id).select().single());
            }
        },
        storage: {
            async subir(ruta, archivo, bucket = 'comprobantes') {
                ok(await sb.storage.from(bucket).upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream' }));
                return { ruta, nombre: archivo.name };
            },
            async urlFirmada(ruta, bucket = 'comprobantes', descarga = false) {
                const data = ok(await sb.storage.from(bucket).createSignedUrl(ruta, 600, descarga ? { download: descarga } : undefined));
                return data.signedUrl;
            },
            async borrar(ruta, bucket = 'comprobantes') {
                ok(await sb.storage.from(bucket).remove([ruta]));
            }
        },
        reiniciar() { /* no aplica */ }
    };
}

// ====================== Interfaz pública ======================

let adaptador;
const obtener = async () => (adaptador = adaptador || (configurado ? await crearSupabase() : local));

export const db = {
    modo,
    list: async (...a) => (await obtener()).list(...a),
    insert: async (...a) => (await obtener()).insert(...a),
    update: async (...a) => (await obtener()).update(...a),
    remove: async (...a) => (await obtener()).remove(...a),
    removeWhere: async (...a) => (await obtener()).removeWhere(...a),
    upsert: async (...a) => (await obtener()).upsert(...a),
    rpc: async (...a) => (await obtener()).rpc(...a),
    reiniciarDemo: () => local.reiniciar(),
    auth: {
        sesion: async () => (await obtener()).auth.sesion(),
        entrar: async (...a) => (await obtener()).auth.entrar(...a),
        registrar: async (...a) => (await obtener()).auth.registrar(...a),
        entrarDemo: async (...a) => (await obtener()).auth.entrarDemo(...a),
        salir: async () => (await obtener()).auth.salir(),
        actualizarPerfil: async (...a) => (await obtener()).auth.actualizarPerfil(...a)
    },
    storage: {
        subir: async (...a) => (await obtener()).storage.subir(...a),
        urlFirmada: async (...a) => (await obtener()).storage.urlFirmada(...a),
        borrar: async (...a) => (await obtener()).storage.borrar(...a)
    }
};
