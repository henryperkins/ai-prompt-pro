# Auth, Neon & GitHub Integration Hardening Plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents are available) or `superpowers:executing-plans` to implement this plan. Keep the checkbox format and mark progress in place.

**Goal:** Address the auth, Neon, and GitHub hardening findings without introducing new regressions in signup, OAuth profile creation, GitHub setup redirects, or production logging.

**Revision note:** This version replaces the earlier broken remediation steps. The previous draft had five concrete execution problems:

1. the `profiles.display_name` constraint work would have broken current email signups and OAuth-created profiles
2. the Auth dialog throttle would have locked out signup as well as login
3. the GitHub API version regression test could not reach the request path because it used an invalid private key
4. the Neon SQL redaction tests did not cover the thrown-error log path
5. the GitHub setup redirect hardening still failed open when `ALLOWED_ORIGINS` was unset or `*`

**Tech Stack:** TypeScript (Vite/React), Node.js ESM, PostgreSQL/Neon, Vitest, `jose`

**Execution rules:**

- Do not ship any `profiles.display_name` database change without updating the frontend validator, signup fallback logic, and `handle_new_user()` trigger in the same task.
- Do not add a format regex to `profiles.display_name` that rejects the names the product already creates today.
- Do not hardcode a new GitHub API version date until you verify the current value in the official GitHub API version docs on the day you implement the task.
- Every hardening task must include at least one regression test that proves the previous bug is actually covered.

---

## Task 1: Extract shared `requireUserId` utility

This task from the original plan is still valid. The duplication is real, and the shared utility is a safe refactor if implemented with the existing auth error behavior.

**Files:**

- Create: `src/lib/require-user-id.ts`
- Modify: `src/lib/community.ts`
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/community-moderation.ts`
- Create: `src/test/require-user-id.test.ts`

- [x] **Step 1: Add a focused unit test for the shared helper**

Cover these cases in `src/test/require-user-id.test.ts`:

- authenticated user returns `user.id`
- backend assertion receives the feature label
- `neon.auth.getUser()` error objects surface `error.message`
- missing `user.id` throws `Sign in required.`
- default feature label is `Account actions`

- [x] **Step 2: Implement `src/lib/require-user-id.ts`**

Requirements:

- call `assertBackendConfigured(featureLabel)` first
- call `neon.auth.getUser()`
- surface `error.message` when present, otherwise fall back to `Authentication failed.`
- throw `Sign in required.` when no user id is present

- [x] **Step 3: Replace the local copies**

Update:

- `src/lib/community.ts`
- `src/lib/notifications.ts`
- `src/lib/community-moderation.ts`

Rules:

- remove each local `requireUserId()` copy
- replace each call site with `await requireUserId("<feature label>")`
- remove only the redundant backend-assert calls that immediately precede `requireUserId()`
- keep public-read functions on their existing backend-config checks

- [x] **Step 4: Run targeted tests**

```sh
npx vitest run src/test/require-user-id.test.ts
npx vitest run src/test/notifications-lib.test.ts
npx vitest run src/test/community-load-post.test.ts
```

- [x] **Step 5: Run the full unit suite**

```sh
npm run test:unit
```

- [ ] **Step 6: Commit**

```sh
git add src/lib/require-user-id.ts src/test/require-user-id.test.ts \
  src/lib/community.ts src/lib/notifications.ts src/lib/community-moderation.ts
