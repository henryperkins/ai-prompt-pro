-- Expose profile creation timestamp for public profile hero metadata.
-- Safe to expose: this mirrors existing profile metadata exposure (name/avatar).
drop function if exists public.community_profiles_by_ids(uuid[]);

create or replace function public.community_profiles_by_ids(input_ids uuid[])
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.created_at
  from public.profiles as profiles
  where profiles.id = any (coalesce(input_ids, array[]::uuid[]));
$$;

revoke all on function public.community_profiles_by_ids(uuid[]) from public;
grant execute on function public.community_profiles_by_ids(uuid[]) to anon, authenticated;
