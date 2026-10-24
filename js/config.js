// Ingeniería Pinho: configuración del sitio
//
// Mientras supabaseUrl y supabaseAnonKey estén vacíos, el campus y el panel de
// administración funcionan en MODO DEMOSTRACIÓN: los datos se guardan solo en
// el navegador de quien los usa. Para activar el servicio real, sigue los
// pasos del archivo README.md y pega aquí los dos valores de tu proyecto de
// Supabase (Project Settings > API).
//
// La clave "anon" es pública por diseño: la seguridad la dan las reglas del
// archivo supabase/schema.sql. Nunca pegues aquí la clave "service_role".

export const CONFIG = {
    supabaseUrl: 'https://dgasniewuhfbirpgjbqh.supabase.co',
    supabaseAnonKey: 'sb_publishable_Elbhzk06GTizX85Fy4JLnw_18JQcRxX',

    marca: {
        nombre: 'Ingeniería Pinho',
        dominio: 'ingenieriapinho.com',
        instructor: 'Ing. Carlos J. Jerí De Pinho',
        cip: 'CIP 108121',
        firma: 'assets/firma.png'
    },

    // Instituciones que avalan los cursos y cuyo logo aparece en el certificado.
    // Agrega una institución solo cuando exista un convenio firmado que lo autorice.
    // Ejemplo: { nombre: 'Colegio de Ingenieros del Perú', logo: 'assets/avales/cip.svg' }
    avales: []
};