git commit -m "refactor: extract shared requireUserId utility"
```

---

## Task 2: Align the display-name contract across signup, profile editing, and Postgres

The previous plan tried to mirror the old `validateDisplayName()` regex at the database layer. That is not safe for the current product:

- email signup fallback names currently preserve dots such as `jane.doe`
- explicit signup names currently preserve spaces such as `Jane Doe`
- OAuth provider names can contain spaces and punctuation
- the current `handle_new_user()` trigger includes Gravatar fallback logic that must not be lost

The fix is to define one contract that matches real product behavior, then enforce only those invariants everywhere.

**Canonical contract for this task:**

- `display_name` is optional in the database (`NULL` allowed)
- when present, it is trimmed, normalized user-facing text
- maximum length is 32 characters after normalization
- empty strings are stored as `NULL`
- do **not** reintroduce an ASCII-only format regex in this task

**Files:**

- Modify: `src/lib/profile.ts`
- Modify: `src/hooks/auth-provider.tsx`
- Modify: `src/test/profile-display-name.test.ts`
- Modify: `src/test/useAuth.sign-up.test.tsx`
- Create: `supabase/migrations/20260317010000_profiles_display_name_contract.sql`

- [x] **Step 1: Lock the intended behavior in frontend tests first**

Update `src/test/profile-display-name.test.ts` so the validator covers the names the app already uses:

- accepts `"Prompt Dev"`
- accepts `"jane.doe"`
- trims outer whitespace before validating
- collapses repeated internal whitespace during normalization
- rejects empty values
- rejects values longer than 32 characters

Update `src/test/useAuth.sign-up.test.tsx` so signup fallback logic is explicit:

- `jane.doe@example.com` still produces `jane.doe`
- a complex local part such as `jane+team@example.com` is normalized to a safe fallback before it is sent to Neon
- a provided display name such as `"  Jane Doe  "` is preserved after normalization

- [x] **Step 2: Add shared normalization helpers in `src/lib/profile.ts`**

Refactor `src/lib/profile.ts` to become the single source of truth for display-name handling.

Add:

- a normalizer that trims the value, removes unsupported hidden characters via `sanitizePostgresText`, and collapses whitespace to a single space if needed
- a signup fallback resolver that derives a safe 32-character display name from the email local part and falls back to `"Member"` if normalization produces nothing usable

Then update `validateDisplayName()` to enforce only the contract above:

- required for user-entered updates
- max length 32
- no format regex that rejects current shipped names

- [x] **Step 3: Update `src/hooks/auth-provider.tsx` to use the shared helpers**

In `AuthProvider`:

- replace the local `resolveSignUpName()` logic with imports from `src/lib/profile.ts`
- if the caller supplied a display name, validate it before calling `neon.auth.signUp()`
- keep writing both metadata keys:
  - `displayName`
  - `name`

The signup path must stay compatible with the current tests and with the new database constraint.

- [x] **Step 4: Write the migration against the current trigger, not the initial trigger**

Create `supabase/migrations/20260317010000_profiles_display_name_contract.sql`.

The migration must:

1. normalize existing rows without destroying legitimate names
2. add a safe constraint that matches the contract
3. preserve the current Gravatar/avatar fallback logic in `public.handle_new_user()`

Use this implementation strategy:

1. Normalize existing values:

   - trim whitespace
   - collapse repeated internal whitespace to a single space
   - truncate to 32 characters
   - convert empty strings to `NULL`

2. Add a conservative constraint such as:

   ```sql
   alter table public.profiles
     add constraint profiles_display_name_contract
     check (
       display_name is null
       or (
         char_length(display_name) between 1 and 32
         and display_name = btrim(display_name)
       )
     );
   ```

3. Recreate `public.handle_new_user()` by starting from the current function body in `supabase/migrations/20260211020000_gravatar_avatar_fallback.sql`.

4. Keep the existing `oauth_avatar` / `gravatar_url` logic exactly as-is.

5. Change only the `display_name` assignment to the contract-safe version, for example:

   ```sql
   nullif(left(regexp_replace(trim(coalesce(new.name, '')), '\s+', ' ', 'g'), 32), '')
   ```

This avoids the regression where the previous draft would have removed the Gravatar fallback entirely.

- [x] **Step 5: Add a migration review checklist to the implementation notes**

Before applying the migration, verify all of the following manually:

- the migration does not strip spaces or dots from existing names
- the recreated trigger still references `public.digest(...)`
- `avatar_url` still prefers OAuth avatar, then Gravatar, then empty string
- the new constraint allows `NULL` and trimmed 1..32 character values

- [x] **Step 6: Run targeted tests**

```sh
npx vitest run src/test/profile-display-name.test.ts
npx vitest run src/test/useAuth.sign-up.test.tsx
```

- [x] **Step 7: Run the full unit suite**

```sh
npm run test:unit
```

- [ ] **Step 8: Commit the contract change atomically**

Do not split the frontend and migration work into separate commits.

```sh
git add src/lib/profile.ts src/hooks/auth-provider.tsx \
  src/test/profile-display-name.test.ts src/test/useAuth.sign-up.test.tsx \
  supabase/migrations/20260317010000_profiles_display_name_contract.sql
