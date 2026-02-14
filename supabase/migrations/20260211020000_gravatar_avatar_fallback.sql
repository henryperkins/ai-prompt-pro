-- ============================================================
-- Gravatar fallback for user avatars
-- ============================================================

-- Enable pgcrypto for digest() if not already enabled
create extension if not exists pgcrypto;

-- Update signup trigger: use Gravatar URL when no OAuth avatar is provided
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  oauth_avatar text;
  gravatar_url text;
begin
  oauth_avatar := nullif(trim(coalesce(new.image, '')), '');

  if oauth_avatar is null and new.email is not null then
    gravatar_url := 'https://0.gravatar.com/avatar/'
      || pg_catalog.encode(public.digest(lower(trim(new.email)), 'sha256'), 'hex')
      || '?s=80&d=mp';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(coalesce(new.name, '')), ''), ''),
    coalesce(oauth_avatar, gravatar_url, '')
  );
  return new;
end;
$$;

-- Backfill existing profiles that have empty avatar_url
update public.profiles
set avatar_url = 'https://0.gravatar.com/avatar/'
  || encode(digest(lower(trim(u.email)), 'sha256'), 'hex')
  || '?s=80&d=mp',
  updated_at = now()
from neon_auth."user" as u
where profiles.id = u.id
  and u.email is not null
  and (profiles.avatar_url is null or trim(profiles.avatar_url) = '');
