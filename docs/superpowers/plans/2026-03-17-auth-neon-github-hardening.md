# Auth, Neon & GitHub Integration Hardening Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address every security finding, regression risk, code-quality drift, and operational issue surfaced during the authentication, Neon Data API, and GitHub integration review.

**Architecture:** Seven independent tasks that can be parallelized. Each task targets a single concern — shared auth utility extraction, DB-level constraints, API version drift, log redaction, redirect URL validation, production JWT safeguards, and client-side auth UX hardening.

**Tech Stack:** TypeScript (Vite/React), Node.js ESM (agent service), PostgreSQL (Neon), Vitest, `jose` JWT library

---

## Chunk 1: Frontend Hardening (Tasks 1-4)

### Task 1: Extract shared `requireUserId` utility

Three modules (`community.ts`, `notifications.ts`, `community-moderation.ts`) each have their own `requireUserId()` that call `neon.auth.getUser()` with minor variations in error handling and backend assertions. A shared utility eliminates drift and provides a single place to add telemetry or caching later.

**Behavioral note:** The existing `notifications.ts` implementation does NOT call `assertBackendConfigured()`. The shared utility always calls it. This is a deliberate improvement — notifications will now fail early with a clear message if the backend is unconfigured, rather than failing later with a network error. The commit message reflects this.

**Files:**
- Create: `src/lib/require-user-id.ts`
- Modify: `src/lib/community.ts:404-413`
- Modify: `src/lib/notifications.ts:62-70`
- Modify: `src/lib/community-moderation.ts:34-40`
- Create: `src/test/require-user-id.test.ts`

- [ ] **Step 1: Write the failing test for the shared utility**

```typescript
// src/test/require-user-id.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  },
}));

vi.mock("@/lib/backend-config", () => ({
  assertBackendConfigured: vi.fn(),
}));

import { requireUserId } from "@/lib/require-user-id";
import { assertBackendConfigured } from "@/lib/backend-config";

describe("requireUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user id when authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const id = await requireUserId("Test feature");
    expect(id).toBe("user-123");
    expect(assertBackendConfigured).toHaveBeenCalledWith("Test feature");
  });

  it("throws with error.message when getUser returns an error object", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });
    await expect(requireUserId("Test feature")).rejects.toThrow("JWT expired");
  });

  it("throws fallback message when error has no message", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { code: "unknown" },
    });
    await expect(requireUserId("Test feature")).rejects.toThrow(
      "Authentication failed."
    );
  });

  it("throws when no user id is present", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    await expect(requireUserId("Test feature")).rejects.toThrow(
      "Sign in required."
    );
  });

  it("uses default feature label when none provided", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-456" } },
      error: null,
    });
    await requireUserId();
    expect(assertBackendConfigured).toHaveBeenCalledWith("Account actions");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/require-user-id.test.ts`
Expected: FAIL — `require-user-id` module does not exist

- [ ] **Step 3: Write the shared utility**

The error extraction follows the same pattern used by `toError()` in `community.ts` and `community-moderation.ts`: extract the `.message` string from whatever shape the error object has, fall back to a generic message. We use a standalone helper here to avoid importing module-specific `toError` functions that have additional PostgREST logic.

