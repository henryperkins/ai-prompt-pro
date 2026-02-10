-- ============================================================
-- Spec alignment: saved prompts + community feed hardening
-- ============================================================

-- Expand use_case limits to allow richer community/use-case descriptions.
alter table public.saved_prompts
  drop constraint if exists saved_prompts_use_case_length;

alter table public.saved_prompts
  add constraint saved_prompts_use_case_length
  check (char_length(use_case) <= 1000);

alter table public.community_posts
  drop constraint if exists community_posts_use_case_length;

alter table public.community_posts
  add constraint community_posts_use_case_length
  check (char_length(use_case) <= 1000);

-- Public config sanitizer: explicit allowlist to prevent private context leakage.
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

-- Share/unshare synchronization should derive starter_prompt from built prompt first.
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

-- Allow authors to read their own community post rows even if unpublished.
drop policy if exists "Community posts are publicly readable" on public.community_posts;

create policy "Community posts are publicly readable"
  on public.community_posts for select
  to anon, authenticated
  using (
    is_public = true
    or author_id = auth.uid()
  );

-- Votes are toggle-only; remove UPDATE surface.
drop policy if exists "Users can update own community votes" on public.community_votes;

-- Keep full-text search definition aligned with feed metadata fields.
drop index if exists community_posts_search_idx;
drop function if exists public.community_posts_search_tsv(text, text, text[]);

create or replace function public.community_posts_search_tsv(
  p_title text,
  p_description text,
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
    coalesce(p_title, '') || ' ' ||
    coalesce(p_description, '') || ' ' ||
    coalesce(p_use_case, '') || ' ' ||
    array_to_string(coalesce(p_tags, '{}'::text[]), ' ')
  );
$$;

create index community_posts_search_idx
  on public.community_posts
  using gin (
    public.community_posts_search_tsv(title, description, use_case, tags)
  );
