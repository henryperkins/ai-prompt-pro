-- ============================================================
-- Align profiles.display_name with the shipped frontend contract
-- ============================================================

-- Review checklist before applying:
-- 1. Existing names keep visible punctuation while removing hidden/control chars.
-- 2. public.handle_new_user() still references public.digest(...).
-- 3. avatar_url still prefers OAuth avatar, then Gravatar, then empty string.
-- 4. profiles_display_name_contract still allows NULL or normalized 1..32 char values.

create extension if not exists pgcrypto;

update public.profiles
set
  display_name = nullif(
    left(
      btrim(
        translate(
          regexp_replace(
            regexp_replace(coalesce(display_name, ''), '\s+', ' ', 'g'),
            '[[:cntrl:]]',
            '',
            'g'
          ),
          U&'\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200C\200D\200E\200F\202A\202B\202C\202D\202E\2060\2066\2067\2068\2069\3164\FEFF',
          ''
        )
      ),
      32
    ),
    ''
  ),
  updated_at = now()
where display_name is distinct from nullif(
  left(
    btrim(
      translate(
        regexp_replace(
          regexp_replace(coalesce(display_name, ''), '\s+', ' ', 'g'),
          '[[:cntrl:]]',
          '',
          'g'
        ),
        U&'\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200C\200D\200E\200F\202A\202B\202C\202D\202E\2060\2066\2067\2068\2069\3164\FEFF',
        ''
      )
    ),
    32
  ),
  ''
);

alter table public.profiles
  drop constraint if exists profiles_display_name_contract;

alter table public.profiles
  add constraint profiles_display_name_contract
  check (
    display_name is null
    or (
      char_length(display_name) between 1 and 32
      and display_name = btrim(regexp_replace(display_name, '\s+', ' ', 'g'))
      and display_name !~ '[[:cntrl:]]'
      and translate(
        display_name,
        U&'\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200C\200D\200E\200F\202A\202B\202C\202D\202E\2060\2066\2067\2068\2069\3164\FEFF',
        ''
      ) = display_name
    )
  );

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
    nullif(
      left(
        btrim(
          translate(
            regexp_replace(
              regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g'),
              '[[:cntrl:]]',
              '',
              'g'
            ),
            U&'\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200C\200D\200E\200F\202A\202B\202C\202D\202E\2060\2066\2067\2068\2069\3164\FEFF',
            ''
          )
        ),
        32
      ),
      ''
    ),
    coalesce(oauth_avatar, gravatar_url, '')
  );
  return new;
end;
$$;