git commit -m "fix(auth): align display-name contract across signup and profiles"
```

---

## Task 3: Add a login-only attempt throttle in `AuthDialog`

The earlier draft correctly identified missing client-side throttling, but the proposed implementation throttled both login and signup. This task must throttle repeated **login** failures only.

**Files:**

- Create: `src/lib/auth-throttle.ts`
- Create: `src/test/auth-throttle.test.ts`
- Create: `src/test/auth-dialog-throttle.test.tsx`
- Modify: `src/components/AuthDialog.tsx`

- [x] **Step 1: Keep the pure utility tests**

Create `src/test/auth-throttle.test.ts` for the throttle utility itself.

Cover:

- attempts below the threshold are allowed
- the threshold triggers a cooldown
- the cooldown expires automatically
- `recordSuccess()` clears the failure counter

- [x] **Step 2: Add a component test for the regression the previous draft missed**

Create `src/test/auth-dialog-throttle.test.tsx`.

Mock `useAuth()` and render the real `AuthDialog`.

Cover at least these flows:

1. repeated failed **login** attempts eventually show a cooldown error and stop calling `signIn`
2. repeated failed **signup** attempts do **not** trip the login throttle
3. a successful login resets the throttle
4. closing and reopening the dialog resets the throttle

Use fake timers so the cooldown path is deterministic.

- [x] **Step 3: Implement the throttle utility**

In `src/lib/auth-throttle.ts`:

- expose `canAttempt()`
- expose `recordFailure()`
- expose `recordSuccess()`
- expose `remainingCooldownMs()`

Keep the utility generic and side-effect free.

- [x] **Step 4: Integrate the throttle into `src/components/AuthDialog.tsx`**

Implementation rules:

- add `useRef`
- create one throttle instance per open dialog session
- run the cooldown check only when `mode === "login"`
- call `recordFailure()` only when a login attempt fails
- call `recordSuccess()` only when a login attempt succeeds
- reset the throttle inside `resetForm()`
- do not throttle:
  - signup
  - OAuth
  - forgot-password

- [x] **Step 5: Make the cooldown error user-facing**

When the login throttle is active:

- do not call `signIn`
- show a clear error such as `Too many attempts. Try again in 30s.`

Round the seconds up so the user never sees `0s` while still blocked.

- [x] **Step 6: Run targeted tests**

```sh
npx vitest run src/test/auth-throttle.test.ts
npx vitest run src/test/auth-dialog-throttle.test.tsx
```

- [x] **Step 7: Run the full unit suite**

```sh
npm run test:unit
```

- [ ] **Step 8: Commit**

```sh
git add src/lib/auth-throttle.ts src/test/auth-throttle.test.ts \
  src/test/auth-dialog-throttle.test.tsx src/components/AuthDialog.tsx
