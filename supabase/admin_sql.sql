-- Consola SQL del panel de administración.
-- Ejecutar una vez en Supabase > SQL Editor. Es seguro volver a ejecutarlo.
--
-- Seguridad: la función corre con los permisos de quien la llama (security invoker),
-- por lo que las reglas de acceso (RLS) siguen vigentes, y solo acepta administradores.
-- No puede crear ni borrar tablas, ni acceder a las cuentas de acceso (auth).

create or replace function public.admin_sql(p_consultas text[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  q text;
  resultado jsonb := '[]'::jsonb;
  filas jsonb;
  n int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  perform set_config('statement_timeout', '15000', true);

  foreach q in array p_consultas loop
    q := btrim(regexp_replace(coalesce(q, ''), ';\s*$', ''));
    if q = '' then continue; end if;

    if q ~* '^(select|with|values)\M' then
      execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from ('
              || q || ') x limit 500) t' into filas;
      resultado := resultado || jsonb_build_array(jsonb_build_object('tipo', 'consulta', 'filas', filas));
    else
      execute q;
      get diagnostics n = row_count;
      resultado := resultado || jsonb_build_array(jsonb_build_object('tipo', 'comando', 'afectadas', n));
    end if;
  end loop;

  return resultado;
end $$;

revoke all on function public.admin_sql(text[]) from public, anon;
grant execute on function public.admin_sql(text[]) to authenticated;
