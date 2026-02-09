-- ============================================================
-- Initial schema: profiles, drafts, templates, prompt_versions
-- ============================================================

create extension if not exists pgcrypto;

-- 1. profiles — auto-created on signup via trigger
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. drafts — one active draft per user (upsert-friendly)
create table public.drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint drafts_user_id_unique unique (user_id)
);

alter table public.drafts enable row level security;

create policy "Users can read own draft"
  on public.drafts for select
  using (auth.uid() = user_id);

create policy "Users can insert own draft"
  on public.drafts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own draft"
  on public.drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own draft"
  on public.drafts for delete
  using (auth.uid() = user_id);

-- 3. templates — saved presets per user
create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  description text not null default '',
  tags        text[] not null default '{}',
  config      jsonb not null default '{}',
  fingerprint text,
  revision    int not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint templates_user_name_unique unique (user_id, name)
);

alter table public.templates enable row level security;

create policy "Users can read own templates"
  on public.templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.templates for delete
  using (auth.uid() = user_id);

create index templates_user_id_idx on public.templates (user_id);
create index templates_updated_at_idx on public.templates (updated_at desc);

-- 4. prompt_versions — saved prompt snapshots
create table public.prompt_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  prompt     text not null,
  created_at timestamptz not null default now()
);

alter table public.prompt_versions enable row level security;

create policy "Users can read own versions"
  on public.prompt_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own versions"
  on public.prompt_versions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own versions"
  on public.prompt_versions for delete
  using (auth.uid() = user_id);

create index prompt_versions_user_id_idx on public.prompt_versions (user_id);
create index prompt_versions_created_at_idx on public.prompt_versions (created_at desc);