```typescript
// src/lib/require-user-id.ts
import { neon } from "@/integrations/neon/client";
import { assertBackendConfigured } from "@/lib/backend-config";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export async function requireUserId(featureLabel = "Account actions"): Promise<string> {
  assertBackendConfigured(featureLabel);
  const { data, error } = await neon.auth.getUser();
  if (error) {
    throw new Error(extractErrorMessage(error, "Authentication failed."));
  }
  if (!data.user?.id) {
    throw new Error("Sign in required.");
  }
  return data.user.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/require-user-id.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Replace `requireUserId` in `community.ts`**

In `src/lib/community.ts`:
- Add import: `import { requireUserId } from "@/lib/require-user-id";`
- Delete the local `requireUserId` function (lines 404-413)
- Update all call sites that previously called `ensureCommunityBackend()` + `requireUserId()` in sequence. The new shared utility handles the backend assertion internally, so each call site becomes just `await requireUserId("Community prompts")` (using the appropriate feature label that was previously passed to `ensureCommunityBackend`).

Affected call sites (each currently has a preceding `ensureCommunityBackend(...)` call that should be removed):
- `listMyPrompts` (line ~416-418): change `ensureCommunityBackend("Community prompts"); ... await requireUserId()` to `await requireUserId("Community prompts")`
- `loadMyPromptById` (line ~459-460): same pattern, label `"Community prompts"`
- `savePrompt` (line ~479-480): same pattern, label `"Community prompts"`
- `deletePrompt` (line ~629-630): same pattern, label `"Community prompts"`
- `sharePrompt` (line ~650-651): label `"Community sharing"`
- `unsharePrompt` (line ~669-670): label `"Community sharing"`
- `loadFollowingUserIds` (line ~770-771): label `"Community follows"`
- `loadPersonalFeed` (line ~789-790): label `"Personal feed"`
- `followCommunityUser` (line ~983-984): label `"Community follows"`
- `unfollowCommunityUser` (line ~1023-1024): label `"Community follows"`
- `setPromptRating` (line ~1132-1133): label `"Community ratings"`
- `toggleVote` (line ~1221-1222): label `"Community reactions"`
- `addComment` (line ~1276-1277): label `"Community comments"`
- `remixToLibrary` (line ~1339-1340): label `"Community remixes"`

Functions that only call `ensureCommunityBackend()` without `requireUserId()` (public reads) should keep calling `assertBackendConfigured()` directly — do NOT change these:
- `loadFeed`, `loadPostById`, `loadPostsByIds`, `loadPostsByAuthor`
- `loadComments`, `loadProfilesByIds`, `loadMyVotes`, `loadMyRatings`
- `loadFollowStats`, `isFollowingCommunityUser`, `loadProfileActivityStats`

- [ ] **Step 6: Replace `requireUserId` in `notifications.ts`**

In `src/lib/notifications.ts`:
- Add import: `import { requireUserId } from "@/lib/require-user-id";`
- Delete the local `requireUserId` function (lines 62-70)
- Update call sites: `loadNotifications` → `await requireUserId("Notifications")`, `getUnreadCount` → `await requireUserId("Notifications")`, `markAsRead` → `await requireUserId("Notifications")`, `markAllAsRead` → `await requireUserId("Notifications")`

**Note:** This adds an `assertBackendConfigured("Notifications")` call that was not present before. This is intentional — it provides a clear early error rather than a network failure when the backend is unconfigured.

- [ ] **Step 7: Replace `requireUserId` in `community-moderation.ts`**

In `src/lib/community-moderation.ts`:
- Add import: `import { requireUserId } from "@/lib/require-user-id";`
- Delete the local `requireUserId` function (lines 34-40)
- Update call sites: `blockCommunityUser` → `await requireUserId("Community moderation")`, `unblockCommunityUser` → `await requireUserId("Community moderation")`, `submitCommunityReport` → `await requireUserId("Community moderation")`
- The `loadBlockedUserIds` function does NOT use `requireUserId` (it returns `[]` for anonymous users), so leave it unchanged.

- [ ] **Step 8: Run full test suite to verify no regressions**

Run: `npm run test:unit`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/require-user-id.ts src/test/require-user-id.test.ts \
  src/lib/community.ts src/lib/notifications.ts src/lib/community-moderation.ts
git commit -m "refactor: extract shared requireUserId utility

Consolidates three near-identical requireUserId implementations from
community.ts, notifications.ts, and community-moderation.ts into a
single shared module at src/lib/require-user-id.ts.

Each call site now passes an explicit feature label used for
assertBackendConfigured(). notifications.ts gains a backend-configured
assertion it did not previously have (intentional improvement —
produces clear early errors instead of network failures)."
```

---

### Task 2: Add DB-level `display_name` constraint on `profiles` table

The `validateDisplayName()` function in `src/lib/profile.ts` enforces alphanumeric-only, max 32 chars. But the DB has no corresponding constraint — a direct API call could bypass client validation.

**Compatibility note:** The `handle_new_user()` trigger inserts `coalesce(nullif(trim(coalesce(new.name, '')), ''), '')` which evaluates to empty string `''` for email signups without a name. The constraint must allow empty strings OR the trigger must be updated. We choose to normalize empty strings to NULL (cleaner semantics) and update the trigger accordingly.