git commit -m "feat(auth): throttle repeated login failures without blocking signup"
```

---

## Task 4: Verify GitHub share protection still matches across all layers

This remains a verification task. The implementation already appears aligned, but the plan should prove that with explicit checks.

**Files to verify:**

- `src/lib/persistence.ts`
- `src/lib/community.ts`
- `supabase/migrations/20260316010000_github_context_schema.sql`
- tests that exercise share blocking

- [x] **Step 1: Confirm the client-side guard in persistence**

Check `assertPromptShareAllowed()` in `src/lib/persistence.ts` and confirm it blocks when `hasGithubSources(...)` is true.

- [x] **Step 2: Confirm the community save/share guard**

Check `src/lib/community.ts` and confirm `savePrompt()` rejects `input.isShared` when GitHub sources are attached.

- [x] **Step 3: Confirm the database guard**

Check `supabase/migrations/20260316010000_github_context_schema.sql` and confirm both are still present:

- `saved_prompts_no_github_public_share`
- `public.prompt_config_contains_github_sources(...)`

- [x] **Step 4: Run the share-related regression suites**

```sh
npx vitest run src/test/persistence.test.ts
npx vitest run src/test/community-share.test.ts
npx vitest run src/test/library-share-usecase-fallback.test.tsx
npx vitest run src/test/rls-github-context.test.ts
```

- [x] **Step 5: Document the result**

- if all three layers still agree, leave the code unchanged
- if any layer drifts, fix the mismatch before moving to later tasks

---

## Task 5: Refresh the GitHub API version header with a deterministic regression test

The code currently carries version drift, but the previous draft used a test that never reached `fetch()`. Fix the test seam first, then update the constant.

**Files:**

- Modify: `agent_service/github-app.mjs`
- Create: `src/test/agent-service-github-api-version.test.ts`

- [x] **Step 1: Verify the current GitHub REST API version on implementation day**

Before changing any code:

- open the official GitHub REST API version documentation
- record the current version date used for `X-GitHub-Api-Version`
- use that exact date in both the code and the test

If the current docs no longer use the date from the review notes, update the plan execution to the newer value.

- [x] **Step 2: Write a deterministic node test that reaches the real request path**

Create `src/test/agent-service-github-api-version.test.ts` with `/* @vitest-environment node */`.

Do **not** use a dummy PEM.

Instead:

- generate a real RSA private key inside the test with `generateKeyPairSync("rsa", { modulusLength: 2048 })`
- export it as PEM
- create the app client with that valid key
- mock `fetch`
- call a method that performs exactly one app-authenticated request, such as `getInstallationDetails()`
- assert the outgoing headers include the verified `X-GitHub-Api-Version`

- [x] **Step 3: Update `agent_service/github-app.mjs`**

Implementation rules:

- replace the old hardcoded `GITHUB_API_VERSION` value with the verified current version
- remove `CURRENT_GITHUB_API_VERSION`
- remove the startup diagnostic block that compares two hardcoded version constants

The diagnostic has already shown that this kind of duplicated source of truth drifts quickly.

- [x] **Step 4: Run the targeted GitHub tests**

```sh
npx vitest run src/test/agent-service-github-api-version.test.ts
npx vitest run src/test/agent-service-github-routing.test.ts
npx vitest run src/test/agent-service-github-webhooks.test.ts
```

- [ ] **Step 5: Commit**

```sh
git add agent_service/github-app.mjs \
  src/test/agent-service-github-api-version.test.ts
