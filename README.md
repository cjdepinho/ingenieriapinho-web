# Ingeniería Pinho

Sitio web, campus virtual y panel de administración de Ingeniería Pinho (ingenieriapinho.com).

| Parte | Dirección |
|---|---|
| Sitio público | `/` |
| Detalle de curso | `/curso.html?c=<curso>` |
| Verificar certificado | `/verificar.html?c=<código>` |
| Certificado imprimible | `/certificado.html?c=<código>` |
| Campus del alumno | `/campus/` |
| Administración | `/admin/` |

El sitio es estático (GitHub Pages). Los datos, el acceso de usuarios y los comprobantes viven en Supabase.

## Probar sin configurar nada

Mientras `js/config.js` no tenga datos de Supabase, el sitio funciona en **modo demostración**: guarda todo en el navegador. En `/campus/` usa los botones "Entrar como administrador de prueba" o "Entrar como alumno de prueba".

## Conectar Supabase (datos reales)

1. Crea un proyecto gratuito en <https://supabase.com>.
2. En **SQL Editor**, pega y ejecuta todo el contenido de `supabase/schema.sql`.
3. En **Project Settings > API**, copia la **Project URL** y la clave **anon public** y pégalas en `js/config.js` (`supabaseUrl` y `supabaseAnonKey`). La clave anon es pública por diseño; la seguridad la dan las reglas de la base de datos. **Nunca pegues la clave `service_role`.**
4. En **Authentication > URL Configuration**, pon como *Site URL* `https://ingenieriapinho.com`.
5. Crea tu cuenta desde `/campus/` y luego, en el SQL Editor, conviértela en administradora:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
   ```
6. Entra a `/admin/` y completa **Ajustes** (Yape, Plin, cuenta, WhatsApp y correo).

## Flujo de trabajo

1. El alumno se registra, elige un curso, paga por Yape, Plin o transferencia y sube su comprobante.
2. En **Matrículas y pagos** validas el comprobante y apruebas: se habilita el curso y se registra el ingreso en Contabilidad.
3. El alumno ve las clases (videos de YouTube no listados) y el material, y marca su avance.
4. Al completar las clases, en **Certificados** emites el certificado con código único y QR. Cualquiera puede verificarlo en `/verificar.html`.

## Avales de asociaciones

Si firmas un convenio que autorice mostrar un logo en tus certificados, agrégalo en `js/config.js` dentro de `avales: [{ nombre, logo }]`. Hasta entonces el certificado es de Ingeniería Pinho.

## Notas

- La contabilidad es un control interno de ingresos y gastos; no emite comprobantes electrónicos.
- Los comprobantes de pago se guardan en un almacenamiento privado; solo los ve el alumno que los subió y el administrador.
- No hay paso de compilación: edita los archivos y súbelos.
