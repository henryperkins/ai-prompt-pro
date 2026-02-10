-- ============================================================
-- Persistence hardening: case-insensitive template names,
-- updated_at consistency triggers, and query-friendly indexes.
-- ============================================================

-- Keep updated_at correct even when writes do not explicitly set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
before update on public.drafts
for each row execute function public.set_updated_at();

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

-- Ensure template names are unique per user regardless of casing.
-- Preserve duplicate rows by renaming lower-ranked entries instead of deleting data.
with ranked_templates as (
  select
    id,
    row_number() over (
      partition by user_id, lower(name)
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.templates
)
update public.templates as templates
set name = templates.name || ' (' || left(templates.id::text, 8) || ')'
from ranked_templates
where templates.id = ranked_templates.id
  and ranked_templates.duplicate_rank > 1;

alter table public.templates
  drop constraint if exists templates_user_name_unique;

drop index if exists public.templates_user_name_unique_ci;
create unique index templates_user_name_unique_ci
  on public.templates (user_id, lower(name));

-- Match filter+sort query pattern used by the app.
create index if not exists templates_user_updated_at_idx
  on public.templates (user_id, updated_at desc);

create index if not exists prompt_versions_user_created_at_idx
  on public.prompt_versions (user_id, created_at desc);
