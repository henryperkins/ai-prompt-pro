# PromptForge Cloudflare Migration Regression Remediation

Last updated: 2026-03-26

## Scope

This plan turns the staged Cloudflare migration review findings into an
implementation sequence grounded in the current repository.

It covers these regressions:

- Broken OAuth entry points in the auth dialog
- Password reset reporting success without a real reset path
- Expired access tokens breaking authenticated app flows
- Profile edits reverting after session revalidation
- Prompt sharing dropping the community post id
- Lost optimistic concurrency protection on prompt updates
- GitHub-backed prompts no longer being blocked from sharing

It also aligns the worker-backed runtime with the existing repository test
surface so the migration lands without leaving auth, persistence, and sharing in
an inconsistent state.

Primary repository references:

- `src/components/AuthDialog.tsx`
- `src/hooks/auth-provider.tsx`
- `src/lib/api-client.ts`
- `src/lib/persistence.ts`
- `src/lib/community.ts`
- `src/lib/require-user-id.ts`
- `src/lib/service-auth.ts`
- `src/pages/Library.tsx`
- `src/hooks/usePromptBuilder.ts`
- `workers/auth/index.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`
- `workers/d1/schema.sql`
- `src/test/useAuth.sign-up.test.tsx`
- `src/test/github-client.test.ts`
- `src/test/ai-client-auth.test.ts`
- `src/test/persistence.test.ts`
- `src/test/notifications-lib.test.ts`
- `src/test/contact-support.test.ts`
- `src/test/require-user-id.test.ts`

## 1. Target End State

The migration is complete when these conditions are true:

- Browser auth state has one source of truth.
- Every same-origin API call can transparently refresh an expired access token
  once before failing.
- The UI only renders auth capabilities that the worker actually supports.
- Profile reads and writes use one consistent source of truth.
- Prompt save, update, share, unshare, and delete contracts preserve the
  previous validation and conflict guarantees.
- Worker responses use the shapes that the current frontend and tests expect.
- The existing auth, AI client, GitHub client, persistence, and community tests
  pass against the worker-backed runtime.

## 2. Architectural Decisions

### 2.1 Keep same-origin Cloudflare auth and API as the runtime model

Do not reintroduce direct Neon client usage in app runtime code.

The current migration already moved user-facing calls toward:

- `/auth/*` in `workers/auth/index.ts`
- `/api/*` in `workers/api/index.ts`

The fix should finish that migration instead of mixing worker-backed auth with
legacy direct browser database access.

### 2.2 Create one shared browser auth runtime

Right now token parsing and storage logic is duplicated in:

- `src/hooks/auth-provider.tsx`
- `src/lib/api-client.ts`
- `src/lib/persistence.ts`
- `src/lib/service-auth.ts`

That duplication is the main reason expired sessions now fail differently across
the app.

Create one shared auth runtime module and make everything else consume it.

Recommended new module:

- `src/lib/browser-auth.ts`

Responsibilities:

- Read stored tokens
- Write stored tokens
- Clear stored tokens
- Decode JWT payload
- Return current user id from the current valid token
- Call `/auth/session`
- Call `/auth/refresh`
- Call `/auth/logout`
- Refresh once on demand
- Serialize concurrent refresh attempts behind a single promise

### 2.3 Keep UI honest when backend capability is missing

The current auth dialog still advertises OAuth and password reset behavior that
the worker does not actually support. The fix must prefer truthful UX over
placeholder success.

## 3. Step-by-Step Implementation

### Step 1. Build the shared browser auth runtime

Files:

- Add `src/lib/browser-auth.ts`
- Update `src/lib/api-client.ts`
- Update `src/lib/require-user-id.ts`
- Update `src/lib/service-auth.ts`
- Update `src/hooks/auth-provider.tsx`

Implementation:

1. Move token storage helpers out of `src/hooks/auth-provider.tsx`,
   `src/lib/api-client.ts`, `src/lib/persistence.ts`, and
   `src/lib/service-auth.ts`.
2. Expose a single API from `src/lib/browser-auth.ts`:
   - `readStoredTokens()`
   - `writeStoredTokens(accessToken, refreshToken)`
   - `clearStoredTokens()`
   - `decodeAccessToken(accessToken)`
   - `getStoredUserId()`
   - `validateSession(accessToken)`
   - `refreshAccessToken(refreshToken)`
   - `getValidAccessToken({ forceRefresh?: boolean })`
   - `logoutCurrentSession()`
3. Make refresh deduped. If several requests hit an expired token at once, only
   one `/auth/refresh` call should run.
4. Teach `src/lib/api-client.ts` to:
   - fetch with the current access token
   - retry once after a refresh if the first response is `401`
   - clear tokens only after refresh definitively fails
