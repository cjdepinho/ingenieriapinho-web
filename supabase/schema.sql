-- Ingeniería Pinho: esquema de base de datos para Supabase.
-- Ejecutar completo en Supabase > SQL Editor. Es seguro volver a ejecutarlo.

create extension if not exists pgcrypto;

-- ============ Tablas ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null default '',
  telefono text not null default '',
  role text not null default 'alumno' check (role in ('alumno','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  subtitulo text default '',
  descripcion text default '',
  nivel text default 'Básico',
  horas numeric,
  precio numeric not null default 0,
  modalidad text default 'Virtual',
  incluye text[] not null default '{}',
  temario text[] not null default '{}',
  publicado boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lecciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo text not null,
  video_url text default '',
  descripcion text default '',
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo text not null,
  url text not null,
  tipo text default 'Documento',
  created_at timestamptz not null default now()
);

create table if not exists public.matriculas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','activa','completada','rechazada')),
  monto numeric not null default 0,
  metodo text default '',
  referencia text default '',
  comprobante_path text default '',
  nota text default '',
  created_at timestamptz not null default now()
);
-- Un alumno no puede tener dos matrículas vigentes del mismo curso.
create unique index if not exists matriculas_vigente_uk
  on public.matriculas(user_id, curso_id) where estado in ('pendiente','activa','completada');

create table if not exists public.progreso (
  user_id uuid not null references public.profiles(id) on delete cascade,
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, leccion_id)
);

create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  alumno_nombre text not null,
  curso_titulo text not null,
  horas numeric,
  fecha_emision date not null default current_date,
  revocado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, curso_id)
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  hora text default '',
  curso_id uuid references public.cursos(id) on delete set null,
  nota text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  estado text not null default 'por_hacer' check (estado in ('por_hacer','en_curso','hecha')),
  fecha date,
  nota text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso','gasto')),
  categoria text not null default 'Otros',
  descripcion text not null default '',
  monto numeric not null check (monto >= 0),
  matricula_id uuid references public.matriculas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  mensaje text not null,
  atendida boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ajustes (
  id int primary key default 1 check (id = 1),
  instituto text default 'Ingeniería Pinho',
  titular text default '',
  yape text default '',
  plin text default '',
  cuenta text default '',
  instrucciones_pago text default 'Realiza el pago por Yape, Plin o transferencia y sube la captura del comprobante.',
  whatsapp text default '',
  email_contacto text default ''
);
insert into public.ajustes (id) values (1) on conflict do nothing;

-- ============ Funciones ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.tiene_acceso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.matriculas
    where user_id = auth.uid() and curso_id = p_curso and estado in ('activa','completada'));
$$;

-- Crea el perfil al registrarse.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, telefono)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'nombre',''),
          coalesce(new.raw_user_meta_data->>'telefono',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Un alumno no puede cambiar su propio rol ni su correo.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists proteger_perfil_t on public.profiles;
create trigger proteger_perfil_t before update on public.profiles
  for each row execute function public.proteger_perfil();

-- Un alumno solo puede crear matrículas pendientes y no puede cambiar su estado ni monto.
create or replace function public.proteger_matricula() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.estado := 'pendiente';
      select precio into new.monto from public.cursos where id = new.curso_id;
    else
      new.estado := old.estado; new.monto := old.monto; new.user_id := old.user_id; new.curso_id := old.curso_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists proteger_matricula_t on public.matriculas;
create trigger proteger_matricula_t before insert or update on public.matriculas
  for each row execute function public.proteger_matricula();

-- Verificación pública: solo devuelve los datos mínimos del certificado consultado.
create or replace function public.verificar_certificado(p_codigo text)
returns table (codigo text, alumno_nombre text, curso_titulo text, horas numeric, fecha_emision date, revocado boolean)
language sql stable security definer set search_path = public as $$
  select c.codigo, c.alumno_nombre, c.curso_titulo, c.horas, c.fecha_emision, c.revocado
  from public.certificados c where upper(c.codigo) = upper(trim(p_codigo)) limit 1;
$$;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- ============ Seguridad por filas (RLS) ============

alter table public.profiles enable row level security;
alter table public.cursos enable row level security;
alter table public.lecciones enable row level security;
alter table public.materiales enable row level security;
alter table public.matriculas enable row level security;
alter table public.progreso enable row level security;
alter table public.certificados enable row level security;
alter table public.eventos enable row level security;
alter table public.tareas enable row level security;
alter table public.movimientos enable row level security;
alter table public.consultas enable row level security;
alter table public.ajustes enable row level security;

-- profiles
drop policy if exists p_ver on public.profiles;
create policy p_ver on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists p_editar on public.profiles;
create policy p_editar on public.profiles for update using (id = auth.uid() or public.is_admin());

-- cursos: lectura pública de los publicados; el administrador gestiona todo
drop policy if exists c_ver on public.cursos;
create policy c_ver on public.cursos for select using (publicado or public.is_admin());
drop policy if exists c_admin on public.cursos;
create policy c_admin on public.cursos for all using (public.is_admin()) with check (public.is_admin());

-- lecciones y materiales: solo con matrícula activa
drop policy if exists l_ver on public.lecciones;
create policy l_ver on public.lecciones for select using (public.tiene_acceso(curso_id));
drop policy if exists l_admin on public.lecciones;
create policy l_admin on public.lecciones for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists m_ver on public.materiales;
create policy m_ver on public.materiales for select using (public.tiene_acceso(curso_id));
drop policy if exists m_admin on public.materiales;
create policy m_admin on public.materiales for all using (public.is_admin()) with check (public.is_admin());

-- matriculas
drop policy if exists mt_ver on public.matriculas;
create policy mt_ver on public.matriculas for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists mt_crear on public.matriculas;
create policy mt_crear on public.matriculas for insert with check (user_id = auth.uid() or public.is_admin());
drop policy if exists mt_editar on public.matriculas;
create policy mt_editar on public.matriculas for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists mt_borrar on public.matriculas;
create policy mt_borrar on public.matriculas for delete using (public.is_admin());

-- progreso
drop policy if exists pg_ver on public.progreso;
create policy pg_ver on public.progreso for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists pg_crear on public.progreso;
create policy pg_crear on public.progreso for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lecciones l where l.id = leccion_id and public.tiene_acceso(l.curso_id)));
drop policy if exists pg_borrar on public.progreso;
create policy pg_borrar on public.progreso for delete using (user_id = auth.uid() or public.is_admin());

