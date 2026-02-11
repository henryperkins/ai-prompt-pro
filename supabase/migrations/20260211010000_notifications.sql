-- ============================================================
-- Notifications for community interactions
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type = any (array['upvote', 'verified', 'comment', 'remix'])
  ),
  constraint notifications_comment_requires_comment_id check (
    (type = 'comment' and comment_id is not null)
    or (type <> 'comment' and comment_id is null)
  )
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_created_at_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create or replace function public.create_notification_for_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select community_posts.author_id
  into target_user_id
  from public.community_posts as community_posts
  where community_posts.id = new.post_id
    and community_posts.is_public = true;

  if target_user_id is null
    or target_user_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id)
  values (target_user_id, new.user_id, new.vote_type, new.post_id);

  return new;
end;
$$;

revoke all on function public.create_notification_for_vote() from public;

drop trigger if exists community_votes_after_insert_notification on public.community_votes;
create trigger community_votes_after_insert_notification
after insert on public.community_votes
for each row execute function public.create_notification_for_vote();

create or replace function public.create_notification_for_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select community_posts.author_id
  into target_user_id
  from public.community_posts as community_posts
  where community_posts.id = new.post_id
    and community_posts.is_public = true;

  if target_user_id is null
    or target_user_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
  values (target_user_id, new.user_id, 'comment', new.post_id, new.id);

  return new;
end;
$$;

revoke all on function public.create_notification_for_comment() from public;

drop trigger if exists community_comments_after_insert_notification on public.community_comments;
create trigger community_comments_after_insert_notification
after insert on public.community_comments
for each row execute function public.create_notification_for_comment();

create or replace function public.create_notification_for_remix()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if new.remixed_from is null
    or new.is_public = false then
    return new;
  end if;

  select community_posts.author_id
  into target_user_id
  from public.community_posts as community_posts
  where community_posts.id = new.remixed_from
    and community_posts.is_public = true;

  if target_user_id is null
    or target_user_id = new.author_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id)
  values (target_user_id, new.author_id, 'remix', new.remixed_from);

  return new;
end;
$$;

revoke all on function public.create_notification_for_remix() from public;

drop trigger if exists community_posts_after_insert_notification on public.community_posts;
create trigger community_posts_after_insert_notification
after insert on public.community_posts
for each row execute function public.create_notification_for_remix();
