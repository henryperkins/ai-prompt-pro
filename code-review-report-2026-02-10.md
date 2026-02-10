# Code Review Report

Date: 2026-02-10
Scope: Static review of frontend, Supabase Edge Functions, and agent service code included in this workspace snapshot.

## Findings (Ordered by Severity)

### 1. [High] `extract-url` allows SSRF-style target selection with only protocol checks
Evidence:
- `supabase/functions/extract-url/index.ts:45` validates only URL parse + `http/https` scheme.
- `supabase/functions/extract-url/index.ts:155` fetches `parsedUrl.href` directly without host/IP restrictions.

Impact:
- The function can be used to probe internal/private endpoints (for example localhost, RFC1918 ranges, link-local/metadata endpoints) from the server runtime.
- This is a common SSRF class risk for URL-fetching endpoints.

Recommendation:
- Add host/IP validation before fetch.
- Reject private, loopback, link-local, and metadata ranges.
- Consider explicit allowlist mode for production.

### 2. [High] `extract-url` reads full response body before truncation
Evidence:
- `supabase/functions/extract-url/index.ts:183` reads `await pageResp.text()` for entire response.
- `supabase/functions/extract-url/index.ts:188` truncates only after full body is already loaded.

Impact:
- Large documents can spike memory and processing time before truncation logic applies.
- This creates avoidable DoS/cost pressure on the edge function.

Recommendation:
- Enforce a hard response-size cap before full read.
- Check `Content-Length` and/or stream-read with an early byte cutoff.
- Optionally require `text/*` or HTML-ish content types.

### 3. [Medium] Anonymous fallback auth can fail with mixed key formats
Evidence:
- Client fallback returns publishable key as bearer token: `src/lib/ai-client.ts:98`.
- Client sends `apikey` + `Authorization` from publishable key path: `src/lib/ai-client.ts:117`.
- Server auth matching prefers strict equality to configured anon key when present: `supabase/functions/_shared/security.ts:317`.
- The server already has broader project-key detection helper (`sb_publishable_`/legacy anon JWT): `supabase/functions/_shared/security.ts:134`.

Impact:
- In deployments where edge env uses legacy `SUPABASE_ANON_KEY` while frontend uses `VITE_SUPABASE_PUBLISHABLE_KEY`, anonymous fallback requests may 401 unexpectedly.

Recommendation:
- In `requireAuthenticatedUser`, allow `isProjectApiKeyLike` matching even when `anonKey` is configured, or document/enforce exact key-format alignment across envs.

### 4. [Medium] `useToast` re-subscribes listener on every state change
Evidence:
- `src/hooks/use-toast.ts:169` registers listener in an effect.
- `src/hooks/use-toast.ts:177` uses `[state]` as dependency, causing repeated subscribe/unsubscribe churn.

Impact:
- Unnecessary listener churn and harder-to-reason behavior under StrictMode/concurrent rendering.
- This is a maintainability/performance smell in a shared global store hook.

Recommendation:
- Use an empty dependency array (`[]`) for one-time subscribe/unsubscribe.

### 5. [Medium] Duplicated prompt persistence domain logic risks drift
Evidence:
- `src/lib/community.ts:394` defines a full `savePrompt` path (plus related list/load/share/unshare helpers).
- `src/lib/persistence.ts:361` defines another `savePrompt` path with overlapping responsibilities.
- Main app flow uses `persistence` directly: `src/hooks/usePromptBuilder.ts:19`, `src/hooks/usePromptBuilder.ts:551`, `src/hooks/usePromptBuilder.ts:596`.

Impact:
- Two overlapping implementations for the same data model increase divergence risk and maintenance overhead.
- Unused/legacy paths can become stale and subtly incorrect.

Recommendation:
- Consolidate to one persistence module as source of truth.
- Remove or explicitly deprecate overlapping `community.ts` prompt CRUD APIs.

### 6. [Low] New comments may show generic author until reload
Evidence:
- Post-submit only appends the new comment: `src/components/community/CommunityComments.tsx:76`.
- No author map update after submit (`authorById` unchanged).
- Rendering falls back to generic name when profile missing: `src/components/community/CommunityComments.tsx:121`.

Impact:
- Immediately after posting, the UI can show `Community member` instead of the real display name.

Recommendation:
- After successful submit, either reload profiles for unseen user IDs or patch `authorById` for current user.

### 7. [Low] NotFound route uses hard reload navigation
Evidence:
- `src/pages/NotFound.tsx:16` uses `<a href="/">`.

Impact:
- Full page reload instead of SPA navigation.

Recommendation:
- Use router `Link` for consistency and faster navigation.

## Testing / Verification Notes

Executed locally:
- `npm test` -> passed (`9` test files passed, `2` skipped env-gated RLS suites).
- `npm run lint` -> passed with warnings only (React Fast Refresh export-pattern warnings in some `src/components/ui/*` files and `src/hooks/useAuth.tsx`).

Observed coverage gaps:
- No direct unit tests for `src/lib/ai-client.ts` SSE parsing paths.
- No dedicated tests for `supabase/functions/extract-url/index.ts` URL validation and size/SSRF guard behavior.

## Assumptions

- Database triggers/policies outside the reviewed file set may enforce additional invariants (for example share/unshare side effects).
- Findings are based on current checked-in code paths and static analysis of this workspace.
