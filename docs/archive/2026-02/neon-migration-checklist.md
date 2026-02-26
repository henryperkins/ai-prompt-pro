# Neon Migration Execution Checklist

This is an execution-ready checklist for migrating this repo from Supabase to Neon with reversible cutover.

## Operating Rules

- Work in small PRs by phase (`phase-1-neon-db`, `phase-2-client-auth`, etc.).
- Do not delete Supabase code until Phase 8 cleanup is complete and production is stable.
- Gate each phase with the listed verification commands before continuing.

## Phase 0: Baseline and Safety

- [ ] Create a migration branch from current main.
- [ ] Capture baseline test/build state:
  - [ ] `npm run lint`
  - [ ] `npm test`
  - [ ] `npm run build`
- [ ] Record Supabase rollback values in a secure runbook (URL, publishable key, service role key usage points).

## Phase 1: Neon Project, Schema Compatibility, and Data Import

### 1.1 Neon project and branch setup

- [x] Create Neon project and a dedicated migration branch.
- [x] Confirm Postgres version compatibility with current Supabase project.
- [x] Store Neon URLs for frontend/backend use (`NEON_DATA_API_URL`, `NEON_AUTH_URL`).
  - [x] Stored in local `.neon` (auth URL + Data API URL).

### 1.2 SQL compatibility and migration prep

- [x] Create a new migration SQL for Neon auth wrappers:
  - [x] `supabase/migrations/20260213010000_neon_auth_wrappers.sql`
  - [x] Add `create schema if not exists auth;`
  - [x] Add `auth.uid()` wrapper
  - [x] Add `auth.jwt()` wrapper
- [x] Add Neon auth bootstrap migration before existing schema migrations:
  - [x] `supabase/migrations/20260208090000_neon_auth_bootstrap.sql`
  - [x] Ensure `anon` role and auth wrapper functions exist before RLS policy creation.
- [x] Update anonymous-auth-dependent SQL:
  - [x] `supabase/migrations/20260210010000_phase1_community_schema.sql`
  - [x] Remove `public.is_non_anonymous_account()` function and related policy predicates
- [x] Fix Supabase Realtime publication SQL:
  - [x] `supabase/migrations/20260211010000_notifications.sql`
  - [x] Remove or guard `alter publication supabase_realtime ...`

### 1.3 Data migration runbook

- [x] Export Supabase public schema/data with `pg_dump` (unpooled connection).
  - [x] Executed with `pg_dump` via Supabase CLI login role (`--role postgres`) using available pooled endpoint credentials.
- [x] Restore into Neon with `pg_restore --no-owner --no-acl`.
  - [x] Restored from a `--no-owner --no-acl` full SQL dump via `psql` (functionally equivalent for this run).
- [x] Validate counts for critical tables (`profiles`, `saved_prompts`, `community_posts`, `community_comments`, `community_votes`, `notifications`).

### 1.4 Phase 1 gate

- [x] All migrations apply cleanly on Neon branch.
- [x] No remaining `supabase_realtime` SQL references in active migration path.

## Phase 2: Frontend Client + Types + Env Migration

### 2.1 Dependencies and generated types

- [x] `package.json`
  - [x] Add `@neondatabase/neon-js`
  - [x] Remove `@supabase/supabase-js` during Phase 8 cleanup
- [x] Generate Neon DB types:
  - [x] Output to `src/integrations/neon/types.ts`

### 2.2 New Neon client module

- [x] Create `src/integrations/neon/client.ts`
  - [x] Initialize `createClient`
  - [x] Use `SupabaseAuthAdapter()`
  - [x] Read `VITE_NEON_DATA_API_URL` and `VITE_NEON_AUTH_URL`

### 2.3 Env typing and examples

- [x] `.env.example`
  - [x] Add `VITE_NEON_PROJECT_ID` (if used)
  - [x] Add `VITE_NEON_DATA_API_URL`
  - [x] Add `VITE_NEON_AUTH_URL`
  - [x] Remove legacy Supabase vars after cutover
- [x] `src/vite-env.d.ts`
  - [x] Add Neon env types
  - [x] Remove transitional Supabase env types after cutover

### 2.4 Replace frontend imports

- [x] `src/lib/persistence.ts`
  - [x] `@/integrations/supabase/client` -> `@/integrations/neon/client`
  - [x] `@/integrations/supabase/types` -> `@/integrations/neon/types`
  - [x] Replace `PostgrestError` import source if needed
- [x] `src/lib/community.ts`
  - [x] Switch client/types imports to Neon equivalents
- [x] `src/lib/notifications.ts`
  - [x] Switch client import to Neon