5. Change `src/lib/require-user-id.ts` to use the shared auth runtime instead of
   blindly decoding stale localStorage state.
6. Change `src/lib/service-auth.ts` to use the shared runtime for its default
   auth client so AI and GitHub service calls follow the same refresh and
   invalidation rules as the rest of the app.

Acceptance criteria:

- Community, notifications, contact support, and prompt persistence survive an
  expired access token when a valid refresh token is present.
- `src/test/github-client.test.ts` and `src/test/ai-client-auth.test.ts` no
  longer fail because service auth and browser auth disagree about session
  state.

### Step 2. Repair `AuthProvider` around the shared runtime

Files:

- `src/hooks/auth-provider.tsx`
- `src/hooks/useAuth.tsx`
- `src/test/useAuth.sign-up.test.tsx`

Implementation:

1. Keep the public `useAuth()` contract stable.
2. On mount:
   - read stored tokens
   - validate the current access token
   - refresh if needed
   - clear local auth state only after both validation and refresh fail
3. On `signUp` and `signIn`:
   - call the worker
   - store tokens via the shared runtime
   - normalize and enrich the returned user consistently
4. On `signOut`:
   - attempt remote logout
   - always clear local tokens and React state
5. On `deleteAccount`:
   - call `/auth/account`
   - always clear local tokens and React state after success
6. Update unit tests so they mock worker-backed fetches or the shared auth
   runtime, not the legacy Neon browser client.

Acceptance criteria:

- `src/test/useAuth.sign-up.test.tsx` passes against the worker-backed auth
  contract.
- Local sign-out and delete-account still succeed even if the remote cleanup
  call fails.

### Step 3. Make the auth dialog truthful

Files:

- `src/components/AuthDialog.tsx`
- `src/hooks/auth-provider.tsx`
- `workers/auth/index.ts`

Implementation:

1. Remove the Apple button immediately. The current `AuthOAuthProvider` type is
   `google | github`, but the dialog still renders Apple.
2. Add explicit capability gating for OAuth buttons.
   Recommended options:
   - expose `oauthProviders` from auth context, or
   - derive an `oauthEnabled` list from worker config and pass it into the
     dialog
3. Until worker OAuth is fully implemented, do not render Google/GitHub buttons
   in production UI.
4. Replace the current password reset placeholder flow with one of these
   repository-backed choices:
   - preferred: implement the full request + confirm flow
   - fallback: hide the CTA and route users to support until email delivery is
     configured

Preferred password reset implementation:

1. Add a reset-token store:
   - add a `password_reset_tokens` table in `workers/d1/schema.sql`, or
   - add a separate KV namespace if the team wants short-lived token storage out
     of D1
2. Keep `POST /auth/reset-password` as the request endpoint, but make it create
   a real signed reset token with an expiry.
3. Add a confirm endpoint:
   - `POST /auth/reset-password/confirm`
4. Add a frontend reset route and form for the token-confirm step.
5. If email delivery is not configured, return `501` with a truthful message and
   have `AuthDialog` render a support CTA instead of a success state.

Acceptance criteria:

- The dialog never advertises an auth path that the worker cannot complete.
- Password reset no longer shows a false positive success state.

### Step 4. Make profile reads and writes consistent

Files:

- `workers/auth/index.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`
- `src/hooks/auth-provider.tsx`

Implementation:

1. Choose `profiles` as the browser-facing source of truth for display name and
   avatar metadata.
2. Change `/auth/session` to join `users` with `profiles` instead of reading
   `display_name` and `avatar_url` only from `users`.
3. Keep `/api/profile/me` writing to `profiles`.
4. During the migration window, also mirror display-name writes into `users` if
   backward compatibility is still needed for existing data paths.
5. Update `AuthProvider.updateDisplayName()` so local optimistic state matches
   the session payload shape returned by `/auth/session`.

Acceptance criteria:

- A display-name update survives reload, revalidation, and re-login.

### Step 5. Restore persistence invariants

Files:

- `src/lib/persistence.ts`
- `src/lib/community.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`
- `src/test/persistence.test.ts`

Implementation:

1. Reintroduce strict save-time normalization and validation before requests
   leave the browser:
   - text sanitization
   - tag normalization
   - use-case validation
   - GitHub-source share blocking
2. Restore derived metadata in prompt summaries:
   - compute `containsGithubSources` from prompt config instead of hardcoding
     `false`
3. Restore optimistic concurrency:
   - send `expectedRevision` from `src/lib/persistence.ts`
   - change worker update SQL to `WHERE id = ? AND user_id = ? AND revision = ?`
   - return `409` when the revision does not match
4. Make `deletePrompt`, `deletePrompts`, `unsharePrompt`, and
   `unsharePrompts` return actual success semantics rather than always returning
   the requested ids.
