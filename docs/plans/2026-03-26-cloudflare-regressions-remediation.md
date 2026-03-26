# PromptForge Cloudflare Regression Remediation

Last updated: 2026-03-26

## Scope

This plan turns the current uncommitted-review findings into an implementation
sequence grounded in the repository as it exists today.

It addresses these confirmed regressions:

- Signed-in persistence calls now pass `user.id` into worker clients that expect
  a bearer token.
- Auth and password-reset calls now resolve against inconsistent origins:
  `VITE_AUTH_WORKER_URL` in some places, same-origin `/auth/*` in others.
- Cloud version history was replaced with frontend stubs even though the worker
  already exposes `/api/versions`.
- Prompt save, update, share, unshare, and summary mapping no longer preserve
  the prior browser-side normalization and worker response contract.
- Prompt summaries now lose `communityPostId`, share counts, GitHub-source
  detection, and timestamp normalization.
- Prompt update flows no longer send `expected_revision`, so stale writes are no
  longer rejected by the worker.
- GitHub-backed prompts are no longer reliably blocked from sharing on the
  frontend boundary.
- Display-name edits are now local-only and revert after reload or session
  revalidation.
- The worker auth provider requires `VITE_AUTH_WORKER_URL`, which breaks the
  existing same-origin test surface and any environment relying on relative
  `/auth/*` routing.

Primary repository references:

- `src/hooks/auth-provider-cf.tsx`
- `src/hooks/useAuth.tsx`
- `src/hooks/usePromptBuilder.ts`
- `src/hooks/useDraftPersistence.ts`
- `src/components/AuthDialog.tsx`
- `src/pages/ResetPassword.tsx`
- `src/lib/browser-auth.ts`
- `src/lib/auth-api.ts`
- `src/lib/cf-api-client.ts`
- `src/lib/cf-persistence.ts`
- `src/lib/persistence.ts`
- `src/lib/context-types.ts`
- `src/lib/template-store.ts`
- `workers/index.ts`
- `workers/auth/index.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`
- `workers/d1/schema.sql`
- `src/test/useAuth.sign-up.test.tsx`
- `src/test/auth-dialog-throttle.test.tsx`
- `src/test/persistence.test.ts`
- `src/test/usePromptBuilder.test.tsx`
- `src/test/notifications-lib.test.ts`
- `src/test/contact-support.test.ts`
- `src/test/require-user-id.test.ts`

## 1. Target End State

The migration is complete when these conditions are true:

- Authenticated browser code has one token/runtime source of truth.
- Worker-backed auth and API calls resolve through one consistent URL model that
  supports configured worker origins and same-origin `/auth` and `/api`
  fallbacks.
- Signed-in persistence, draft autosave, sharing, and version-history calls use
  a valid access token, never `user.id`, as transport auth.
- Prompt version history is backed by the existing worker endpoints instead of
  frontend stubs.
- Prompt save, update, and share operations preserve normalization, conflict
  detection, GitHub-share blocking, and response mapping.
- Prompt summaries expose the same metadata shape the current UI and tests
  expect: `communityPostId`, share counts, `containsGithubSources`,
  millisecond timestamps, and accurate share state.
- Password reset uses the same auth-origin resolution as sign-in and sign-up.
- Profile edits persist across reload, refresh, and session revalidation.
- The worker-backed auth, persistence, notifications, and builder tests pass.

## 2. Architectural Decisions

### 2.1 Use one endpoint-resolution model for worker-backed auth and API calls

The current repo supports both:

- configured worker origins via `VITE_AUTH_WORKER_URL` and
  `VITE_API_WORKER_URL`
- same-origin `/auth/*` and `/api/*` paths via Vite proxy and `workers/index.ts`

The fix should not pick one of these ad hoc per file. Instead, create one small
runtime utility that resolves:

- auth URLs from `VITE_AUTH_WORKER_URL`, else same-origin `/auth/*`
- API URLs from `VITE_API_WORKER_URL`, else same-origin `/api/*`

Recommended new module:

- `src/lib/worker-endpoints.ts`

Responsibilities:

- `resolveAuthUrl(path: string): string`
- `resolveApiUrl(path: string): string`
- normalize trailing slashes
- preserve same-origin behavior when env vars are unset

All worker-backed callers should move onto this module:

- `src/lib/auth-api.ts`
- `src/lib/cf-api-client.ts`
- `src/hooks/auth-provider-cf.tsx`