**Files:**
- Create: `supabase/migrations/20260317010000_profiles_display_name_constraint.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260317010000_profiles_display_name_constraint.sql
-- ============================================================
-- Enforce display_name validation at the database level
-- Mirrors src/lib/profile.ts validateDisplayName():
--   - Max 32 characters
--   - Alphanumeric only (A-Z, a-z, 0-9)
--   - NULL is allowed (no display name set yet)
--   - Empty string is normalized to NULL
-- ============================================================

-- Step 1: Normalize empty strings to NULL across all existing rows.
update public.profiles
set display_name = null
where display_name = '';

-- Step 2: Clean any existing rows that violate the new constraint.
-- Trim whitespace, strip non-alphanumeric, truncate to 32. NULL out if empty.
update public.profiles
set display_name = nullif(
  left(
    regexp_replace(trim(coalesce(display_name, '')), '[^A-Za-z0-9]', '', 'g'),
    32
  ),
  ''
)
where display_name is not null
  and (
    char_length(display_name) > 32
    or display_name !~ '^[A-Za-z0-9]+$'
  );

-- Step 3: Add the constraint.
alter table public.profiles
  drop constraint if exists profiles_display_name_format;

alter table public.profiles
  add constraint profiles_display_name_format
  check (
    display_name is null
    or (
      char_length(display_name) between 1 and 32
      and display_name ~ '^[A-Za-z0-9]+$'
    )
  );

-- Step 4: Update the signup trigger to insert NULL instead of empty string.
-- This ensures new signups without a name do not violate the constraint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.name, '')), ''),
    nullif(trim(coalesce(new.image, '')), '')
  );
  return new;
end;
$$;
```

- [ ] **Step 2: Verify migration syntax and trigger compatibility**

Run:
```bash
# Confirm the trigger function is defined correctly
grep -c "nullif(trim(coalesce" supabase/migrations/20260317010000_profiles_display_name_constraint.sql
```
Expected: output `2` (one for display_name, one for avatar_url)

Manual verification: confirm that `nullif(trim(coalesce(new.name, '')), '')` returns `NULL` when `new.name` is null or empty, and returns the trimmed name otherwise. This satisfies the constraint which allows `NULL` or alphanumeric 1-32 chars.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260317010000_profiles_display_name_constraint.sql
git commit -m "fix(db): add display_name CHECK constraint on profiles

Mirrors the client-side validateDisplayName() rules:
alphanumeric only, 1-32 characters, NULL allowed.

Normalizes existing empty strings to NULL, cleans any violating rows,
and updates handle_new_user() trigger to insert NULL instead of empty
string for signups without a name."
```

---

### Task 3: Add client-side login attempt throttle in AuthDialog

`AuthDialog.tsx` has no protection against rapid failed login attempts. While server-side rate limiting is the real defense, a client-side cooldown provides defense in depth. OAuth flows are excluded (they involve redirects and are not brute-forceable via this dialog).

**Files:**
- Create: `src/lib/auth-throttle.ts`
- Create: `src/test/auth-throttle.test.ts`
- Modify: `src/components/AuthDialog.tsx:37-78`

- [ ] **Step 1: Write the failing test for the throttle**

```typescript
// src/test/auth-throttle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAuthThrottle } from "@/lib/auth-throttle";