- [x] `src/lib/ai-client.ts`
  - [x] Switch auth/session calls to Neon-backed client
  - [x] Replace function URL builder away from `*.supabase.co/functions/v1`
- [x] `src/lib/saved-prompt-shared.ts`
  - [x] Replace `PostgrestError` import source
  - [x] Switch `Json` import to Neon types
- [x] `src/lib/library-pages.ts`
  - [x] Replace Supabase `User` type import with Neon-auth-compatible type
- [x] `src/hooks/useAuth.tsx`
  - [x] Switch client import to Neon
  - [x] Update `User`/`Session`/`Provider` typing
  - [x] Remove anonymous sign-in flow
- [x] `src/components/AuthDialog.tsx`
  - [x] Update OAuth provider integration for Neon auth
- [x] `src/pages/CommunityPost.tsx`
  - [x] Remove UI checks tied to `is_anonymous`

### 2.5 Phase 2 gate

- [x] `rg -n "@/integrations/supabase/client|@supabase/supabase-js" src` only returns intentional transitional references.
- [x] `npm run lint && npm test && npm run build` passes with Neon env values.

## Phase 3: Move Edge Functions to `agent_service`

### 3.1 Create Node routes in `agent_service`

- [x] `agent_service/codex_service.mjs`
  - [x] Add route equivalent for `enhance-prompt`
  - [x] Add route equivalent for `extract-url`
  - [x] Add route equivalent for `infer-builder-fields`
  - [x] Preserve SSE contract used by frontend

### 3.2 Port logic from Supabase functions

- [x] Source parity checks:
  - [x] `archive/supabase/functions/enhance-prompt/index.ts`
  - [x] `archive/supabase/functions/enhance-prompt/thread-options.ts`
  - [x] `archive/supabase/functions/extract-url/index.ts`
  - [x] `archive/supabase/functions/infer-builder-fields/index.ts`

### 3.3 Replace Supabase-specific auth middleware

- [x] Replace logic currently in `archive/supabase/functions/_shared/security.ts` with Node middleware in `agent_service`
  - [x] Validate Neon JWT
  - [x] Keep rate limiting behavior
  - [x] Keep CORS behavior
  - [x] Remove anonymous-auth branches

### 3.4 Remove legacy gateway dependency

- [x] Port `extract-url` to direct OpenAI API call in `agent_service` route.
- [x] Remove any required `LOVABLE_*` runtime dependency from this flow.

### 3.5 Phase 3 gate

- [x] API parity verified for all three endpoints.
- [x] Frontend can call Azure `agent_service` endpoints end-to-end.

## Phase 4: Notifications Realtime Replacement (MVP polling)

- [x] `src/hooks/useNotifications.ts`
  - [x] Remove `supabase.channel(...).on("postgres_changes", ...)`
  - [x] Implement 30s polling with visibility-aware pause/resume
  - [x] Keep `refresh()` as the single update path
- [x] Remove channel cleanup call (`removeChannel`) logic tied to Supabase realtime.

### 4.1 Phase 4 gate

- [x] Notification badge/list updates within polling interval.
- [x] Hidden-tab behavior pauses polling; foreground resumes correctly.

## Phase 5: Test Migration

- [x] `src/test/persistence.test.ts`
  - [x] Mock Neon client module path
- [x] `src/test/community-load-post.test.ts`
  - [x] Mock Neon client module path
- [x] `src/test/notifications-lib.test.ts`
  - [x] Mock Neon client module path
- [x] `src/test/ai-client-auth.test.ts`
  - [x] Replace `VITE_SUPABASE_*` stubs with `VITE_NEON_*`
  - [x] Update client mock path
- [x] `src/test/useNotifications.test.ts`
  - [x] Replace realtime channel mocks with polling behavior tests
- [x] `src/test/edge-auth.test.ts`
  - [x] Update env stubs from `SUPABASE_*` to Neon equivalents
  - [x] Validate new middleware behavior
- [x] `src/test/enhance-thread-options.test.ts`
  - [x] Update imports/fixtures to new `agent_service` location
- [x] `src/test/rls-community-comments.test.ts`
  - [x] Replace Supabase client creation with Neon-compatible approach
- [x] `src/test/rls-community-votes.test.ts`
  - [x] Replace Supabase client creation with Neon-compatible approach

### 5.1 Phase 5 gate

- [x] `npm test` passes.
- [x] `npm run test:rls` executes and passes (env-gated; skips when Neon RLS env vars are not provided).

## Phase 6: CI/CD and Deployment Variables

