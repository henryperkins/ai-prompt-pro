-- ============================================================
-- Neon auth compatibility wrappers for RLS policy functions
-- ============================================================

create schema if not exists auth;

do $$
begin
  if not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'auth'
      and proc.proname = 'jwt'
      and pg_get_function_identity_arguments(proc.oid) = ''
  ) then
    execute $fn$
      create function auth.jwt()
      returns jsonb
      language sql
      stable
      as $jwt$
        select coalesce(
          nullif(current_setting('request.jwt.claims', true), ''),
          '{}'
        )::jsonb;
      $jwt$;
    $fn$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'auth'
      and proc.proname = 'uid'
      and pg_get_function_identity_arguments(proc.oid) = ''
  ) then
    execute $fn$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $uid$
        select coalesce(
          nullif(auth.jwt() ->> 'sub', ''),
          nullif(auth.jwt() ->> 'user_id', '')
        )::uuid;
      $uid$;
    $fn$;
  end if;
end
$$;
