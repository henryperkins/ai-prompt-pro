# Missing `community_user_blocks` Table — Remediation Plan

**Date:** 2026-03-13
**Severity:** Medium (console errors on every authenticated Community page load; blocks/reports features non-functional)
**Status:** RESOLVED (2026-03-13)

## Resolution Summary

**Only migration `20260220010000_community_moderation_and_account_deletion.sql` was missing.** Migrations 2-4 were already applied.

Applied to production Neon project `prompt-pro` (`muddy-waterfall-56870737`), branch `br-fragrant-violet-ai3qowro`:

| Object | Action |
|---|---|
| `community_user_blocks` table | Created |
| RLS policies (3): read/insert/delete own blocks | Created |
| Indexes (2): blocker_idx, blocked_user_idx | Created |
| `community_reports` table | Created |
| RLS policies (2): read own/submit reports | Created |
| Indexes (3): reporter_idx, post_idx, comment_idx | Created |
| `delete_my_account()` function | Created |
| Function grants (revoke public, grant authenticated) | Applied |

**Post-migration:** Schema cache refresh required via `PATCH /projects/{id}/branches/{id}/data-api/neondb` with empty body (Neon Data API uses PostgREST which caches schema; `NOTIFY pgrst, 'reload schema'` does NOT work for Neon's managed Data API).

**Verified:** Community page loads with no 404 errors on `community_user_blocks`.

## Key Lesson: Neon Data API Schema Cache

After creating new tables, the Neon Data API (PostgREST) schema cache must be explicitly refreshed. Two methods:

1. **Neon Console:** Data API page > "Refresh schema cache" button
2. **API:** `PATCH /api/v2/projects/{project_id}/branches/{branch_id}/data-api/{database_name}` with empty body `{}`
   - Requires Neon API key authentication
   - Can use `neonctl` stored credentials from `~/.config/neonctl/credentials.json`

`NOTIFY pgrst, 'reload schema'` does NOT propagate to Neon's managed PostgREST instance.

---

## Original Analysis (for reference)

### Root Cause

The `community_user_blocks` table did not exist in the production Neon database. The migration file [`20260220010000_community_moderation_and_account_deletion.sql`](supabase/migrations/20260220010000_community_moderation_and_account_deletion.sql) defines the table but was never applied to the production branch.

**Why it was missed:** There is no automated migration runner in the CI/CD pipeline. The GitHub workflows only handle:
- Static Web App deployment (frontend)
- App Service deployment (agent service)
- Neon PR branch creation/deletion (preview branches inherit from main, but main itself requires manual migration)

Migrations in `supabase/migrations/` are SQL source-of-truth files that must be applied manually to production Neon via the SQL Editor or `psql`.

### Symptoms

1. **Console error on every Community page load for authenticated users:**
   ```
   GET .../community_user_blocks?select=blocked_user_id&blocker_id=eq.<uuid> 404 (Not Found)
   Failed to load blocked users: Error: Could not find the table 'public.community_user_blocks' in the schema cache
   ```

2. **`runtime.lastError` messages** — these are unrelated Chrome extension noise, not app errors.

3. **User-facing impact:**
   - Block/unblock user actions fail silently or with toast errors
   - The community feed still loads because [`Promise.allSettled`](src/pages/Community.tsx:174) gracefully handles the rejected `loadBlockedUserIds()` call
   - No users are ever filtered from the feed, even if they were "blocked" (because the table did not exist to persist blocks)

### Pre-migration Audit Results

| Migration | Object | Status |
|---|---|---|
| `20260220010000` | `community_user_blocks` | **MISSING** |
| `20260220010000` | `community_reports` | **MISSING** |
| `20260220010000` | `delete_my_account()` | **MISSING** |
| `20260221030000` | `community_prompt_ratings` | Already applied |
| `20260221030000` | `community_user_follows` | Already applied |
| `20260221030000` | `refresh_community_post_metrics()` | Already applied |
| `20260221040000` | `contact_messages` | Already applied |
| `20260224081000` | `community_profiles_by_ids()` RPC update | Already applied |

### Step 4 — Prevent recurrence (TODO)

Add a migration tracking mechanism. Options in order of preference:

1. **Neon schema migration table:** Create a `schema_migrations` tracking table and a simple script that compares `supabase/migrations/*.sql` filenames against applied records.
2. **CI check:** Add a GitHub Actions step that connects to Neon and verifies all migration files have been applied (read-only check, not auto-apply).
3. **Documentation:** At minimum, update the [Neon cutover runbook](docs/neon-cutover-runbook.md) with a "Applying Migrations" section listing the manual process.

## Files Referenced

- [`supabase/migrations/20260220010000_community_moderation_and_account_deletion.sql`](supabase/migrations/20260220010000_community_moderation_and_account_deletion.sql) — creates `community_user_blocks`, `community_reports`, `delete_my_account()`
- [`supabase/migrations/20260221030000_profile_feed_follows_ratings.sql`](supabase/migrations/20260221030000_profile_feed_follows_ratings.sql) — creates `community_prompt_ratings`, `community_user_follows`, rating triggers
- [`src/lib/community-moderation.ts`](src/lib/community-moderation.ts) — all block/unblock/report functions that query missing tables
- [`src/pages/Community.tsx:174`](src/pages/Community.tsx:174) — `Promise.allSettled` call that gracefully handles the failure
- [`src/pages/CommunityPost.tsx:95`](src/pages/CommunityPost.tsx:95) — the `console.error` producing the visible log message
- [`docs/neon-cutover-runbook.md`](docs/neon-cutover-runbook.md) — runbook that needs a migrations section
