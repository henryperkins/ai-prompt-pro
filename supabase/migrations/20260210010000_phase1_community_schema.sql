-- ============================================================
-- Phase 1: saved prompts + community feed schema
-- ============================================================

-- Helper used by RLS policies to block writes from anonymous auth accounts.
create or replace function public.is_non_anonymous_account()
returns boolean
language sql
stable
set search_path = public
as $$
  select not (
    lower(coalesce(auth.jwt() ->> 'is_anonymous', 'false')) = any (array['true', 't', '1', 'yes', 'on'])
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_anonymous', 'false')) = any (array['true', 't', '1', 'yes', 'on'])
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_anonymous', 'false')) = any (array['true', 't', '1', 'yes', 'on'])
  );
$$;

-- Public config sanitizer to prevent private context leakage in community posts.
create or replace function public.strip_sensitive_prompt_config(input_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := coalesce(input_config, '{}'::jsonb);
  role_value text := coalesce(nullif(trim(cfg ->> 'customRole'), ''), coalesce(cfg ->> 'role', ''));
  task_value text := coalesce(nullif(trim(cfg ->> 'task'), ''), coalesce(cfg ->> 'originalPrompt', ''));
  format_value jsonb := coalesce(cfg -> 'format', '[]'::jsonb);
  constraints_value jsonb := coalesce(cfg -> 'constraints', '[]'::jsonb);
  custom_format text := nullif(trim(cfg ->> 'customFormat'), '');
  custom_constraint text := nullif(trim(cfg ->> 'customConstraint'), '');
begin
  if jsonb_typeof(format_value) <> 'array' then
    format_value := '[]'::jsonb;
  end if;

  if jsonb_typeof(constraints_value) <> 'array' then
    constraints_value := '[]'::jsonb;
  end if;

  if custom_format is not null then
    format_value := format_value || jsonb_build_array(custom_format);
  end if;

  if custom_constraint is not null then
    constraints_value := constraints_value || jsonb_build_array(custom_constraint);
  end if;

  return jsonb_build_object(
    'role', role_value,
    'task', task_value,
    'format', format_value,
    'constraints', constraints_value,
    'tone', coalesce(cfg ->> 'tone', ''),
    'complexity', coalesce(cfg ->> 'complexity', ''),
    'examples', coalesce(cfg ->> 'examples', ''),
    'lengthPreference', coalesce(cfg ->> 'lengthPreference', 'standard'),
    'contextConfig', jsonb_build_object(
      'sources', '[]'::jsonb,
      'databaseConnections', '[]'::jsonb,
      'rag', jsonb_build_object(
        'enabled', false,
        'vectorStoreRef', '',
        'namespace', '',
        'topK', 5,
        'minScore', 0.2,
        'retrievalStrategy', 'hybrid',
        'documentRefs', '[]'::jsonb,
        'chunkWindow', 3
      ),
      'structured', jsonb_build_object(
        'audience', '',
        'product', '',
        'offer', '',
        'mustInclude', '',
        'excludedTopics', ''
      ),
      'interviewAnswers', '[]'::jsonb,
      'useDelimiters', true,
      'projectNotes', ''
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- saved_prompts (private library, replaces templates)
-- ---------------------------------------------------------------------------
create table public.saved_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'general',
  tags text[] not null default '{}',
  config jsonb not null default '{}',
  built_prompt text not null default '',
  enhanced_prompt text not null default '',
  fingerprint text,
  revision int not null default 1,
  is_shared boolean not null default false,
  target_model text not null default '',
  use_case text not null default '',
  remixed_from uuid,
  remix_note text not null default '',
  remix_diff jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_prompts_title_length check (char_length(title) between 1 and 200),
  constraint saved_prompts_description_length check (char_length(description) <= 500),
  constraint saved_prompts_category_check check (
    category = any (
      array[
        'general',
        'frontend',
        'backend',
        'fullstack',
        'devops',
        'data',
        'ml-ai',
        'security',
        'testing',
        'api',
        'automation',
        'docs',
        'content',
        'analysis',
        'creative',
        'business',
        'education'
      ]
    )
  ),
  constraint saved_prompts_revision_check check (revision >= 1),
  constraint saved_prompts_target_model_length check (char_length(target_model) <= 80),
  constraint saved_prompts_use_case_length check (char_length(use_case) <= 500),
  constraint saved_prompts_remix_note_length check (char_length(remix_note) <= 500)
);

alter table public.saved_prompts enable row level security;

create policy "Users can read own saved prompts"
  on public.saved_prompts for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved prompts"
  on public.saved_prompts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved prompts"
  on public.saved_prompts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own saved prompts"
  on public.saved_prompts for delete
  using (auth.uid() = user_id);

-- Backfill data from templates before adding case-insensitive uniqueness.
insert into public.saved_prompts (
  id,
  user_id,
  title,
  description,
  category,
  tags,
  config,
  built_prompt,
  enhanced_prompt,
  fingerprint,
  revision,
  is_shared,
  target_model,
  use_case,
  remixed_from,
  remix_note,
  remix_diff,
  created_at,
  updated_at
)
select
  t.id,
  t.user_id,
  coalesce(nullif(left(trim(t.name), 200), ''), 'Untitled Prompt'),
  left(coalesce(t.description, ''), 500),
  'general',
  coalesce(t.tags, '{}'),
  coalesce(t.config, '{}'::jsonb),
  '',
  '',
  t.fingerprint,
  greatest(t.revision, 1),
  false,
  '',
  '',
  null,
  '',
  null,
  t.created_at,
  t.updated_at
from public.templates as t
on conflict (id) do nothing;

-- Ensure duplicate lower(title) values are renamed safely prior to unique index creation.
with ranked_saved_prompts as (
  select
    id,
    row_number() over (
      partition by user_id, lower(title)
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.saved_prompts
)
update public.saved_prompts as saved_prompts
set title = left(saved_prompts.title, 185) || ' (' || left(saved_prompts.id::text, 8) || ')'
from ranked_saved_prompts
where saved_prompts.id = ranked_saved_prompts.id
  and ranked_saved_prompts.duplicate_rank > 1;

create unique index saved_prompts_user_title_unique_ci
  on public.saved_prompts (user_id, lower(title));

create index saved_prompts_user_updated_at_idx
  on public.saved_prompts (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- community_posts (public feed)
-- ---------------------------------------------------------------------------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  saved_prompt_id uuid not null unique references public.saved_prompts(id) on delete cascade,
  author_id uuid not null references auth.users on delete cascade,
  title text not null,
  enhanced_prompt text not null,
  description text not null default '',
  use_case text not null default '',
  category text not null default 'general',
  tags text[] not null default '{}',
  target_model text not null default '',
  is_public boolean not null default true,
  public_config jsonb not null default '{}',
  starter_prompt text not null default '',
  remixed_from uuid references public.community_posts(id) on delete set null,
  remix_note text not null default '',
  remix_diff jsonb,
  upvote_count int not null default 0,
  verified_count int not null default 0,
  remix_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_title_length check (char_length(title) between 1 and 200),
  constraint community_posts_enhanced_prompt_length check (char_length(enhanced_prompt) <= 50000),
  constraint community_posts_description_length check (char_length(description) <= 500),
  constraint community_posts_use_case_length check (char_length(use_case) <= 500),
  constraint community_posts_category_check check (
    category = any (
      array[
        'general',
        'frontend',
        'backend',
        'fullstack',
        'devops',
        'data',
        'ml-ai',
        'security',
        'testing',
        'api',
        'automation',
        'docs',
        'content',
        'analysis',
        'creative',
        'business',
        'education'
      ]
    )
  ),
  constraint community_posts_target_model_length check (char_length(target_model) <= 80),
  constraint community_posts_starter_prompt_length check (char_length(starter_prompt) <= 500),
  constraint community_posts_remix_note_length check (char_length(remix_note) <= 500),
  constraint community_posts_upvote_count_non_negative check (upvote_count >= 0),
  constraint community_posts_verified_count_non_negative check (verified_count >= 0),
  constraint community_posts_remix_count_non_negative check (remix_count >= 0),
  constraint community_posts_comment_count_non_negative check (comment_count >= 0)
);

alter table public.community_posts enable row level security;

create policy "Community posts are publicly readable"
  on public.community_posts for select
  to anon, authenticated
  using (is_public = true);

create policy "Community post authors can insert"
  on public.community_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_non_anonymous_account()
    and exists (
      select 1
      from public.saved_prompts as saved_prompts
      where saved_prompts.id = community_posts.saved_prompt_id
        and saved_prompts.user_id = auth.uid()
    )
  );

create policy "Community post authors can update"
  on public.community_posts for update
  to authenticated
  using (author_id = auth.uid() and public.is_non_anonymous_account())
  with check (author_id = auth.uid() and public.is_non_anonymous_account());

create policy "Community post authors can delete"
  on public.community_posts for delete
  to authenticated
  using (author_id = auth.uid() and public.is_non_anonymous_account());

-- ---------------------------------------------------------------------------
-- community_votes
-- ---------------------------------------------------------------------------
create table public.community_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  vote_type text not null,
  created_at timestamptz not null default now(),
  constraint community_votes_vote_type_check check (vote_type in ('upvote', 'verified')),
  constraint community_votes_unique_per_type unique (post_id, user_id, vote_type)
);

alter table public.community_votes enable row level security;

create policy "Community votes are publicly readable"
  on public.community_votes for select
  to anon, authenticated
  using (true);

create policy "Users can insert own community votes"
  on public.community_votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_non_anonymous_account()
    and exists (
      select 1
      from public.community_posts as community_posts
      where community_posts.id = community_votes.post_id
        and community_posts.is_public = true
    )
  );