### 2.2 Keep one shared browser auth runtime

The repo already contains most of this in `src/lib/browser-auth.ts`. Finish the
migration by making it the only browser token/session runtime.

It should own:

- token storage
- token clearing
- JWT decoding
- access-token refresh
- session bootstrap
- same-origin auth fetch helpers
- access-token lookup for worker-backed browser features

`AuthProvider`, service auth, and worker-backed persistence should consume this
runtime instead of duplicating token logic.

### 2.3 Pass access tokens, never user ids, across worker-backed persistence

The current persistence surface in `src/lib/cf-persistence.ts` expects an access
token. The builder and draft hooks still pass `user?.id`.

Do not adapt the worker clients to accept a user id. The correct fix is to:

- expose or read the valid access token from the auth runtime
- keep `user.id` only for local cache keys and UI identity
- keep worker auth transport strictly bearer-token based

### 2.4 Prefer real worker parity over frontend stubs

The worker already exposes:

- `/api/versions`
- prompt revision checking via `expected_revision`
- `community_post_id`
- counts for upvotes, verified, remixes, and comments
- worker-side GitHub-share blocking

The frontend fix should restore these contracts instead of hardcoding fallback
values or shipping placeholder success paths.

### 2.5 Keep the UI honest about backend capability

The dialog and reset flow should only advertise behavior the current worker can
complete. Capability discovery is fine, but it must resolve through the same
auth-origin model as the rest of auth.

## 3. Step-by-Step Implementation

### Step 1. Add a shared worker endpoint resolver

Files:

- Add `src/lib/worker-endpoints.ts`
- Update `src/lib/auth-api.ts`
- Update `src/lib/cf-api-client.ts`
- Update `src/hooks/auth-provider-cf.tsx`

Implementation:

1. Add `resolveAuthUrl(path)` and `resolveApiUrl(path)` helpers.
2. Resolve `VITE_AUTH_WORKER_URL` and `VITE_API_WORKER_URL` when configured.
3. Fall back to same-origin relative URLs when those env vars are unset.
4. Replace direct string concatenation in `auth-provider-cf.tsx`.
5. Replace `resolveRequestUrl("/auth/...")` and raw `http://localhost:*`
   fallbacks in worker-backed clients.
6. Keep `src/lib/browser-auth.ts` same-origin for `/auth/*` if that remains the
   shared browser runtime, but ensure the repo has one obvious policy instead of
   split logic.

Acceptance criteria:

- Sign-in, sign-up, password-reset request, password-reset confirm, and auth
  capability fetches all use the same auth-origin resolution.
- Existing auth tests can run with no `VITE_AUTH_WORKER_URL` set.
- Split frontend/auth deployments still target the auth worker correctly.

### Step 2. Finish `AuthProvider` on top of the shared browser auth runtime

Files:

- `src/hooks/auth-provider-cf.tsx`
- `src/hooks/auth-context.ts`
- `src/hooks/useAuth.tsx`
- `src/lib/browser-auth.ts`
- `src/test/useAuth.sign-up.test.tsx`

Implementation:

1. Keep the public `useAuth()` contract stable.
2. On mount:
   - restore stored tokens
   - validate session
   - refresh once if needed
   - clear local auth state only after both checks fail
3. Make `signUp`, `signIn`, `signOut`, `deleteAccount`, and
   `requestPasswordReset` use the shared endpoint-resolution model.
4. Do not hard-fail all auth operations just because `VITE_AUTH_WORKER_URL` is
   unset if same-origin auth is available.
5. Expose the current session access token consistently for downstream
   persistence calls.

Acceptance criteria:

- `src/test/useAuth.sign-up.test.tsx` passes.
- Sign-out still clears local state even if the remote logout fails.
- Delete-account still clears local state after a successful worker delete.

### Step 3. Thread the access token through all worker-backed persistence calls

Files:

- `src/hooks/usePromptBuilder.ts`
- `src/hooks/useDraftPersistence.ts`
- `src/lib/persistence.ts`
- `src/lib/cf-persistence.ts`

Implementation:

1. Update `usePromptBuilder()` to read the signed-in session access token from
   `useAuth()`.
2. Keep `user.id` only for:
   - cache keys
   - UI state
   - identity comparisons
