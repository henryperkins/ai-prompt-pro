-- ============================================================
-- Tighten RLS: community_comments should track post visibility.
-- ============================================================

drop policy if exists "Community comments are publicly readable" on public.community_comments;

drop policy if exists "Community comments are readable on public posts" on public.community_comments;
create policy "Community comments are readable on public posts"
  on public.community_comments for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.community_posts as community_posts
      where community_posts.id = community_comments.post_id
        and community_posts.is_public = true
    )
  );
