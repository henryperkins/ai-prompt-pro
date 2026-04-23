# Independent Review: GitHub Repo Integration Implementation Plan

**Reviewed:** 2026-03-16  
**Reviewer:** Architect  
**Plan under review:** [`2026-03-16-github-integration-implementation.md`](2026-03-16-github-integration-implementation.md)  
**Prior review:** [`2026-03-16-github-integration-plan-review-codex.md`](2026-03-16-github-integration-plan-review-codex.md) (Codex — approved without issues)  
**Source critique:** [`2026-03-16-github-integration-recommendation-critique.md`](2026-03-16-github-integration-recommendation-critique.md)

---

## 1. Verdict

**Conditionally approved.** The plan is architecturally sound and addresses every gap raised in the critique. It is grounded in the real codebase and makes defensible locked decisions. However, there are **three design concerns that should be resolved before implementation begins**, **four underspecified areas that need detail during Phase 0/1**, and **two items the prior review should have flagged**.

---

## 2. What the Plan Gets Right

### 2.1 Codebase alignment is accurate

Every file reference I verified matches the current state:

- [`codex_service.mjs`](../agent_service/codex_service.mjs:2086) still dispatches via raw `url.pathname ===` checks at lines 2112–2201. The Phase 5 router prerequisite is real and necessary.
- [`service-runtime.mjs`](../agent_service/service-runtime.mjs:445) defines [`routeAuthPolicies`](../agent_service/service-runtime.mjs:445) as `{ allowPublicKey, allowServiceToken, allowUserJwt }` booleans — no `customAuth` path exists today. The plan's extension is the minimum viable change.
- [`context-types.ts`](../src/lib/context-types.ts:1) has `ContextSourceType = "text" | "url" | "file" | "database" | "rag"` and [`ContextReference.kind`](../src/lib/context-types.ts:5) mirrors it without `"github"`. Both need extension.
- [`enhance-context-sources.ts`](../src/lib/enhance-context-sources.ts:22) and [`context-source-expansion.mjs`](../agent_service/context-source-expansion.mjs:1) duplicate budget constants (`MAX_CONTEXT_SOURCE_COUNT = 8`, `MAX_CONTEXT_SOURCE_SUMMARY_CHARS = 2500`, `MAX_CONTEXT_SOURCE_RAW_CHARS = 12000`, `MAX_CONTEXT_SOURCE_TOTAL_RAW_CHARS = 32000`). The plan's sync-update note is warranted.
- [`ai-client.ts`](../src/lib/ai-client.ts:63) owns `bootstrapTokenPromise`, `publishableKeyFallbackUntilMs`, and the full token refresh flow. The `service-auth.ts` extraction is the right preparation step.
- The existing migration pattern in [`20260209000000_initial_schema.sql`](../supabase/migrations/20260209000000_initial_schema.sql:8) uses `references neon_auth."user"(id) on delete cascade` + RLS with `auth.uid()`, and the plan's proposed tables follow exactly this pattern.

### 2.2 Locked decisions are well-reasoned

The plan resolves all seven pre-implementation decisions from the critique:

| Critique question | Plan answer | Assessment |
|---|---|---|
| Where do GitHub endpoints live? | Extend agent service | Correct — avoids second backend |
| cmdk or UUI ComboBox? | UUI ComboBox | Correct — cmdk is unused phantom dep |
| New source type or new config field? | New `ContextSourceType = "github"` | Correct — simpler, portable |
| repomix role? | Not in live request path | Reasonable for v1 |
| Budget limits? | Explicit table with new values | Addressed — see concerns below |
| Token storage? | No token storage; mint on demand | Correct security posture |
| Public/private scope? | Both via GitHub App | Correct for v1 utility |

### 2.3 Strong defensive design

- Share blocking covers three layers: UI, client persistence, and DB trigger. This is thorough.
- Manifest incomplete-build handling is well-specified: keep the prior complete manifest, surface the error, never silently drop files.
- Installation token non-persistence with on-demand minting from the app private key is the right security model.
- The setup-return flow correctly distrusts `installation_id` from GitHub's redirect and verifies server-side.

