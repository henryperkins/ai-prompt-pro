-- ============================================================
-- GitHub context storage + share safety guards
-- ============================================================

create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  github_installation_id bigint not null,
  github_account_id bigint not null,
  github_account_login text not null,
  github_account_type text not null,
  repositories_mode text not null,
  permissions jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_installations_user_installation_unique
    unique (user_id, github_installation_id)
);

create index github_installations_installation_id_idx
  on public.github_installations (github_installation_id);

create index github_installations_user_updated_at_idx
  on public.github_installations (user_id, updated_at desc);

create table public.github_repo_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  installation_record_id uuid not null references public.github_installations(id) on delete cascade,
  github_repo_id bigint not null,
  owner_login text not null,
  repo_name text not null,
  full_name text not null,
  default_branch text not null,
  visibility text not null,
  is_private boolean not null,
  last_selected_at timestamptz not null default now(),
  access_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_repo_connections_user_repo_unique
    unique (user_id, github_repo_id)
);

create index github_repo_connections_installation_repo_idx
  on public.github_repo_connections (installation_record_id, github_repo_id);

create index github_repo_connections_repo_id_idx
  on public.github_repo_connections (github_repo_id);

create index github_repo_connections_user_updated_at_idx
  on public.github_repo_connections (user_id, updated_at desc);

create table public.github_repo_manifest_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  repo_connection_id uuid not null references public.github_repo_connections(id) on delete cascade,
  ref_name text not null default 'default',
  tree_sha text not null,
  entry_count integer not null default 0,
  manifest jsonb not null default '[]'::jsonb,
  is_complete boolean not null default true,
  last_error text,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_repo_manifest_cache_connection_ref_unique
    unique (repo_connection_id, ref_name)
);

create table public.github_setup_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  nonce_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint github_setup_states_user_nonce_unique
    unique (user_id, nonce_hash)
);

create index github_setup_states_expires_at_idx
  on public.github_setup_states (expires_at);

alter table public.github_installations enable row level security;
alter table public.github_repo_connections enable row level security;
alter table public.github_repo_manifest_cache enable row level security;
alter table public.github_setup_states enable row level security;

create policy "Users can read own GitHub installations"
  on public.github_installations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own GitHub repo connections"
  on public.github_repo_connections for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own GitHub manifest cache"
  on public.github_repo_manifest_cache for select
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists set_github_installations_updated_at on public.github_installations;
create trigger set_github_installations_updated_at
before update on public.github_installations
for each row execute function public.set_updated_at();

drop trigger if exists set_github_repo_connections_updated_at on public.github_repo_connections;
create trigger set_github_repo_connections_updated_at
before update on public.github_repo_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_github_repo_manifest_cache_updated_at on public.github_repo_manifest_cache;
create trigger set_github_repo_manifest_cache_updated_at
before update on public.github_repo_manifest_cache
for each row execute function public.set_updated_at();

create or replace function public.prompt_config_contains_github_sources(input_config jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(input_config #> '{contextConfig,sources}', '[]'::jsonb)) as source
    where coalesce(source ->> 'type', '') = 'github'
      or coalesce(source #>> '{reference,kind}', '') = 'github'
  );
$$;

alter table public.saved_prompts
  drop constraint if exists saved_prompts_no_github_public_share;

alter table public.saved_prompts
  add constraint saved_prompts_no_github_public_share
  check (
    not (
      is_shared
      and public.prompt_config_contains_github_sources(config)
    )
  );

create or replace function public.sync_saved_prompt_share()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sanitized_config jsonb;
  starter text;
begin
  if new.is_shared and public.prompt_config_contains_github_sources(new.config) then
    raise exception 'GitHub-backed prompts cannot be shared.'
      using errcode = 'check_violation';
  end if;

  if new.is_shared then
    sanitized_config := public.strip_sensitive_prompt_config(new.config);
    starter := left(
      coalesce(
        nullif(trim(new.built_prompt), ''),
        nullif(trim(new.use_case), ''),
        nullif(trim(coalesce(new.config ->> 'task', new.config ->> 'originalPrompt', '')), ''),
        nullif(trim(new.title), ''),
        ''
      ),
      500
    );

    insert into public.community_posts (
      saved_prompt_id,
      author_id,
      title,
      enhanced_prompt,
      description,
      use_case,
      category,
      tags,
      target_model,
      is_public,
      public_config,
      starter_prompt,
      remixed_from,
      remix_note,
      remix_diff
    )
    values (
      new.id,
      new.user_id,
      new.title,
      new.enhanced_prompt,
      new.description,
      new.use_case,
      new.category,
      new.tags,
      new.target_model,
      true,
      sanitized_config,
      starter,
      new.remixed_from,
      new.remix_note,
      new.remix_diff
    )
    on conflict (saved_prompt_id)
    do update set
      author_id = excluded.author_id,
      title = excluded.title,
      enhanced_prompt = excluded.enhanced_prompt,
      description = excluded.description,
      use_case = excluded.use_case,
      category = excluded.category,
      tags = excluded.tags,
      target_model = excluded.target_model,
      is_public = true,
      public_config = excluded.public_config,
      starter_prompt = excluded.starter_prompt,
      remixed_from = excluded.remixed_from,
      remix_note = excluded.remix_note,
      remix_diff = excluded.remix_diff;
  elsif tg_op = 'UPDATE' and old.is_shared then
    update public.community_posts
    set is_public = false
    where saved_prompt_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.guard_github_community_post_publication()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_github_sources boolean := false;
begin
  if new.is_public is distinct from true then
    return new;
  end if;

  select public.prompt_config_contains_github_sources(saved_prompts.config)
  into has_github_sources
  from public.saved_prompts as saved_prompts
  where saved_prompts.id = new.saved_prompt_id;

  if coalesce(has_github_sources, false) then
    raise exception 'GitHub-backed prompts cannot be shared.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists community_posts_guard_github_publication on public.community_posts;
create trigger community_posts_guard_github_publication
before insert or update on public.community_posts
for each row execute function public.guard_github_community_post_publication();