-- certificados: el alumno ve los suyos; solo el administrador emite o anula
drop policy if exists ce_ver on public.certificados;
create policy ce_ver on public.certificados for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists ce_admin on public.certificados;
create policy ce_admin on public.certificados for all using (public.is_admin()) with check (public.is_admin());

-- planificación, contabilidad: solo administrador
drop policy if exists ev_admin on public.eventos;
create policy ev_admin on public.eventos for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists ta_admin on public.tareas;
create policy ta_admin on public.tareas for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists mo_admin on public.movimientos;
create policy mo_admin on public.movimientos for all using (public.is_admin()) with check (public.is_admin());

-- consultas: cualquiera puede escribir; solo el administrador lee
drop policy if exists co_crear on public.consultas;
create policy co_crear on public.consultas for insert with check (
  length(nombre) between 1 and 120 and length(mensaje) between 5 and 2000 and atendida = false);
drop policy if exists co_admin on public.consultas;
create policy co_admin on public.consultas for all using (public.is_admin()) with check (public.is_admin());

-- ajustes: datos de pago visibles para quien tenga sesión; edita el administrador
drop policy if exists aj_ver on public.ajustes;
create policy aj_ver on public.ajustes for select using (true);
drop policy if exists aj_admin on public.ajustes;
create policy aj_admin on public.ajustes for all using (public.is_admin()) with check (public.is_admin());

-- ============ Almacenamiento de comprobantes (privado) ============

insert into storage.buckets (id, name, public) values ('comprobantes','comprobantes', false)
  on conflict (id) do nothing;

drop policy if exists st_subir on storage.objects;
create policy st_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists st_ver on storage.objects;
create policy st_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============ Datos iniciales ============

insert into public.cursos (slug, titulo, subtitulo, descripcion, nivel, precio, modalidad, incluye, publicado, orden) values
 ('inteligencia-artificial-para-ingenieros','Inteligencia Artificial para Ingenieros','Desde cero hasta usarla en tu trabajo diario',
  'Aprende desde cero a utilizar herramientas de Inteligencia Artificial para mejorar tu productividad profesional.','Básico',500,'Virtual',
  array['Modalidad virtual','Certificado institucional','Material digital'],true,1),
 ('ia-para-ingenieria-civil','IA para Ingeniería Civil','Aplicaciones y casos prácticos de ingeniería',
  'Profundiza en el uso de Inteligencia Artificial mediante aplicaciones y casos prácticos de ingeniería.','Intermedio',500,'Virtual',
  array['Modalidad virtual','Certificado institucional','Casos prácticos'],true,2)
on conflict (slug) do nothing;

-- Primer administrador: después de crear tu cuenta en el campus, ejecuta (con tu correo):
--   update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
-- Si ya ejecutaste este archivo antes, actualiza los precios con:
--   update public.cursos set precio = 500;