---

## 3. Design Concerns (Resolve Before Implementation)

### 3.1 Budget direction is counterintuitive for code files

The plan proposes these changes:

| Setting | Current | v1 Proposed | Direction |
|---|---:|---:|---|
| `MAX_ENHANCE_CONTEXT_SOURCE_SUMMARY_CHARS` | `2500` | `1200` | ↓ halved |
| `MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS` | `12000` | `8000` | ↓ reduced |
| `MAX_ENHANCE_CONTEXT_SOURCE_COUNT` | `8` | `12` | ↑ increased |

The justification is "more files, tighter each." For prose-oriented sources like URLs and text, this makes sense. For **code files**, the value proposition inverts:

- A typical 200-line source file is ~8,000–12,000 characters. At the new 8,000 raw cap, most non-trivial source files would be truncated.
- With `MAX_SOURCE_EXPANSION_REQUESTS` staying at `3`, only 3 of 12 sources get expanded. The remaining 9 sources would use only the 1,200-character summary.
- The plan acknowledges that "most GitHub sources will remain summary-only" and says "deterministic file summarization quality is a primary v1 concern" — but the `summarizeGithubFile()` helper described in §9 is a heuristic that extracts top-level names and leading docblocks. At 1,200 characters, this is a very lossy representation of a code file.

**Recommendation:** Consider a two-tier budget: keep existing limits for non-GitHub sources; allocate a separate, larger raw-char budget for GitHub sources (e.g., `MAX_GITHUB_SOURCE_RAW_CHARS = 16000`). Alternatively, raise `MAX_SOURCE_EXPANSION_REQUESTS` to 5 for prompts that include GitHub sources so more files get full content.

### 3.2 Phase 5 dependency is a large prerequisite with its own risk

The plan requires completing the Phase 5 router/bootstrap cleanup from [`2026-03-12-agent-service-refactoring.md`](2026-03-12-agent-service-refactoring.md:123) before any GitHub work begins. Phase 5 is currently listed as **"planned"** (not in progress) and includes extracting:

- [`enhance-request.mjs`](2026-03-12-agent-service-refactoring.md:129) — session extraction, request building
- [`enhance-source-context.mjs`](2026-03-12-agent-service-refactoring.md:135) — source expansion resolution
- [`enhance-turn-runner.mjs`](2026-03-12-agent-service-refactoring.md:137) — the 540-line `runEnhanceTurnStream()`
- SSE and WebSocket handler modules
- Router/bootstrap cleanup in `codex_service.mjs`

This is a significant refactoring that touches the core request path of the existing product. If Phase 5 encounters issues (regression in enhancement flow, WebSocket transport changes, etc.), it blocks the entire GitHub integration.

**Recommendation:** Evaluate whether Phase 5 can be split. The GitHub integration specifically needs:
1. A path-parameter-aware router (for `:installationId` and `:connectionId`)
2. `customAuth` support in the route table

It does **not** need the enhance-request/turn-runner/transport extractions. A minimal "Phase 5a" that adds only the router and auth-policy extension, without refactoring existing handlers, would unblock GitHub work faster with less regression risk.

### 3.3 Manifest-in-Postgres is heavyweight for v1

The plan stores full manifest JSONB in [`github_repo_manifest_cache`](2026-03-16-github-integration-implementation.md:228). For a large repo with 10,000+ files, each manifest entry at ~100 bytes = ~1 MB of JSONB per row. With user-scoped rows, a user connecting 5 repos generates 5 MB of manifest data that must be read/written through the Neon Data API over HTTP on every search warm-up.

The plan also specifies an in-memory LRU cache, but the primary store and source of truth is Postgres. This creates a pattern where:
- Cold start = HTTP round-trip to read 1+ MB JSONB from Neon
- Every manifest refresh = HTTP round-trip to write 1+ MB JSONB to Neon
- Webhook invalidation = HTTP round-trip to mark rows stale

