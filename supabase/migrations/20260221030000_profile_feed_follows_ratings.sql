-- ============================================================
-- Profiles/feed enhancements: follows + prompt ratings
-- ============================================================

-- Ratings summary columns on community posts.
alter table public.community_posts
  add column if not exists rating_count int not null default 0,
  add column if not exists rating_avg numeric(4,2) not null default 0;

create table if not exists public.community_prompt_ratings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_prompt_ratings_rating_check check (rating between 1 and 5),
  constraint community_prompt_ratings_unique unique (post_id, user_id)
);

alter table public.community_prompt_ratings enable row level security;

create policy "Community ratings are publicly readable"
  on public.community_prompt_ratings for select
  to anon, authenticated
  using (true);

create policy "Users can insert own community ratings"
  on public.community_prompt_ratings for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.community_posts as community_posts
      where community_posts.id = community_prompt_ratings.post_id
        and community_posts.is_public = true
    )
  );

create policy "Users can update own community ratings"
  on public.community_prompt_ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own community ratings"
  on public.community_prompt_ratings for delete
  to authenticated
  using (user_id = auth.uid());

drop trigger if exists set_community_prompt_ratings_updated_at on public.community_prompt_ratings;
create trigger set_community_prompt_ratings_updated_at
before update on public.community_prompt_ratings
for each row execute function public.set_updated_at();

create index if not exists community_prompt_ratings_post_id_idx
  on public.community_prompt_ratings (post_id);

create index if not exists community_prompt_ratings_user_id_idx
  on public.community_prompt_ratings (user_id, created_at desc);

create table if not exists public.community_user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references neon_auth."user"(id) on delete cascade,
  followed_user_id uuid not null references neon_auth."user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_user_follows_unique unique (follower_id, followed_user_id),
  constraint community_user_follows_no_self_follow check (follower_id <> followed_user_id)
);

alter table public.community_user_follows enable row level security;

create policy "Community follows are publicly readable"
  on public.community_user_follows for select
  to anon, authenticated
  using (true);

create policy "Users can insert own follows"
  on public.community_user_follows for insert
  to authenticated
  with check (follower_id = auth.uid());

create policy "Users can delete own follows"
  on public.community_user_follows for delete
  to authenticated
  using (follower_id = auth.uid());

create index if not exists community_user_follows_follower_idx
  on public.community_user_follows (follower_id, created_at desc);

create index if not exists community_user_follows_followed_idx
  on public.community_user_follows (followed_user_id, created_at desc);

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
    ),
    rating_count = (
      select count(*)::int
      from public.community_prompt_ratings as community_prompt_ratings
      where community_prompt_ratings.post_id = community_posts.id
    ),
    rating_avg = coalesce(
      (
        select round(avg(community_prompt_ratings.rating)::numeric, 2)
        from public.community_prompt_ratings as community_prompt_ratings
        where community_prompt_ratings.post_id = community_posts.id
      ),
      0
    )
  where community_posts.id = target_post_id;
end;
$$;

revoke all on function public.refresh_community_post_metrics(uuid) from public;

create or replace function public.handle_community_prompt_ratings_change()
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

drop trigger if exists community_prompt_ratings_after_change on public.community_prompt_ratings;
create trigger community_prompt_ratings_after_change
after insert or update or delete on public.community_prompt_ratings
for each row execute function public.handle_community_prompt_ratings_change();
