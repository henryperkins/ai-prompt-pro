-- ============================================================
-- Community moderation + self-serve account deletion
-- ============================================================

create table public.community_user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references neon_auth."user"(id) on delete cascade,
  blocked_user_id uuid not null references neon_auth."user"(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint community_user_blocks_unique unique (blocker_id, blocked_user_id),
  constraint community_user_blocks_no_self_block check (blocker_id <> blocked_user_id),
  constraint community_user_blocks_reason_length check (char_length(reason) <= 500)
);

alter table public.community_user_blocks enable row level security;

create policy "Users can read own block list"
  on public.community_user_blocks for select
  to authenticated
  using (blocker_id = auth.uid());

create policy "Users can insert own blocks"
  on public.community_user_blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

create policy "Users can delete own blocks"
  on public.community_user_blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

create index community_user_blocks_blocker_idx
  on public.community_user_blocks (blocker_id, created_at desc);

create index community_user_blocks_blocked_user_idx
  on public.community_user_blocks (blocked_user_id);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references neon_auth."user"(id) on delete cascade,
  reported_user_id uuid references neon_auth."user"(id) on delete set null,
  post_id uuid references public.community_posts(id) on delete set null,
  comment_id uuid references public.community_comments(id) on delete set null,
  target_type text not null,
  reason text not null default 'other',
  details text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint community_reports_target_type_check check (target_type in ('post', 'comment')),
  constraint community_reports_reason_length check (char_length(reason) between 1 and 80),
  constraint community_reports_details_length check (char_length(details) <= 2000),
  constraint community_reports_status_check check (status in ('open', 'reviewed', 'closed')),
  constraint community_reports_target_payload_check check (
    (
      target_type = 'post'
      and post_id is not null
      and comment_id is null
    )
    or (
      target_type = 'comment'
      and comment_id is not null
    )
  )
);

alter table public.community_reports enable row level security;

create policy "Users can read own reports"
  on public.community_reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy "Users can submit reports"
  on public.community_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create index community_reports_reporter_idx
  on public.community_reports (reporter_id, created_at desc);

create index community_reports_post_idx
  on public.community_reports (post_id)
  where post_id is not null;

create index community_reports_comment_idx
  on public.community_reports (comment_id)
  where comment_id is not null;

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;

  delete from neon_auth."user"
  where id = target_user_id;

  if not found then
    raise exception 'User account not found.' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