git commit -m "fix(github): refresh API version header and deterministic test"
```

---

## Task 6: Redact SQL previews from production logs unless debug logging is explicitly enabled

The production concern is real, but the previous draft only half-tested it. This task must cover both logging branches in `neon-data.mjs` and document the new debug flag.

**Files:**

- Modify: `agent_service/neon-data.mjs`
- Modify: `agent_service/github-store.mjs`
- Modify: `agent_service/service-runtime.mjs`
- Modify: `agent_service/README.md`
- Modify: `src/test/agent-service-runtime.test.ts`
- Create: `src/test/agent-service-neon-data-redaction.test.ts`

- [x] **Step 1: Write a proper Vitest mock seam for `@neondatabase/serverless`**

In `src/test/agent-service-neon-data-redaction.test.ts`:

- hoist a shared `queryMock`
- mock `neon()` so it returns an object/function whose `.query()` method delegates to `queryMock`
- spy on `console.log`
- parse each JSON log line back into an object before making assertions

- [x] **Step 2: Cover both log sites with separate tests**

Add at least four assertions:

1. `debug: false` omits `query_preview` from `neon_query_unexpected_return`
2. `debug: true` includes `query_preview` in `neon_query_unexpected_return`
3. `debug: false` omits `query_preview` from `neon_query_error`
4. `debug: true` includes `query_preview` in `neon_query_error`

How to trigger them:

- unexpected-return path: make `queryMock` resolve to an object instead of an array
- thrown-error path: make `queryMock` reject with an error such as `permission denied`

- [x] **Step 3: Add the `debug` option to `createNeonDatabaseClient()`**

In `agent_service/neon-data.mjs`:

- accept `debug = false`
- only include `query_preview` in logged objects when `debug === true`
- keep the rest of the log payload stable so existing operational parsing does not drift

- [x] **Step 4: Thread the debug flag through the GitHub store**

In `agent_service/github-store.mjs`:

- pass `debug: config.debug ?? false` into `createNeonDatabaseClient()`

- [x] **Step 5: Expose the new runtime flag**

In `agent_service/service-runtime.mjs`:

- add `debug: normalizeBool(env?.GITHUB_DEBUG_LOGGING, false)` to `githubConfig`

Then update `src/test/agent-service-runtime.test.ts` to assert the new field is parsed correctly.

- [x] **Step 6: Document the new env var**

Update `agent_service/README.md` and add `GITHUB_DEBUG_LOGGING` to the GitHub context configuration table.

Document the intended behavior clearly:

- default is `false`
- SQL previews stay out of production logs by default
- set `GITHUB_DEBUG_LOGGING=true` only for short-lived debugging sessions

- [x] **Step 7: Run targeted tests**

```sh
npx vitest run src/test/agent-service-neon-data-redaction.test.ts
npx vitest run src/test/agent-service-github-store.test.ts
npx vitest run src/test/agent-service-runtime.test.ts
```

- [ ] **Step 8: Commit**

```sh
git add agent_service/neon-data.mjs agent_service/github-store.mjs \
  agent_service/service-runtime.mjs agent_service/README.md \
  src/test/agent-service-neon-data-redaction.test.ts \
  src/test/agent-service-runtime.test.ts
git commit -m "fix(github): redact SQL previews unless debug logging is enabled"
```

---

## Task 7: Harden GitHub setup redirect origin handling and fail closed for unconfigured origin sets

The earlier redirect task correctly identified the spoofing risk but still failed open when `ALLOWED_ORIGINS` was `*` or unset. The new rule is simpler:

- only rewrite the post-install origin when the request origin is explicitly present in `corsConfig.origins`
- otherwise fall back to the configured `GITHUB_POST_INSTALL_REDIRECT_URL`

That means unconfigured or wildcard CORS no longer grant dynamic redirect scoping.

**Files:**

- Create: `agent_service/redirect-validation.mjs`
- Modify: `agent_service/handlers/github-install-url.mjs`
- Modify: `agent_service/README.md`
- Modify: `docs/github-context-reference.md`
- Modify: `src/test/agent-service-github-setup-flow.test.ts`
- Create: `src/test/agent-service-redirect-validation.test.ts`

- [x] **Step 1: Write a helper test against the real runtime CORS shape**

Create `src/test/agent-service-redirect-validation.test.ts`.

Model the inputs exactly like runtime uses them:

- `{ mode: "set", origins: new Set([...]) }`
- `{ mode: "any", origins: new Set() }`

Cover:

- allowed explicit origin returns `true`
- unknown origin returns `false`
- invalid URL returns `false`
- empty input returns `false`
- `mode: "any"` returns `false`

The last case is the regression guard the previous draft missed.

- [x] **Step 2: Implement the helper as fail-closed**

Create `agent_service/redirect-validation.mjs`.

The helper should:

- parse the candidate origin safely
- return `false` if parsing fails
- return `false` when `corsConfig.mode !== "set"`
- return `true` only when the parsed origin is explicitly present in `corsConfig.origins`

Do **not** include an empty-allowlist compatibility bypass.

- [x] **Step 3: Integrate the helper into `github-install-url.mjs`**

Update `resolvePostInstallReturnTo()` so it behaves like this:

1. parse the configured redirect URL
2. resolve the request origin from `Origin` or `Referer`
3. if there is no request origin, return the configured URL unchanged
4. if the request origin is not explicitly allowed, return the configured URL unchanged
5. only then rebuild the redirect URL on the request origin

This keeps the useful localhost rewrite behavior while removing the spoofing path.

- [x] **Step 4: Update the GitHub setup flow test to assert the security-sensitive value**

In `src/test/agent-service-github-setup-flow.test.ts`:

- extend `createRuntime()` to include `corsConfig`
- keep the existing success case where `http://localhost:8080` is explicitly allowed
- add a spoofed-origin case

