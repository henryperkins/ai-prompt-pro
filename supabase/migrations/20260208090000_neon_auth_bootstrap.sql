-- ============================================================
-- Neon auth bootstrap compatibility for Supabase-style migrations
-- ============================================================

-- Policies reference role "anon". Ensure it exists on Neon projects.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end
$$;

-- Create auth schema only when missing (auth exists on Supabase).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'create schema auth';
  end if;
end
$$;

-- Downstream migrations reference neon_auth."user" in FKs and triggers.
-- Fail fast with a clear message when Neon Auth has not been provisioned.
do $$
begin
  if not exists (
    select 1
    from pg_class as class
    join pg_namespace as namespace
      on namespace.oid = class.relnamespace
    where namespace.nspname = 'neon_auth'
      and class.relname = 'user'
      and class.relkind in ('r', 'p')
  ) then
    raise exception using
      message = 'Missing neon_auth.user relation.',
      hint = 'Enable Neon Auth (Data API configured with Neon Auth) before running migrations that reference neon_auth."user".';
  end if;
end
$$;

-- Create auth.jwt() compatibility function when it does not exist.
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

-- Create auth.uid() compatibility function when it does not exist.
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
