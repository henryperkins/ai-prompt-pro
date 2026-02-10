-- ============================================================
-- Tighten RLS: community_votes should not be publicly readable.
-- ============================================================

drop policy if exists "Community votes are publicly readable" on public.community_votes;

drop policy if exists "Users can read own community votes" on public.community_votes;
create policy "Users can read own community votes"
  on public.community_votes for select
  to authenticated
  using (auth.uid() = user_id);
