-- ============================================================
-- Gravatar fallback for user avatars
-- ============================================================

-- Enable pgcrypto for digest() if not already enabled
create extension if not exists pgcrypto with schema extensions;

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
  oauth_avatar := nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '');

  if oauth_avatar is null and new.email is not null then
    gravatar_url := 'https://0.gravatar.com/avatar/'
      || encode(extensions.digest(lower(trim(new.email)), 'sha256'), 'hex')
      || '?s=80&d=mp';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
      ''
    ),
    coalesce(oauth_avatar, gravatar_url, '')
  );
  return new;
end;
$$;

-- Backfill existing profiles that have empty avatar_url
update public.profiles
set avatar_url = 'https://0.gravatar.com/avatar/'
  || encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex')
  || '?s=80&d=mp',
  updated_at = now()
from auth.users as u
where profiles.id = u.id
  and u.email is not null
  and (profiles.avatar_url is null or trim(profiles.avatar_url) = '');