5. Do not swallow fetch failures while deciding create-vs-update.
   Use `404` as the only "missing prompt" signal.
6. Preserve the current client-facing metadata shape returned from
   `savePrompt()` so `usePromptBuilder` and library flows do not regress.

Acceptance criteria:

- Concurrent edits surface a conflict instead of silently overwriting.
- GitHub-backed prompts are blocked from sharing again.
- `src/test/persistence.test.ts` passes with worker-backed implementations.

### Step 6. Fix share and community response contracts

Files:

- `src/lib/persistence.ts`
- `src/hooks/usePromptBuilder.ts`
- `workers/api/index.ts`
- `workers/api/handlers.ts`

Implementation:

1. Standardize the share response shape to camelCase on the frontend boundary.
2. The worker can return either:
   - `{ shared: true, postId }`, or
   - `{ shared: true, post_id }` internally with an API-layer mapper
3. Update the frontend parser so `usePromptBuilder` gets `postId` reliably and
   can keep rendering the "View" link after share.
4. Preserve this same contract for library share flows and any future bulk-share
   UX.

Acceptance criteria:

- Sharing a prompt returns a working community post link from both the builder
  and the library.

### Step 7. Restore OAuth parity only after the worker can complete it

Files:

- `workers/auth/index.ts`
- `src/hooks/auth-provider.tsx`
- `src/components/AuthDialog.tsx`
- `.env.example`
- `workers/README.md`

Implementation:

1. Do not bring OAuth buttons back until the worker supports:
   - start endpoint per provider
   - callback endpoint per provider
   - state validation
   - user lookup / create / link
   - session issuance
2. If OAuth parity is required in this migration, implement:
   - `GET /auth/oauth/:provider/start`
   - `GET /auth/oauth/:provider/callback`
3. Add env documentation for provider ids, secrets, redirect URLs, and enabled
   providers.
4. Re-enable provider buttons only when the worker advertises them as enabled.

Acceptance criteria:

- OAuth buttons appear only for configured, working providers.

### Step 8. Update tests to the worker-backed contracts

Files:

- `src/test/useAuth.sign-up.test.tsx`
- `src/test/github-client.test.ts`
- `src/test/ai-client-auth.test.ts`
- `src/test/persistence.test.ts`
- `src/test/notifications-lib.test.ts`
- `src/test/contact-support.test.ts`
- `src/test/require-user-id.test.ts`

Implementation:

1. Replace legacy Neon mocks in auth and persistence tests with:
   - fetch mocks for `/auth/*` and `/api/*`, or
   - focused mocks around the new shared auth runtime
2. Keep `src/test/service-auth.test.ts` as the pure unit suite for
   `createServiceAuth({ authClient })`.
3. Add targeted tests for:
   - API client single-refresh retry on `401`
   - `requireUserId()` with expired access token and valid refresh token
   - password-reset unavailability showing truthful UI
   - share response mapping from `post_id` to `postId`
   - profile update surviving a subsequent session validation
   - GitHub-source share blocking on worker-backed persistence

Acceptance criteria:

- The tests that currently fail because of the migration now pass under the
  worker-backed runtime.

## 4. Execution Order

Apply the work in this order:

1. Step 1: shared browser auth runtime
2. Step 2: `AuthProvider`
3. Step 3: auth dialog truthfulness
4. Step 4: profile consistency
5. Step 5: persistence invariants
6. Step 6: share response contract
7. Step 7: OAuth parity restoration or capability gating
8. Step 8: tests and final verification

This order keeps the auth contract stable before changing persistence and
sharing, which prevents compounding failures.

## 5. Verification Plan

Run these targeted checks while implementing:

```bash
npx vitest run \
  src/test/useAuth.sign-up.test.tsx \
  src/test/service-auth.test.ts \
  src/test/github-client.test.ts \
  src/test/ai-client-auth.test.ts \
  src/test/persistence.test.ts \
  src/test/notifications-lib.test.ts \
  src/test/contact-support.test.ts \
  src/test/require-user-id.test.ts
```

Then run the repo gates:

```bash
npm run lint
npm run test:unit
npm run build
```

If OAuth or password reset is enabled in the same branch, also add a manual QA
pass for:

- sign up
- sign in
- sign out
- refresh after access token expiry
- change display name
- share from builder
- share from library
- open shared post link
- forgot-password request
- forgot-password confirm
- each enabled OAuth provider

## 6. Definition of Done

This remediation is done when:

- No broken auth affordance remains in the UI.
- Access token expiry is handled consistently across app APIs and service calls.
- Profile edits persist across revalidation.
- Sharing returns a working post link.
- Prompt updates reject stale revisions.
- GitHub-backed prompts are blocked from sharing again.
- The targeted auth and persistence tests pass.
- `npm run lint`, `npm run test:unit`, and `npm run build` pass on the branch.