The spoofed-origin case must assert the exact `returnTo` sent into `app.createSetupState()`.

Example assertion shape:

```ts
expect(app.createSetupState).toHaveBeenCalledWith({
  userId: "user-1",
  nonce: "nonce-1",
  returnTo: "https://promptforge.test/",
});
```

Do not stop at asserting `state=` exists in the install URL. That does not prove the redirect target was safe.

- [x] **Step 5: Add a wildcard-CORS regression test**

Add one more setup-flow test where:

- `corsConfig.mode === "any"`
- the request origin is `http://localhost:8080`

Expected behavior:

- the handler falls back to the configured redirect URL
- it does **not** rewrite to the request origin

This is how the task closes the fail-open gap from the earlier draft.

- [x] **Step 6: Update docs so runtime behavior does not drift**

Update both:

- `agent_service/README.md`
- `docs/github-context-reference.md`

Document:

- `ALLOWED_ORIGINS` must be an explicit list if you want origin-scoped GitHub install redirects
- when CORS is wildcard/unset, the setup flow falls back to `GITHUB_POST_INSTALL_REDIRECT_URL`
- bump the `Last updated` line in `docs/github-context-reference.md`

- [x] **Step 7: Run targeted tests**

```sh
npx vitest run src/test/agent-service-redirect-validation.test.ts
npx vitest run src/test/agent-service-github-setup-flow.test.ts
npx vitest run src/test/agent-service-github-routing.test.ts
```

- [ ] **Step 8: Commit**

```sh
git add agent_service/redirect-validation.mjs \
  agent_service/handlers/github-install-url.mjs \
  agent_service/README.md docs/github-context-reference.md \
  src/test/agent-service-redirect-validation.test.ts \
  src/test/agent-service-github-setup-flow.test.ts
git commit -m "fix(github): harden setup redirect origin handling"
```

---

## Task 8: Final verification gate

- [x] **Step 1: Run the full pre-merge gate**

```sh
npm run check:prod
```

- [x] **Step 2: Re-run any targeted suites for the task that failed**

If `check:prod` fails:

- fix the task that introduced the regression
- re-run that task's targeted tests first
- then re-run `npm run check:prod`

- [ ] **Step 3: Review the final commit set**

Expected commit set:

1. `refactor: extract shared requireUserId utility`
2. `fix(auth): align display-name contract across signup and profiles`
3. `feat(auth): throttle repeated login failures without blocking signup`
4. `fix(github): refresh API version header and deterministic test`
5. `fix(github): redact SQL previews unless debug logging is enabled`
6. `fix(github): harden setup redirect origin handling`

Then review:

```sh
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Verify there is no scope creep outside the files listed in the tasks above.

---

## Out of Scope

These items remain out of scope for this hardening plan:

- route-level auth guards in `src/App.tsx`
- Neon Auth console allowlists for OAuth/password-reset redirect URLs
- removal of the emergency unverified-JWT fallback flags
- a larger architectural move from the service's direct Neon Postgres connection model to per-request RLS-aware DB sessions