3. Pass `session?.accessToken ?? null` into:
   - `persistence.loadDraft`
   - `persistence.saveDraft`
   - `persistence.loadPrompts`
   - `persistence.loadPromptById`
   - `persistence.savePrompt`
   - `persistence.sharePrompt`
   - `persistence.unsharePrompts`
   - `persistence.deletePrompts`
   - `persistence.loadVersions`
   - `persistence.saveVersion`
4. Keep cloud-version cache keys on `user.id` so local cache behavior does not
   change.

Acceptance criteria:

- Signed-in draft autosave works again.
- Signed-in prompt load/save/share/delete works again.
- Signed-in library refresh stops sending `Authorization: Bearer <user-id>`.

### Step 4. Restore real cloud version history

Files:

- `src/lib/persistence.ts`
- `src/lib/cf-api-client.ts`
- `src/hooks/usePromptBuilder.ts`
- `workers/api/index.ts`
- `workers/d1/schema.sql`
- `src/test/usePromptBuilder.test.tsx`

Implementation:

1. Remove the version-history stubs in `src/lib/persistence.ts`.
2. Add worker-client helpers in `src/lib/cf-api-client.ts` for:
   - `loadVersions(accessToken)`
   - `saveVersion(accessToken, name, prompt)`
3. Re-export real implementations from `src/lib/persistence.ts`.
4. Keep the existing worker `/api/versions` routes as the backend source of
   truth.
5. Preserve the local guest-mode version flow exactly as-is.
6. Keep the builder’s optimistic cloud-version behavior and cache updates.

Acceptance criteria:

- Guest-to-cloud migration in `usePromptBuilder` works again.
- Signed-in version saves stop rolling back as failures.
- `loadVersions()` no longer always returns `[]`.

### Step 5. Fix the auth dialog and password-reset flow end to end

Files:

- `src/components/AuthDialog.tsx`
- `src/pages/ResetPassword.tsx`
- `src/lib/auth-api.ts`
- `src/hooks/auth-provider-cf.tsx`
- `workers/auth/index.ts`
- `.env.example`
- `workers/README.md`

Implementation:

1. Make `fetchAuthCapabilities()`, `requestPasswordReset()`, and
   `apiConfirmPasswordReset()` all use the same auth URL resolver.
2. Keep capability gating in `AuthDialog`, but do not let it silently fall back
   to the wrong origin.
3. Keep the current truthful support fallback when reset delivery is disabled.
4. Confirm that the reset link generated by the worker continues to point to the
   frontend `ResetPassword` route.
5. Keep the success state only after the confirm endpoint actually succeeds.
6. If OAuth is still unimplemented in the worker, keep those buttons hidden.

Acceptance criteria:

- Split-origin and same-origin deployments both request and confirm password
  resets successfully.
- The dialog never shows a false-positive reset success state.

### Step 6. Make profile writes persist across revalidation

Files:

- `src/hooks/auth-provider-cf.tsx`
- `src/lib/auth-api.ts`
- `src/lib/cf-api-client.ts`
- `workers/auth/index.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`

Implementation:

1. Change `AuthProvider.updateDisplayName()` to call the real profile API rather
   than mutating local state only.
2. Use the current session access token and `/api/profile/me`.
3. Keep the optimistic local update only as a UI sync layer after the request
   succeeds.
4. Ensure `/auth/session` and `/api/profile/me` read/write the same browser-
   facing display-name source of truth.
5. If needed during migration, mirror writes into both `profiles` and `users`,
   but only one response shape should reach the browser.

Acceptance criteria:

- A display-name change survives reload, refresh, and re-login.

### Step 7. Restore browser-side persistence invariants before requests leave the app

Files:

- `src/lib/persistence.ts`
- `src/lib/cf-persistence.ts`
- `src/lib/context-types.ts`
- `src/lib/saved-prompt-shared.ts`
- `src/test/persistence.test.ts`

Implementation:

1. Restore save-time sanitization for:
   - description
   - built prompt
   - enhanced prompt
   - use case
   - target model
   - remix note
2. Restore tag normalization and prompt-category normalization.
3. Restore create-vs-update semantics that treat only `404` as “missing”.
4. Restore `expected_revision` on updates.
5. Restore browser-side GitHub-share blocking using `hasGithubSources(...)`.
6. Restore browser-side use-case validation before share.
7. Preserve the existing `PersistenceError` mapping behavior.

Acceptance criteria:

- `src/test/persistence.test.ts` passes its sanitization and conflict cases.
- Stale writes surface conflicts again instead of silently overwriting.
- GitHub-backed prompts are blocked before share requests leave the browser.

### Step 8. Repair prompt summary and share-response mapping

Files:

- `src/lib/cf-persistence.ts`
- `src/lib/persistence.ts`
- `workers/api/handlers.ts`
- `src/pages/Library.tsx`
- `src/hooks/usePromptBuilder.ts`
- `src/test/persistence.test.ts`

Implementation:

1. Map worker `community_post_id` to frontend `communityPostId` instead of
   falling back to `prompt.id`.
2. Map worker counts into:
   - `upvoteCount`
   - `verifiedCount`
   - `remixCount`
   - `commentCount`
3. Convert worker second-based timestamps into frontend millisecond timestamps
   where the existing persistence contract expects ms.
4. Compute `containsGithubSources` from the loaded prompt config instead of
   hardcoding `false`.
5. Standardize share responses at the frontend boundary to `{ shared, postId }`
   even if the worker response contains `post_id`.

Acceptance criteria:

- Library “Open” links point to the actual community post.
- Prompt cards render accurate counts and timestamps.
- `containsGithubSources` is restored in prompt summaries.

### Step 9. Reconcile tests with the worker-backed runtime

Files:

- `src/test/useAuth.sign-up.test.tsx`
- `src/test/auth-dialog-throttle.test.tsx`
- `src/test/persistence.test.ts`
- `src/test/usePromptBuilder.test.tsx`
- `src/test/notifications-lib.test.ts`
- `src/test/contact-support.test.ts`
- `src/test/require-user-id.test.ts`

Implementation:

1. Update auth tests so they exercise the worker-backed provider through the
   shared endpoint-resolution model.
2. Mock fetch at the `/auth/*` and `/api/*` boundaries rather than a removed
   direct-browser-database flow.
3. Add or keep targeted tests for:
   - same-origin auth fallback when `VITE_AUTH_WORKER_URL` is unset
   - split-origin auth URL resolution when it is set
   - access-token threading through persistence
   - password-reset request and confirm
   - `expected_revision` propagation
   - `post_id` to `postId` mapping
   - version-history load/save on the worker-backed path
   - display-name persistence after a subsequent session reload

Acceptance criteria:

- The currently failing auth and persistence suites pass under the worker-backed
  runtime.

## 4. Execution Order

Apply the work in this order:

1. Step 1: shared worker endpoint resolution
2. Step 2: `AuthProvider` on the shared browser auth runtime
3. Step 3: access-token threading through persistence
4. Step 4: restore real cloud version history
5. Step 5: auth dialog and password-reset flow
6. Step 6: profile write persistence
7. Step 7: restore browser-side persistence invariants
8. Step 8: prompt summary and share-response mapping
9. Step 9: tests and final verification

This order stabilizes auth transport first, then fixes persistence, then fixes
the UI contracts layered on top of persistence.

## 5. Verification Plan

Run these targeted checks during implementation:

```bash
npx vitest run \
  src/test/useAuth.sign-up.test.tsx \
  src/test/auth-dialog-throttle.test.tsx \
  src/test/persistence.test.ts \
  src/test/usePromptBuilder.test.tsx \
  src/test/notifications-lib.test.ts \
  src/test/contact-support.test.ts \
  src/test/require-user-id.test.ts
```

Then run repo gates:

```bash
npm run lint
npm run test:unit
npm run build
```

Manual QA after the branch is green:

- sign up
- sign in
- sign out
- token refresh after access-token expiry
- draft autosave while signed in
- save prompt
- update prompt after a stale revision conflict
- save version while signed in
- share from builder
- share from library
- open the shared post link from library
- change display name
- forgot-password request
- forgot-password confirm

## 6. Definition of Done

This remediation is done when:

- Signed-in worker-backed browser calls use a valid access token everywhere.
- Auth and password-reset URL resolution is consistent across the app.
- Cloud version history is restored to a real worker-backed implementation.
- Prompt updates reject stale revisions again.
- Prompt summaries expose `communityPostId`, counts, timestamps, and
  `containsGithubSources` correctly.
- GitHub-backed prompts are blocked from sharing again.
- Display-name edits persist across reload and revalidation.
- The targeted auth, persistence, and builder tests pass.
- `npm run lint`, `npm run test:unit`, and `npm run build` pass on the branch.