- [x] `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
  - [x] Replace `VITE_SUPABASE_PROJECT_ID` secret use
  - [x] Replace `VITE_SUPABASE_URL` secret use
  - [x] Replace `VITE_SUPABASE_PUBLISHABLE_KEY` secret use
  - [x] Inject Neon env vars instead
- [x] Configure GitHub repo secrets:
  - [x] `VITE_NEON_PROJECT_ID` (if used)
  - [x] `VITE_NEON_DATA_API_URL`
  - [x] `VITE_NEON_AUTH_URL`
- [x] Add Neon GitHub branch automation (PR create/delete) if adopted.

### 6.1 Phase 6 gate

- [ ] PR preview deployments build with Neon env only.
- [x] No required Supabase secrets in CI for standard app flows.

## Phase 7: Cutover Validation

- [x] Run pre-cutover gate:
  - [x] `npm run lint`
  - [x] `npm test`
  - [x] `npm run build`
  - [x] `npm run test:mobile`
- [x] Manual smoke checklist:
  - [x] Sign up / sign in / sign out
  - [x] Prompt create/edit/delete
  - [x] Community post/comment/vote
  - [x] AI enhancement + URL extraction + builder inference
  - [x] Notifications refresh behavior
- [x] Monitor production logs/errors and latency during controlled rollout (see `docs/neon-cutover-runbook.md`).
- [x] Keep rollback env and deployment manifest ready until stabilization window ends (see `docs/neon-cutover-runbook.md`).

## Phase 8: Cleanup (After Stable Cutover)

- [x] `package.json`
  - [x] Remove `@supabase/supabase-js`
- [x] Delete `src/integrations/supabase/client.ts`
- [x] Delete `src/integrations/supabase/types.ts`
- [x] Decide deprecation/archive path for:
  - [x] `supabase/functions/` moved to `archive/supabase/functions/`
  - [x] `supabase/` CLI structure kept for migrations
- [x] Update docs:
  - [x] `agent_service/README.md`
  - [x] `.github/copilot-instructions.md`
  - [x] `docs/neon-cutover-runbook.md`
  - [x] Any remaining Supabase references in `docs/` are either archived references or migration history.

### 8.1 Final gate

- [x] `rg -n "SUPABASE|@supabase|integrations/supabase|supabase.co" .` only returns archived references and intentional migration history (plus `package-lock.json` transitive dependencies from Neon SDK internals).
- [x] `npm run check:prod` passes.

## File Coverage Index (Current Supabase Touchpoints)

Use this list as a completion audit. Every path below must be migrated, archived, or intentionally retained.

- [x] `.env.example`
- [x] `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
- [x] `.github/copilot-instructions.md`
- [x] `package.json`
- [x] `src/vite-env.d.ts`
- [x] `src/integrations/supabase/client.ts` (deleted)
- [x] `src/integrations/supabase/types.ts` (deleted)
- [x] `src/hooks/useAuth.tsx`
- [x] `src/hooks/useNotifications.ts`
- [x] `src/lib/ai-client.ts`
- [x] `src/lib/community.ts`
- [x] `src/lib/library-pages.ts`
- [x] `src/lib/notifications.ts`
- [x] `src/lib/persistence.ts`
- [x] `src/lib/saved-prompt-shared.ts`
- [x] `src/components/AuthDialog.tsx`
- [x] `src/pages/CommunityPost.tsx`
- [x] `archive/supabase/functions/_shared/security.ts` (archived)
- [x] `archive/supabase/functions/enhance-prompt/index.ts` (archived)
- [x] `archive/supabase/functions/enhance-prompt/thread-options.ts` (archived)
- [x] `archive/supabase/functions/extract-url/index.ts` (archived)
- [x] `archive/supabase/functions/infer-builder-fields/index.ts` (archived)
- [x] `supabase/migrations/20260209000000_initial_schema.sql`
- [x] `supabase/migrations/20260209001000_hardening_persistence.sql`
- [x] `supabase/migrations/20260210010000_phase1_community_schema.sql`
- [x] `supabase/migrations/20260210020000_tighten_community_votes_rls.sql`
- [x] `supabase/migrations/20260210030000_tighten_community_comments_rls.sql`
- [x] `supabase/migrations/20260210040000_spec_alignment_saved_prompts_community.sql`
- [x] `supabase/migrations/20260211010000_notifications.sql`
- [x] `supabase/migrations/20260211020000_gravatar_avatar_fallback.sql`
- [x] `src/test/persistence.test.ts`
- [x] `src/test/community-load-post.test.ts`
- [x] `src/test/notifications-lib.test.ts`
- [x] `src/test/ai-client-auth.test.ts`
- [x] `src/test/useNotifications.test.ts`
- [x] `src/test/edge-auth.test.ts`
- [x] `src/test/enhance-thread-options.test.ts`
- [x] `src/test/rls-community-comments.test.ts`
- [x] `src/test/rls-community-votes.test.ts`