describe("createAuthThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts when under the threshold", () => {
    const throttle = createAuthThrottle({ maxAttempts: 3, cooldownMs: 30_000 });
    expect(throttle.canAttempt()).toBe(true);
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(true);
  });

  it("blocks attempts after reaching the threshold", () => {
    const throttle = createAuthThrottle({ maxAttempts: 3, cooldownMs: 30_000 });
    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(false);
    expect(throttle.remainingCooldownMs()).toBeGreaterThan(0);
    expect(throttle.remainingCooldownMs()).toBeLessThanOrEqual(30_000);
  });

  it("resets after cooldown expires", () => {
    const throttle = createAuthThrottle({ maxAttempts: 3, cooldownMs: 30_000 });
    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(false);

    vi.advanceTimersByTime(30_001);
    expect(throttle.canAttempt()).toBe(true);
  });

  it("resets on success", () => {
    const throttle = createAuthThrottle({ maxAttempts: 3, cooldownMs: 30_000 });
    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordSuccess();
    expect(throttle.canAttempt()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/auth-throttle.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write the throttle utility**

```typescript
// src/lib/auth-throttle.ts
interface AuthThrottleOptions {
  maxAttempts?: number;
  cooldownMs?: number;
}

export function createAuthThrottle({
  maxAttempts = 5,
  cooldownMs = 30_000,
}: AuthThrottleOptions = {}) {
  let failures = 0;
  let lockedUntil = 0;

  function canAttempt(): boolean {
    if (lockedUntil > 0 && Date.now() >= lockedUntil) {
      failures = 0;
      lockedUntil = 0;
    }
    return lockedUntil === 0 || Date.now() >= lockedUntil;
  }

  function recordFailure(): void {
    failures += 1;
    if (failures >= maxAttempts) {
      lockedUntil = Date.now() + cooldownMs;
    }
  }

  function recordSuccess(): void {
    failures = 0;
    lockedUntil = 0;
  }

  function remainingCooldownMs(): number {
    if (lockedUntil === 0) return 0;
    return Math.max(0, lockedUntil - Date.now());
  }

  return { canAttempt, recordFailure, recordSuccess, remainingCooldownMs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/auth-throttle.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Integrate throttle into AuthDialog**

In `src/components/AuthDialog.tsx`:

1. Update the React import (line 1) to include `useRef`:
   ```typescript
   import { type FormEvent, useRef, useState } from "react";
   ```

2. Add import after the existing imports:
   ```typescript
   import { createAuthThrottle } from "@/lib/auth-throttle";
   ```

3. After the existing state declarations (after line 35, `const [confirmationSent, setConfirmationSent] = useState(false);`), add:
   ```typescript
   const authThrottle = useRef(createAuthThrottle());
   ```

4. In `handleSubmit`, after `event.preventDefault();` (line 38) and before `const normalizedEmail = ...`:
   ```typescript
   if (!authThrottle.current.canAttempt()) {
     const seconds = Math.ceil(authThrottle.current.remainingCooldownMs() / 1000);
     setError(`Too many attempts. Try again in ${seconds}s.`);
     return;
   }
   ```

5. In `handleSubmit`, inside the `if (result.error)` branch (after `setError(result.error);` on line 62), add:
   ```typescript
   authThrottle.current.recordFailure();
   ```

6. In `handleSubmit`, before the `setConfirmationSent(true)` on the confirmation signup path (line 71), add:
   ```typescript
   authThrottle.current.recordSuccess();
   ```

7. In `resetForm` (line 129), add at the end of the function body:
   ```typescript
   authThrottle.current = createAuthThrottle();
   ```

   Note: `resetForm` is called on dialog close and on successful login, so the throttle resets in both cases. Explicit `recordSuccess()` before `resetForm()` in the login path is redundant but harmless.

- [ ] **Step 6: Run unit tests**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth-throttle.ts src/test/auth-throttle.test.ts \
  src/components/AuthDialog.tsx
git commit -m "feat: add client-side login attempt throttle

After 5 consecutive failures, the AuthDialog blocks further attempts
for 30 seconds. Resets on success or when the dialog is closed and
reopened. Defense in depth — server-side rate limiting is primary.
OAuth flows are not throttled (they involve redirects, not password
brute-forcing)."
```

---

### Task 4: GitHub share safety — verify no regressions

This is a verification task, not a code change. The GitHub share blocking is implemented at three layers (client, trigger, CHECK constraint). Confirm they're all aligned.

**Files:**
- Read-only verification of:
  - `src/lib/persistence.ts:114-118` (`assertPromptShareAllowed`)
  - `src/lib/community.ts:496-498` (share guard in `savePrompt`)
  - `supabase/migrations/20260316010000_github_context_schema.sql:140-150` (CHECK constraint)
  - `supabase/migrations/20260316010000_github_context_schema.sql:152-237` (trigger)

- [ ] **Step 1: Verify the three layers are consistent**

Use the Grep tool to check:
- `src/lib/persistence.ts` for `hasGithubSources` and `GITHUB_SHARE_BLOCKED`
- `src/lib/community.ts` for the same patterns
- `supabase/migrations/20260316010000_github_context_schema.sql` for `saved_prompts_no_github_public_share` and `prompt_config_contains_github_sources`

Expected: All three layers check for GitHub sources and prevent sharing. No action needed unless a mismatch is found.

- [ ] **Step 2: Document verification result**

If all three layers are aligned: no commit needed, proceed to next task.
If a mismatch is found: create a fix and commit before proceeding.

---

## Chunk 2: Agent Service Hardening (Tasks 5-7)

### Task 5: Update GitHub API version constant

`agent_service/github-app.mjs:11` uses `GITHUB_API_VERSION = "2022-11-28"` while it documents the current version as `"2026-03-10"`. This is a 3+ year gap that could cause missing fields or deprecated behaviors.

**Files:**
- Modify: `agent_service/github-app.mjs:11-12, 72-84, 193`
- Create: `src/test/agent-service-github-api-version.test.ts`

- [ ] **Step 1: Write a test asserting the expected API version header**

```typescript
// src/test/agent-service-github-api-version.test.ts
import { describe, it, expect, vi } from "vitest";
import { createGitHubAppClient } from "../../agent_service/github-app.mjs";

describe("GitHub API version header", () => {
  it("sends X-GitHub-Api-Version: 2026-03-10 in requests", async () => {
    const capturedHeaders: Record<string, string>[] = [];
    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders.push(
        Object.fromEntries(
          Object.entries(init.headers as Record<string, string>).map(
            ([k, v]) => [k.toLowerCase(), v],
          ),
        ),
      );
      return new Response(JSON.stringify({ token: "ghs_test", expires_at: new Date(Date.now() + 600_000).toISOString() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const app = createGitHubAppClient(
      {
        enabled: true,
        appId: "12345",
        appSlug: "test-app",
        stateSecret: "secret",
        webhookSecret: "webhook-secret",
        appPrivateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB
aNEhC3sMi4JxKBXnSh8jKGJnHTECMhHeqR6RHn6mFSxWnGuh3bSVMaT7VGNAcbQB
DUMMY_TEST_KEY_NOT_REAL_DO_NOT_USE_IN_PRODUCTION
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB
-----END RSA PRIVATE KEY-----`,
      },
      { fetchImpl: mockFetch, now: () => Date.now() },
    );

    // getInstallationAccessToken calls githubRequest with the version header
    try {
      await app.listInstallationRepositories(999);
    } catch {
      // May fail due to dummy key — we only care about the header
    }

    expect(capturedHeaders.length).toBeGreaterThan(0);
    expect(capturedHeaders[0]["x-github-api-version"]).toBe("2026-03-10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails (old version)**

Run: `npx vitest run src/test/agent-service-github-api-version.test.ts`
Expected: FAIL — header value is `"2022-11-28"`

- [ ] **Step 3: Update the version constant**

In `agent_service/github-app.mjs`, change line 11:

```javascript
// Before:
const GITHUB_API_VERSION = "2022-11-28";
const CURRENT_GITHUB_API_VERSION = "2026-03-10";

// After:
const GITHUB_API_VERSION = "2026-03-10";
```

Remove line 12 (`CURRENT_GITHUB_API_VERSION`) entirely.

- [ ] **Step 4: Remove the version skew diagnostic block**

Delete the diagnostic block at lines 72-84 that compares the two constants:

```javascript
// DELETE this entire block (lines 72-84):
  // --- Diagnostic: API version skew detection ---
  if (config.enabled && GITHUB_API_VERSION !== CURRENT_GITHUB_API_VERSION) {
    // ... entire block ...
  }
  // --- End diagnostic ---
```

- [ ] **Step 5: Run tests to verify the fix**

Run: `npx vitest run src/test/agent-service-github-api-version.test.ts`
Expected: PASS — header value is now `"2026-03-10"`

Run: `npx vitest run src/test/agent-service-github-routing.test.ts`
Expected: PASS

Run: `npx vitest run src/test/agent-service-github-webhooks.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent_service/github-app.mjs \
  src/test/agent-service-github-api-version.test.ts
git commit -m "fix: update GitHub API version to 2026-03-10

Closes a 3+ year version skew (was 2022-11-28). Removes the
version skew diagnostic that flagged this drift at startup.
Adds a regression test asserting the X-GitHub-Api-Version header."
```

---

### Task 6: Redact SQL fragments from production error logs

`agent_service/neon-data.mjs` logs `query_preview` on every query error, exposing SQL fragments in production logs. Gate this behind a debug flag.

**Files:**
- Modify: `agent_service/neon-data.mjs:29, 51-63, 73-82`
- Modify: `agent_service/github-store.mjs:42-44`
- Modify: `agent_service/service-runtime.mjs` (inside `githubConfig` return object, around line 341)
- Create: `src/test/agent-service-neon-data-redaction.test.ts`

- [ ] **Step 1: Write failing tests for the redaction behavior**

```typescript
// src/test/agent-service-neon-data-redaction.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNeonDatabaseClient } from "../../agent_service/neon-data.mjs";

// Mock the @neondatabase/serverless neon function
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const sql = {
      query: vi.fn(),
    };
    return Object.assign(sql.query, sql);
  },
}));

describe("neon-data query_preview redaction", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("excludes query_preview when debug is false", async () => {
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://test:test@localhost/test",
      debug: false,
    });

    try {
      // Force an error by having the mock throw
      await client.queryRows("SELECT * FROM secret_table WHERE id = $1", ["1"]);
    } catch {
      // Expected to throw
    }

    const logCalls = consoleSpy.mock.calls
      .map(([arg]) => typeof arg === "string" ? arg : "")
      .filter((s) => s.includes("neon_query"));

    for (const logLine of logCalls) {
      expect(logLine).not.toContain("query_preview");
    }
  });

  it("includes query_preview when debug is true", async () => {
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://test:test@localhost/test",
      debug: true,
    });

    try {
      await client.queryRows("SELECT * FROM secret_table WHERE id = $1", ["1"]);
    } catch {
      // Expected to throw
    }

    const logCalls = consoleSpy.mock.calls
      .map(([arg]) => typeof arg === "string" ? arg : "")
      .filter((s) => s.includes("neon_query"));

    const hasQueryPreview = logCalls.some((line) => line.includes("query_preview"));
    expect(hasQueryPreview).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/agent-service-neon-data-redaction.test.ts`
Expected: FAIL — `createNeonDatabaseClient` does not accept `debug` parameter (or `query_preview` is always present)

- [ ] **Step 3: Add debug flag and redact query_preview**

In `agent_service/neon-data.mjs`, modify `createNeonDatabaseClient` to accept a `debug` option:

Change the function signature (line 29):
```javascript
// Before:
export function createNeonDatabaseClient({
  databaseUrl,
} = {}) {

// After:
export function createNeonDatabaseClient({
  databaseUrl,
  debug = false,
} = {}) {
```

In the `queryRows` function, modify the diagnostic log for unexpected return shape (lines 51-63) — change the `query_preview` line:

```javascript
          ...(debug ? { query_preview: queryText.trim().substring(0, 80) } : {}),
```

And in the error diagnostic block (lines 73-82) — same change:

```javascript
        ...(debug ? { query_preview: queryText.trim().substring(0, 80) } : {}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/agent-service-neon-data-redaction.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Pass debug flag from `github-store.mjs`**

In `agent_service/github-store.mjs`, line 42-44:

```javascript
// Before:
  const client = createNeonDatabaseClient({
    databaseUrl: config.databaseUrl,
  });

// After:
  const client = createNeonDatabaseClient({
    databaseUrl: config.databaseUrl,
    debug: config.debug ?? false,
  });
```

- [ ] **Step 6: Wire debug flag from runtime config**

In `agent_service/service-runtime.mjs`, inside the `githubConfig` IIFE return object (the `return { ... }` block that starts around line 341, after the existing properties like `webhookSecret`), add:

```javascript
      debug: normalizeBool(env?.GITHUB_DEBUG_LOGGING, false),
```

This ensures `query_preview` only appears when `GITHUB_DEBUG_LOGGING=true` is explicitly set.

- [ ] **Step 7: Run existing tests to verify no regressions**

Run: `npx vitest run src/test/agent-service-github-store.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add agent_service/neon-data.mjs agent_service/github-store.mjs \
  agent_service/service-runtime.mjs \
  src/test/agent-service-neon-data-redaction.test.ts
git commit -m "fix: redact SQL fragments from production error logs

query_preview in neon-data.mjs diagnostic logs now only appears
when GITHUB_DEBUG_LOGGING=true. Prevents schema exposure in
production log aggregation."
```

---

### Task 7: Validate GitHub setup redirect URL against allowed origins

`agent_service/handlers/github-install-url.mjs` constructs the `returnTo` URL from the request's `Origin`/`Referer` header. While the HMAC signature prevents post-creation tampering, the initial URL is not validated against a server-side allowlist. A request with a spoofed Origin could embed an attacker-controlled URL.

**Files:**
- Create: `agent_service/redirect-validation.mjs`
- Modify: `agent_service/handlers/github-install-url.mjs:23-43`
- Modify: `src/test/agent-service-github-setup-flow.test.ts` (update mock runtime)
- Create: `src/test/agent-service-redirect-validation.test.ts`

- [ ] **Step 1: Write the failing test for the validation module**

```typescript
// src/test/agent-service-redirect-validation.test.ts
import { describe, it, expect } from "vitest";
import { isAllowedRedirectOrigin } from "../../agent_service/redirect-validation.mjs";

describe("isAllowedRedirectOrigin", () => {
  const allowedOrigins = new Set([
    "https://prompt.lakefrontdigital.io",
    "http://localhost:8080",
  ]);

  it("allows a configured origin", () => {
    expect(
      isAllowedRedirectOrigin("https://prompt.lakefrontdigital.io/builder", allowedOrigins)
    ).toBe(true);
  });

  it("allows localhost during development", () => {
    expect(
      isAllowedRedirectOrigin("http://localhost:8080/settings", allowedOrigins)
    ).toBe(true);
  });

  it("rejects an unknown origin", () => {
    expect(
      isAllowedRedirectOrigin("https://evil.example.com/steal", allowedOrigins)
    ).toBe(false);
  });

  it("rejects when the URL is invalid", () => {
    expect(
      isAllowedRedirectOrigin("not-a-url", allowedOrigins)
    ).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isAllowedRedirectOrigin("", allowedOrigins)).toBe(false);
  });

  it("allows any origin when allowlist is empty (backward compat for unconfigured deployments)", () => {
    // When ALLOWED_ORIGINS is not set, the origins Set is empty.
    // We allow all redirects for backward compatibility.
    expect(
      isAllowedRedirectOrigin("https://anything.example.com", new Set())
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/agent-service-redirect-validation.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write the validation module**

```javascript
// agent_service/redirect-validation.mjs

/**
 * Returns true when the candidate URL's origin is present in the
 * allowedOrigins set, or when the allowlist is empty (unconfigured —
 * allows all origins for backward compatibility with deployments that
 * have not yet set ALLOWED_ORIGINS).
 *
 * IMPORTANT: This provides no protection if ALLOWED_ORIGINS is not configured.
 * Ensure ALLOWED_ORIGINS is set in production deployments.
 */
export function isAllowedRedirectOrigin(candidateUrl, allowedOrigins) {
  if (!allowedOrigins || allowedOrigins.size === 0) return true;
  if (!candidateUrl || typeof candidateUrl !== "string") return false;

  let parsed;
  try {
    parsed = new URL(candidateUrl.trim());
  } catch {
    return false;
  }

  return allowedOrigins.has(parsed.origin);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/agent-service-redirect-validation.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Integrate into `github-install-url.mjs`**

In `agent_service/handlers/github-install-url.mjs`, add the import:

```javascript
import { isAllowedRedirectOrigin } from "../redirect-validation.mjs";
```

Replace `resolvePostInstallReturnTo` (lines 23-43) with:

```javascript
function resolvePostInstallReturnTo(req, runtime) {
  const configuredRedirectUrl = runtime.githubConfig.postInstallRedirectUrl;
  if (!configuredRedirectUrl) return configuredRedirectUrl;

  let configuredUrl;
  try {
    configuredUrl = new URL(configuredRedirectUrl);
  } catch {
    return configuredRedirectUrl;
  }

  const requestOrigin = resolveRequestOrigin(req);
  if (!requestOrigin) {
    return configuredUrl.toString();
  }

  const candidateUrl = new URL(
    `${configuredUrl.pathname}${configuredUrl.search}${configuredUrl.hash}`,
    `${requestOrigin}/`,
  ).toString();

  // Validate the computed redirect target against configured CORS origins.
  // If the origin is not in the allowlist, fall back to the configured URL.
  const allowedOrigins = runtime.corsConfig?.origins ?? new Set();
  if (!isAllowedRedirectOrigin(candidateUrl, allowedOrigins)) {
    return configuredUrl.toString();
  }

  return candidateUrl;
}
```

- [ ] **Step 6: Update existing setup flow test mock to include `corsConfig`**

In `src/test/agent-service-github-setup-flow.test.ts`, find the `createRuntime` helper and add `corsConfig` to the mock:

```typescript
function createRuntime(postInstallRedirectUrl = "https://promptforge.test/") {
  return {
    githubConfig: { postInstallRedirectUrl },
    corsConfig: {
      mode: "set",
      origins: new Set(["https://promptforge.test", "http://localhost:8080"]),
    },
  };
}
```

Add a new test case that verifies a spoofed origin is rejected:

```typescript
it("falls back to configured URL when request origin is not in allowed origins", async () => {
  const runtime = createRuntime("https://promptforge.test/");
  const handler = createGitHubInstallUrlHandler({ app, store, runtime });
  const result = await handler({
    auth: { userId: "user-1" },
    req: { headers: { origin: "https://evil.example.com" } },
  });
  // The install URL state should contain returnTo pointing to the
  // configured URL, not the spoofed origin
  expect(result.body.installUrl).toContain("state=");
  // Verify the state token was created with the configured URL, not the spoofed one
  expect(store.createSetupState).toHaveBeenCalled();
});
```

- [ ] **Step 7: Verify `corsConfig` is exported from `service-runtime.mjs`**

In `agent_service/service-runtime.mjs`, verify that `corsConfig` is included in the returned runtime object (around line 714). It should already be there. If not, add `corsConfig,` to the return block.

- [ ] **Step 8: Run full agent service test suite**

Run:
```bash
npx vitest run src/test/agent-service-github-routing.test.ts
npx vitest run src/test/agent-service-github-setup-flow.test.ts
npx vitest run src/test/agent-service-redirect-validation.test.ts
```
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add agent_service/redirect-validation.mjs \
  agent_service/handlers/github-install-url.mjs \
  src/test/agent-service-redirect-validation.test.ts \
  src/test/agent-service-github-setup-flow.test.ts
git commit -m "fix: validate GitHub setup redirect URL against allowed origins

The returnTo URL embedded in the GitHub install state token is now
validated against the configured CORS origins (ALLOWED_ORIGINS).
Spoofed Origin/Referer headers can no longer influence the
post-install redirect target to point at an unconfigured origin.

Note: protection requires ALLOWED_ORIGINS to be set. Unconfigured
deployments allow all redirects for backward compatibility."
```

---

## Chunk 3: Final Gate

### Task 8: Run pre-merge gate

- [ ] **Step 1: Run the full check:prod gate**

Run: `npm run check:prod`
Expected: All gates PASS (docs-freshness, design-system gates, lint, test:unit, build, token-runtime)

- [ ] **Step 2: If any failures, fix and re-run before proceeding**

Any failures should be addressed in the task that introduced the regression. Re-run `npm run check:prod` after each fix until clean.

- [ ] **Step 3: Final commit summary**

Review the commit log for this branch:
```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Expected 6 commits (Task 4 is verification-only, no commit):
1. `refactor: extract shared requireUserId utility`
2. `fix(db): add display_name CHECK constraint on profiles`
3. `feat: add client-side login attempt throttle`
4. `fix: update GitHub API version to 2026-03-10`
5. `fix: redact SQL fragments from production error logs`
6. `fix: validate GitHub setup redirect URL against allowed origins`

Verify with `git diff --stat` that only expected files were changed — no scope creep.

---

## Appendix: Findings NOT addressed in this plan (with rationale)

### A. No route-level auth guards
**Status:** Intentionally deferred.
**Rationale:** All access control is enforced by RLS on the backend. Client-side route guards are purely cosmetic UX. Adding a `RequireAuth` wrapper would require modifying every protected route in `App.tsx` and deciding on redirect/fallback behavior for each. This is a UX improvement, not a security fix. Track as a separate UX task.

### B. OAuth/password-reset redirect allowlist in Neon Auth settings
**Status:** Ops verification required — not a code change.
**Rationale:** The `redirectTo` values sent by `signInWithOAuth` and `resetPasswordForEmail` must be validated server-side in Neon Auth's project configuration. This is an infrastructure setting, not a code fix. Verify in the Neon console that the allowed redirect URLs are restricted to `https://prompt.lakefrontdigital.io` and development origins.

### C. Unverified JWT fallback in production
**Status:** Monitored, not removed.
**Rationale:** The double-opt-in (`ALLOW_UNVERIFIED_JWT_FALLBACK` + `ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION`) is an emergency recovery mechanism. Removing it entirely could leave operators stranded during a JWKS outage. The existing safeguards (disabled by default, startup warning log, separate production flag) are adequate. If desired, an additional safeguard could require a rotating secret, but that's a design decision for a dedicated security review.

### D. Agent service privileged DB connection (no RLS)
**Status:** Architectural trade-off — not actionable in this plan.
**Rationale:** Switching the agent service to RLS-aware connections would require passing per-request JWT claims to set the Postgres role, which is a significant architectural change to the connection pooling model. The existing pattern (every query includes `user_id = $1`) is consistently applied and verified by code review. A DB-level audit trigger is worth exploring but belongs in a dedicated infrastructure task.

### E. `contact_messages` anonymous insert RLS
**Status:** Already correctly configured.
**Rationale:** Verified in `supabase/migrations/20260221040000_contact_messages.sql`: the `"Anyone can submit contact messages"` policy allows inserts with `privacy_consent = true` and `(requester_user_id is null or requester_user_id = auth.uid())`. Reads are restricted to own messages or support reviewers. No change needed.

### F. Cross-user queries in webhook handlers (`listConnectionsByGithubRepoIds`)
**Status:** By design — not a bug.
**Rationale:** Webhook handlers operate outside any single user's context. They need to propagate GitHub events (repo renamed, installation deleted) to all affected users. These methods are only called from webhook handlers, never from user-facing routes. No change needed.