create policy "Users can update own community votes"
  on public.community_votes for update
  to authenticated
  using (user_id = auth.uid() and public.is_non_anonymous_account())
  with check (user_id = auth.uid() and public.is_non_anonymous_account());

create policy "Users can delete own community votes"
  on public.community_votes for delete
  to authenticated
  using (user_id = auth.uid() and public.is_non_anonymous_account());

-- ---------------------------------------------------------------------------
-- community_comments (flat)
-- ---------------------------------------------------------------------------
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_comments_body_length check (char_length(body) between 1 and 2000)
);

alter table public.community_comments enable row level security;

create policy "Community comments are publicly readable"
  on public.community_comments for select
  to anon, authenticated
  using (true);

create policy "Users can insert own community comments"
  on public.community_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_non_anonymous_account()
    and exists (
      select 1
      from public.community_posts as community_posts
      where community_posts.id = community_comments.post_id
        and community_posts.is_public = true
    )
  );

create policy "Users can update own community comments"
  on public.community_comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own community comments"
  on public.community_comments for delete
  to authenticated
  using (user_id = auth.uid());

-- Link saved prompts remix lineage now that community_posts exists.
alter table public.saved_prompts
  add constraint saved_prompts_remixed_from_fkey
  foreign key (remixed_from)
  references public.community_posts(id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at trigger wiring
-- ---------------------------------------------------------------------------
drop trigger if exists set_saved_prompts_updated_at on public.saved_prompts;
create trigger set_saved_prompts_updated_at
before update on public.saved_prompts
for each row execute function public.set_updated_at();

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_community_comments_updated_at on public.community_comments;
create trigger set_community_comments_updated_at
before update on public.community_comments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Share/unshare synchronization: saved_prompts <-> community_posts
-- ---------------------------------------------------------------------------
create or replace function public.sync_saved_prompt_share()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sanitized_config jsonb;
  starter text;
begin
  if new.is_shared then
    sanitized_config := public.strip_sensitive_prompt_config(new.config);
    starter := left(coalesce(nullif(trim(new.use_case), ''), nullif(trim(new.title), ''), ''), 500);

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
  elsif tg_op = 'update' and old.is_shared then
    update public.community_posts
    set is_public = false
    where saved_prompt_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists saved_prompts_after_share on public.saved_prompts;
create trigger saved_prompts_after_share
after insert or update on public.saved_prompts
for each row execute function public.sync_saved_prompt_share();

-- ---------------------------------------------------------------------------
-- Counter maintenance
-- ---------------------------------------------------------------------------
create or replace function public.refresh_community_post_metrics(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_post_id is null then
    return;
  end if;

  update public.community_posts as community_posts
  set
    upvote_count = (
      select count(*)::int
      from public.community_votes as community_votes
      where community_votes.post_id = community_posts.id
        and community_votes.vote_type = 'upvote'
    ),
    verified_count = (
      select count(*)::int
      from public.community_votes as community_votes
      where community_votes.post_id = community_posts.id
        and community_votes.vote_type = 'verified'
    ),
    comment_count = (
      select count(*)::int
      from public.community_comments as community_comments
      where community_comments.post_id = community_posts.id
    ),
    remix_count = (
      select count(*)::int
      from public.community_posts as remixes
      where remixes.remixed_from = community_posts.id
        and remixes.is_public = true
    )
  where community_posts.id = target_post_id;
end;
$$;

revoke all on function public.refresh_community_post_metrics(uuid) from public;

create or replace function public.handle_community_votes_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_community_post_metrics(new.post_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_community_post_metrics(old.post_id);
    return old;
  end if;

  perform public.refresh_community_post_metrics(new.post_id);
  if old.post_id is distinct from new.post_id then
    perform public.refresh_community_post_metrics(old.post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists community_votes_after_change on public.community_votes;
create trigger community_votes_after_change
after insert or update or delete on public.community_votes
for each row execute function public.handle_community_votes_change();

create or replace function public.handle_community_comments_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_community_post_metrics(new.post_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_community_post_metrics(old.post_id);
    return old;
  end if;

  perform public.refresh_community_post_metrics(new.post_id);
  if old.post_id is distinct from new.post_id then
    perform public.refresh_community_post_metrics(old.post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists community_comments_after_change on public.community_comments;
create trigger community_comments_after_change
after insert or update or delete on public.community_comments
for each row execute function public.handle_community_comments_change();

create or replace function public.handle_community_post_remix_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_community_post_metrics(new.remixed_from);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_community_post_metrics(old.remixed_from);
    return old;
  end if;

  if old.remixed_from is distinct from new.remixed_from
    or old.is_public is distinct from new.is_public then
    perform public.refresh_community_post_metrics(old.remixed_from);
    perform public.refresh_community_post_metrics(new.remixed_from);
  end if;

  return new;
end;
$$;

drop trigger if exists community_posts_after_remix_change on public.community_posts;
create trigger community_posts_after_remix_change
after insert or update or delete on public.community_posts
for each row execute function public.handle_community_post_remix_change();

-- ---------------------------------------------------------------------------
-- Query indexes
-- ---------------------------------------------------------------------------
create index community_posts_created_at_idx
  on public.community_posts (created_at desc)
  where is_public = true;

create index community_posts_upvote_created_at_idx
  on public.community_posts (upvote_count desc, created_at desc)
  where is_public = true;

create index community_posts_verified_created_at_idx
  on public.community_posts (verified_count desc, created_at desc)
  where is_public = true;

create index community_posts_remix_created_at_idx
  on public.community_posts (remix_count desc, created_at desc)
  where is_public = true;

create index community_posts_category_idx
  on public.community_posts (category)
  where is_public = true;

create index community_posts_author_id_idx
  on public.community_posts (author_id);

create index community_posts_remixed_from_idx
  on public.community_posts (remixed_from)
  where remixed_from is not null;

create index community_posts_tags_gin_idx
  on public.community_posts using gin (tags);

create or replace function public.community_posts_search_tsv(
  p_title text,
  p_use_case text,
  p_tags text[]
)
returns tsvector
language sql
immutable parallel safe
set search_path = public
as $$
  select to_tsvector(
    'english'::regconfig,
    coalesce(p_title, '') || ' ' || coalesce(p_use_case, '') || ' ' || array_to_string(p_tags, ' ')
  );
$$;

create index community_posts_search_idx
  on public.community_posts
  using gin (
    public.community_posts_search_tsv(title, use_case, tags)
  );

create index community_comments_post_id_created_at_idx
  on public.community_comments (post_id, created_at);

create index community_votes_post_id_idx
  on public.community_votes (post_id);

create index community_votes_user_id_idx
  on public.community_votes (user_id);

-- ---------------------------------------------------------------------------
-- Public profile metadata lookup (safe fields only)
-- ---------------------------------------------------------------------------
drop function if exists public.community_profiles_by_ids(uuid[]);

create or replace function public.community_profiles_by_ids(input_ids uuid[])
returns table (
  id uuid,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_url
  from public.profiles as profiles
  where profiles.id = any (coalesce(input_ids, array[]::uuid[]));
$$;

revoke all on function public.community_profiles_by_ids(uuid[]) from public;
grant execute on function public.community_profiles_by_ids(uuid[]) to anon, authenticated;