**Recommendation:** For v1, consider making the in-memory LRU cache the primary store and Postgres the cold-start fallback. The `github_repo_manifest_cache` table would only store the `tree_sha` and metadata (not the full manifest JSONB). The service would rebuild the manifest from GitHub on cache miss. This is acceptable because:
- Manifest build is a single Git Trees API call for most repos
- The 15-minute TTL means manifests are short-lived anyway
- It avoids large JSONB writes through the HTTP Data API
- Service restarts are infrequent enough that occasional cache misses are acceptable

---

## 4. Underspecified Areas (Detail During Phase 0/1)

### 4.1 Neon Data API client shape is undefined

The plan specifies using the "Neon Data API over HTTP from a lightweight shared helper" but the agent service is plain Node.js `.mjs` without any Neon client today. The frontend uses [`@neondatabase/serverless`](../src/integrations/neon/client.ts) via the Neon `neon()` HTTP driver, but that's a frontend import path.

**What needs definition:**
- Does the agent service use `@neondatabase/serverless` directly? It's usable in Node.js but is primarily designed for edge/serverless.
- Or does it use raw HTTP calls to the Neon Data API endpoint?
- How does the service-role key authenticate differently from the user JWT path?
- What is the error-handling contract (retry on transient failure? circuit-breaker?)?

### 4.2 GitHub App install flow error paths

The happy path is well-specified (§4, steps 3–4). The following error paths need handler-level detail:

- User cancels the GitHub App installation mid-flow → GitHub still redirects to `setup_url` but without `installation_id`. The handler must detect this and redirect to the builder with an error param.
- State/nonce verification fails → the handler must not leak why (timing attack surface) and must redirect cleanly.
- User already has a binding for the same `github_installation_id` → upsert vs. error? The plan says "persist the installation metadata" but the unique constraint is `(user_id, github_installation_id)` — an upsert is the right behavior, but it should be explicit.
- GitHub App is suspended by the org admin → the `suspended_at` column exists but the plan doesn't say when/how it gets populated (presumably via webhook, but the webhook handler scope in Phase 4 should enumerate this).

### 4.3 `service-auth.ts` extraction boundary

The plan says to extract from [`ai-client.ts`](../src/lib/ai-client.ts:63) a module that "owns session lookup/refresh, bootstrap promise deduplication, and authenticated header construction." The file is 1,957 lines with deeply intertwined concerns:

- Token bootstrap at [line 63](../src/lib/ai-client.ts:63) (`bootstrapTokenPromise`)
- Publishable-key fallback at [line 64](../src/lib/ai-client.ts:64) (`publishableKeyFallbackUntilMs`)
- Retry/backoff logic
- Transport selection (SSE vs. WebSocket)
- Codex session management

The extraction needs a clear interface contract: what does `service-auth.ts` export, and what does `ai-client.ts` keep? The plan should specify the exported API surface (e.g., `getAuthHeaders(): Promise<Headers>`, `requireUserSession(): Promise<string>`) before implementation begins.

### 4.4 GitHub API rate-limit strategy

The critique (§4.4) flagged that GitHub App installation tokens share a 5,000 req/hr budget across all users of that installation. The plan says "add GitHub endpoint rate-limit config" in Phase 0 but doesn't specify:

- Per-user rate limits for GitHub endpoints (to prevent one user from exhausting the shared installation quota)
- What happens when the GitHub API returns 403/429 during manifest build or file preview
- Whether the agent service tracks remaining GitHub API quota from response headers (`X-RateLimit-Remaining`)
- Backoff behavior when approaching the limit

---

## 5. Items the Prior Review Missed

### 5.1 `buildContextBlock()` already handles `[GITHUB: ...]` markers

The plan (§11) says to "ensure `buildContextBlock()` renders `[GITHUB: ...]` markers." The existing implementation at [`context-types.ts:279`](../src/lib/context-types.ts:279) already uses:

```typescript
`[${s.type.toUpperCase()}: ${s.title}]`
```

Adding `"github"` to the `ContextSourceType` union automatically produces `[GITHUB: title]` with no code change to `buildContextBlock()`. This is a non-issue that the prior review should have caught and removed from the implementation scope.

### 5.2 `normalizeSourceType()` in `context-source-expansion.mjs` silently drops unknown types

At [`context-source-expansion.mjs:24`](../agent_service/context-source-expansion.mjs:24):

```javascript
const CONTEXT_SOURCE_TYPES = new Set(["text", "url", "file", "database", "rag"]);

function normalizeSourceType(value) {
  const normalized = normalizeFieldValue(value).toLowerCase();
  if (!normalized) return "text";
  return CONTEXT_SOURCE_TYPES.has(normalized) ? normalized : "text";
}
```

If a GitHub source arrives at the agent service before `"github"` is added to `CONTEXT_SOURCE_TYPES`, it will be silently normalized to `"text"`. This is a data-corruption risk during phased rollout if the frontend ships `type: "github"` sources before the backend is updated. The plan should specify that the backend `CONTEXT_SOURCE_TYPES` set update must deploy **before or simultaneously with** the frontend GitHub source changes. The prior review should have flagged this deployment ordering constraint.

---

## 6. Minor Observations

1. **`visibility` and `is_private` are redundant** in `github_repo_connections`. GitHub's `visibility` field is `"public"` | `"private"` | `"internal"`. The boolean `is_private` duplicates this. Recommend dropping `is_private` and using only `visibility`.

2. **`user_id` on `github_repo_manifest_cache` is denormalized.** The `user_id` can be derived through `repo_connection_id → github_repo_connections.user_id`. The denormalization is acceptable for RLS simplicity (avoids a join in the policy), but the plan should note this is intentional.

3. **The plan lists `src/pages/Library.tsx` as a modify target** but the share-disabled logic is more likely in the save dialog and persistence layer. Verify during implementation whether Library needs changes beyond what the save dialog already covers.

4. **Webhook signature verification** should use constant-time comparison (`crypto.timingSafeEqual`). The plan doesn't specify this, but it's a standard requirement for HMAC verification.

---

## 7. Implementation Readiness Checklist

| Area | Ready? | Blocker |
|---|---|---|
| Architecture decisions | ✅ | — |
| Data model | ✅ | — |
| HTTP API contract | ✅ | — |
| Auth model extension | ✅ | — |
| Phase 5 router prerequisite | ⚠️ | Phase 5 scope may be too broad; consider Phase 5a |
| Budget strategy | ⚠️ | Per-source reductions may hurt code file quality |
| Manifest storage | ⚠️ | Consider lighter Postgres footprint for v1 |
| Neon Data API client | ❌ | Needs interface definition |
| Service-auth extraction | ❌ | Needs exported API contract |
| GitHub rate-limit strategy | ❌ | Needs per-user limits and quota tracking |
| Deployment ordering | ❌ | Backend type-set update must precede frontend |

---

## 8. Recommendation

1. **Resolve §3.1 (budget direction)** — decide whether code files get a separate budget tier or `MAX_SOURCE_EXPANSION_REQUESTS` increases.
2. **Resolve §3.2 (Phase 5 scope)** — define a minimal "Phase 5a" that unblocks GitHub routing without the full enhance-request/transport refactor.
3. **Resolve §3.3 (manifest storage)** — decide whether v1 uses Postgres as the full manifest store or as metadata-only with in-memory primary.
4. **Add deployment ordering note** — backend `CONTEXT_SOURCE_TYPES` update must ship before or with frontend `ContextSourceType` update.
5. **Detail §4.1–4.4** during Phase 0 sprint planning — these don't block plan approval but must be resolved before code lands.

Once items 1–4 are addressed, proceed with implementation.
