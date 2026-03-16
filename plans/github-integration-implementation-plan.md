# GitHub Repo Integration Implementation Plan

**Date:** 2026-03-16  
**Status:** Proposed  
**Inputs:** [`../githubintegrationcandidate.md`](../githubintegrationcandidate.md), [`github-integration-recommendation-critique.md`](github-integration-recommendation-critique.md)

## 1. Goal

Deliver a production-ready GitHub repo context feature for PromptForge that lets a signed-in user:

1. connect a GitHub App installation,
2. search files from an installed repository,
3. preview and attach selected files as prompt context, and
4. run enhancement without breaking PromptForge's current draft/template persistence or context-budget guardrails.

This plan targets the current codebase and deployment topology:

- frontend: Vite + React on Azure Static Web Apps
- backend: existing `agent_service/` Azure Web App
- persistence: Neon Auth + Neon Data API + Postgres migrations in `supabase/migrations/`

## 2. Locked Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend host | Extend the existing agent service | Reuses the deployed Azure Web App, existing bearer-token auth, and existing frontend service-origin plumbing in `src/lib/ai-client.ts`. Avoids introducing a second production backend. |
| Backend shape | Land the Phase 5 router/bootstrap cleanup from `agent-service-refactoring.md` first, then add GitHub handlers as separate modules | `agent_service/codex_service.mjs` still dispatches requests via raw pathname checks. GitHub routes require extracted handlers plus path-parameter-aware routing for `:installationId` and `:connectionId`. |
| GitHub auth model | GitHub App only for v1 | Avoids PAT handling, supports private/org repos, and matches the reviewed recommendation. |
| Agent-service database connectivity | Use the Neon Data API over HTTP from a lightweight shared helper inside `agent_service/` | This matches the existing Neon stack, avoids introducing long-lived Postgres pool management into the Azure Web App, and is sufficient for installation/connection/manifest CRUD. |
| Custom-auth routes | Extend route auth policies to support explicit GitHub-owned auth paths for setup-return state verification and webhook signature verification | The existing `{ allowPublicKey, allowServiceToken, allowUserJwt }` policy shape is not sufficient for browser redirects or GitHub webhook requests. |
| GitHub install return flow | Use the GitHub App `setup_url` with signed state + one-time nonce and server-side installation lookup | The normal app-install path reliably returns through `setup_url`; `installation_id` from GitHub must not be trusted by itself, so the backend must verify state and then fetch installation details before binding it to a PromptForge user. |
| PromptForge user auth | Require a Neon-authenticated PromptForge user to connect repos | Repo connections are user-scoped product data and should not be anonymous. |
| Source model | Add `github` as a new `ContextSourceType` and `ContextReference.kind` | Keeps attached repo files inside the existing `contextConfig.sources` flow without adding a second prompt-context system. |
| Repo connection persistence | Store installation/repo metadata server-side in Neon tables, not in `ContextConfig` | Avoids a prompt-config schema redesign and keeps templates portable. |
| First repo-selection flow | List installation-accessible repos separately from saved connections and create a repo connection on first selection | `/github/connections` only represents repos already connected inside PromptForge; the picker still needs a first-use discovery and connect step. |
| Installation token handling | Do not persist GitHub installation access tokens | Store installation IDs only and mint short-lived tokens on demand from the app private key. |
| UI primitive | Extend the existing UUI `ComboBox` path | `cmdk` is unused; UUI/React Aria is the established pattern in this repo. |
| Search model | Server-side search over a cached manifest | Avoids shipping 1-5 MB manifests to the browser for large repos. |
| Repo scope in v1 | Public + private repos from installed GitHub App connections, default branch only | Single code path, lower scope than branch/PR-aware browsing, still production useful. |
| Manifest source | Git Trees API for manifest, Git Blobs API for file content | Minimizes GitHub API calls and lets file fetch use blob SHA from the manifest. |
| `repomix` usage | Not in the live request path for v1 | `repomix` is useful background context, but the product needs remote manifest search and on-demand file fetch, not full-repo packaging. |
| Preview | Plain read-only preview in v1 | Lower complexity than Shiki/Monaco and enough for attach confirmation. |
| Share safety | Block community sharing for prompts that still contain `github` sources | Prevents accidental leakage of private repo-derived context through the current share flow. |

## 3. v1 Scope

### Included

- GitHub App connection flow
- user-scoped installation and repo metadata persistence
- repo discovery inside an installation and first-time repo connection creation
- cached manifest generation for the repo default branch
- search-first file selection
- read-only file preview
- attach selected files as `github` context sources
- prompt enhancement using attached GitHub sources
- draft/save/load round-trip support for GitHub-backed sources
- webhook-driven manifest invalidation
- explicit share guard for prompts containing GitHub sources

### Deferred

- folder tree UI
- Monaco or Shiki preview
- branch switcher / PR ref selection
- automatic related-file traversal from imports
- repo-wide ingestion into a single packed context artifact
- GitHub Marketplace/public GitHub App review work
- public community sharing of GitHub-backed prompts

## 4. End-State User Flow

1. User signs in to PromptForge with Neon Auth.
2. In Builder > Context and sources, the user chooses `Add from GitHub`.
3. If no installation exists, the frontend requests an install URL from the agent service and sends the user through the GitHub App install flow.
4. GitHub redirects to the agent service `setup_url`, which verifies signed state and nonce, fetches installation details from GitHub as the app, persists the installation metadata, and redirects back to the builder.
5. The picker shows the user's bound installations and a paged, searchable view of repos accessible inside each installation, grouped into already-connected repos and available repos.
6. The user selects a repo; the backend upserts a repo connection for that installation/repo pair, then loads a warm manifest or builds one from the repo default branch.
7. The user searches files via ComboBox-backed server search.
8. The user previews one or more files and attaches them.
9. The picker returns normalized `ContextSource` objects with `type: "github"` and a deterministic budgeted summary/raw excerpt.
10. Prompt enhancement runs through the existing `context_sources` path.
11. Drafts and saved prompts preserve the attached GitHub source metadata; community sharing is disabled until all GitHub sources are removed.

## 5. Architecture

### 5.1 Backend modules

Add these modules under `agent_service/`:

- `github-app.mjs`
  - create GitHub App client
  - mint installation-scoped Octokit clients on demand
  - generate install URLs with signed state
  - create and verify short-lived setup-return state/nonce payloads
  - fetch installation details from GitHub before persisting a user binding
  - list installation-accessible repos with GitHub pagination helpers
  - verify webhook signatures
- `github-store.mjs`
  - Neon Data API reads/writes for installations, repo connections, manifest cache
  - use a lightweight shared HTTP client helper instead of a direct Postgres pool
  - use service-role access for setup/webhook writes and the appropriate user-scoped read path for user-facing queries
  - support webhook lookups by `github_installation_id` and repo state transitions such as suspended/deleted/revoked
- `github-manifest.mjs`
  - fetch default-branch tree via Git Trees API
  - normalize/filter manifest entries
  - cache/retrieve manifest snapshots
  - search and rank manifest entries
- `github-source-context.mjs`
  - fetch blob content by SHA
  - summarize code/config/docs deterministically
  - build budgeted `ContextSource` payloads
- `github-routes.mjs`
  - declare the GitHub route registry in one place
  - attach `{ method, pattern, handler, authPolicy | customAuth }` to each route
  - return matched params together with the matched auth contract so auth does not depend on raw pathname fallback
- `handlers/github-install-url.mjs`
- `handlers/github-setup-return.mjs`
- `handlers/github-installations.mjs`
- `handlers/github-installation-repositories.mjs`
- `handlers/github-create-connection.mjs`
- `handlers/github-connections.mjs`
- `handlers/github-delete-connection.mjs`
- `handlers/github-refresh-manifest.mjs`
- `handlers/github-manifest-search.mjs`
- `handlers/github-preview-file.mjs`
- `handlers/github-build-context-sources.mjs`
- `handlers/github-webhooks.mjs`

Modify:

- `agent_service/codex_service.mjs`
  - complete the router/bootstrap cleanup described in `agent-service-refactoring.md` Phase 5 before GitHub work begins
  - import the new handlers
  - route new `/github/*` endpoints through a path-parameter-aware router instead of extending raw pathname `if` branches
  - resolve params, method handling, and auth from the matched route record instead of looking up auth from the raw pathname after routing
- `agent_service/service-runtime.mjs`
  - parse GitHub-related env vars
  - add named GitHub auth policies and `customAuth` handlers consumed by the route registry
  - ensure unmatched GitHub routes fail closed instead of inheriting the `/enhance` auth fallback
  - add GitHub endpoint rate-limit config
- `agent_service/README.md`
  - document new routes, env vars, and setup flow
  - document webhook-driven lifecycle transitions for suspended/deleted installations and revoked repo access

### 5.2 Frontend modules

Add:

- `src/lib/github-client.ts`
  - typed fetch helpers for GitHub endpoints
- `src/lib/service-auth.ts`
  - shared access-token/bootstrap helper extracted from `src/lib/ai-client.ts`
  - owns session lookup/refresh, bootstrap promise deduplication, and authenticated header construction
  - supports a strict "user JWT required" mode with no publishable-key fallback for GitHub endpoints
  - in strict mode, must fail with `auth_required` without clearing a valid local Neon session simply because publishable-key fallback is disallowed
  - keeps the publishable-key fallback path available only for existing `ai-client.ts` consumers that still need it
- `src/components/github/GitHubSourcePickerDialog.tsx`
- `src/components/github/GitHubConnectionCard.tsx`
- `src/components/github/GitHubSearchResults.tsx`
- `src/hooks/useGithubSourcePicker.ts`

Modify:

- `src/components/BuilderSourcesAdvanced.tsx`
  - add `Add from GitHub` entry point behind `VITE_GITHUB_CONTEXT_ENABLED`
- `src/components/ContextSourceChips.tsx`
  - render GitHub-backed source chips correctly inside the existing source list
- `src/pages/Index.tsx`
  - wire picker open state and attach returned sources into `contextConfig.sources`
  - compute and pass a GitHub-specific `shareBlockedReason`
  - block save-and-share when `github` sources exist
- `src/components/OutputPanel.tsx`
  - pass share-disabled reason through save/share affordances
- `src/components/OutputPanelHeader.tsx`
  - show disabled share affordance/reason without hiding why the action is blocked
- `src/components/OutputPanelSaveDialog.tsx`
  - surface the share-disabled reason
- `src/pages/Library.tsx`
  - disable later sharing for saved prompts that still contain GitHub sources
  - surface the same GitHub-specific reason for unshare/re-share flows
- `src/lib/persistence.ts`
- `src/lib/community.ts`
- `src/lib/context-types.ts`
- `src/lib/prompt-builder.ts`
- `src/lib/section-health.ts`
- `src/lib/template-store.ts`
- `src/lib/prompt-config-adapters.ts`
- `src/lib/enhance-context-sources.ts`
- `src/lib/telemetry.ts`
  - add typed builder telemetry events for GitHub connect/search/preview/attach/share-blocked actions
- `agent_service/context-source-expansion.mjs`

## 6. Data Model

Create a new migration in `supabase/migrations/` with these tables.

### `public.github_installations`

Purpose: user-scoped record of GitHub App installations that PromptForge can use.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references neon_auth."user"(id) on delete cascade`
- `github_installation_id bigint not null`
- `github_account_id bigint not null`
- `github_account_login text not null`
- `github_account_type text not null`
- `repositories_mode text not null`
- `permissions jsonb not null default '{}'::jsonb`
- `installed_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`
- `suspended_at timestamptz`
- `deleted_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes / constraints:

- unique `(user_id, github_installation_id)`
- index on `(github_installation_id)`
- index on `(user_id, updated_at desc)`

### `public.github_repo_connections`

Purpose: remember which repos from an installation the user has actually connected in PromptForge.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references neon_auth."user"(id) on delete cascade`
- `installation_record_id uuid not null references public.github_installations(id) on delete cascade`
- `github_repo_id bigint not null`
- `owner_login text not null`
- `repo_name text not null`
- `full_name text not null`
- `default_branch text not null`
- `visibility text not null`
- `is_private boolean not null`
- `last_selected_at timestamptz`
- `access_revoked_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes / constraints:

- unique `(user_id, github_repo_id)`
- index on `(installation_record_id, github_repo_id)`
- index on `(user_id, last_selected_at desc nulls last)`

### `public.github_repo_manifest_cache`

Purpose: persist a normalized file manifest for a repo/ref so search does not repeatedly hit GitHub.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references neon_auth."user"(id) on delete cascade`
- `repo_connection_id uuid not null references public.github_repo_connections(id) on delete cascade`
- `ref_name text not null`
- `tree_sha text not null`
- `entry_count integer not null`
- `manifest jsonb not null`
- `is_complete boolean not null default true`
- `last_error text`
- `generated_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `invalidated_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes / constraints:

- unique `(repo_connection_id, ref_name)`
- index on `(user_id, repo_connection_id, expires_at)`

### RLS

Enable row-level security on all three tables.

Policies:

- users can `select` rows where `user_id = auth.uid()`
- users can `insert/update/delete` only rows where `user_id = auth.uid()`

Even if the first implementation uses a service-role path inside the agent service, the tables should still carry RLS for defense in depth and future direct reads.

Manifest rows should only be used for search when `is_complete = true`. If a manifest build fails or cannot be completed, the service should keep serving the last complete manifest (if any) and surface the refresh error rather than caching a partial file list as if it were authoritative.

The database stores installation IDs and repo metadata, not installation access tokens. Installation tokens are minted on demand inside `agent_service/github-app.mjs` and may be cached only in process memory with a short TTL.

Lifecycle notes:

- successful setup for an existing installation should reactivate the existing row by clearing `suspended_at` and `deleted_at`
- reconnecting a previously revoked repo connection should clear `access_revoked_at` instead of creating a second logical record
- user-facing installation and connection lists should exclude rows with `deleted_at`, `suspended_at`, or `access_revoked_at` unless a future debug/admin surface explicitly opts in

### Neon type refresh

After the migration lands, regenerate/update:

- `src/integrations/neon/types.ts`

## 7. HTTP API

All `/github/*` endpoints live on the existing agent service origin.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/github/install-url` | Neon bearer JWT | Return a signed GitHub App install URL for the current user. |
| `GET` | `/github/app/setup` | GitHub setup redirect + signed state/nonce | Verify the setup return, fetch installation metadata from GitHub, persist the user-scoped installation record, then redirect back to the builder. |
| `GET` | `/github/installations` | Neon bearer JWT | List the current user's bound GitHub App installations. |
| `GET` | `/github/installations/:installationId/repositories?cursor=...&q=...&limit=...` | Neon bearer JWT | List repos accessible within one bound installation, including whether each repo is already connected in PromptForge, with server-side pagination and optional query filtering. |
| `POST` | `/github/connections` | Neon bearer JWT | Create or upsert a PromptForge repo connection from a selected installation repo. |
| `GET` | `/github/connections` | Neon bearer JWT | List the current user's connected repos. |
| `DELETE` | `/github/connections/:connectionId` | Neon bearer JWT | Remove a connected repo and invalidate cached manifests. |
| `POST` | `/github/connections/:connectionId/manifest/refresh` | Neon bearer JWT | Force-refresh the cached manifest. |
| `GET` | `/github/connections/:connectionId/search?q=...&limit=...` | Neon bearer JWT | Search the cached manifest. |
| `GET` | `/github/connections/:connectionId/file?path=...` | Neon bearer JWT | Return preview metadata and plain-text content for one file. |
| `POST` | `/github/connections/:connectionId/context-sources` | Neon bearer JWT | Convert selected files into normalized PromptForge `ContextSource[]`. |
| `POST` | `/github/webhooks` | GitHub signature | Invalidate manifests and update installation/repo lifecycle state on push / installation changes. |

### Route auth policy

Update the GitHub routing/auth contract so routes support two auth modes:

- standard user-auth routes use `{ allowUserJwt: true, allowPublicKey: false, allowServiceToken: false }`
- GitHub-owned auth routes use an explicit `customAuth`/`skipStandardAuth` path that bypasses standard bearer-key auth and lets the handler verify its own state/signature
- auth must be resolved from the matched route record, not from an exact-path map lookup after routing
- unmatched GitHub routes must fail closed, not inherit the permissive `/enhance` policy
- use named custom-auth entries so the routing contract is explicit in code:
  - `/github/app/setup` => `customAuth: "githubSetupState"`
  - `/github/webhooks` => `customAuth: "githubWebhookSignature"`

User-facing GitHub API routes should use the standard user-auth mode.

Exception:

- `/github/app/setup` uses signed state + nonce verification, not bearer auth, because it is reached via a GitHub browser redirect.
- `/github/webhooks` uses GitHub webhook signature verification instead of Neon user auth.

Frontend note:

- `src/lib/github-client.ts` must use the strict user-session path from `src/lib/service-auth.ts`; unlike `src/lib/ai-client.ts`, GitHub endpoints must not silently fall back to publishable-key auth.
- strict auth mode must not sign the user out just because a GitHub request requires a user JWT and no publishable-key fallback is allowed.

Repository discovery note:

- `/github/installations/:installationId/repositories` should return a stable `nextCursor` (or equivalent) and a `connected` boolean per repo so the picker can page results instead of crawling an entire installation on open.

## 8. Manifest Strategy

### Build

Use the Git Trees API against the repo default branch HEAD:

1. resolve default branch and tree SHA,
2. fetch the recursive tree,
3. if GitHub marks the recursive response as `truncated`, walk subtrees non-recursively until the manifest is complete or a safety cap is reached,
4. normalize entries into a compact manifest,
5. store the manifest JSON in `github_repo_manifest_cache`,
6. keep an in-memory LRU cache in the agent service for hot repos.

If the service cannot complete traversal within the safety cap, it must not cache the partial result as a fresh manifest. It should keep the prior complete manifest (if one exists) and return an explicit refresh error so search never silently drops files.

### Manifest entry shape

Each manifest entry should include:

- `path`
- `name`
- `extension`
- `directory`
- `size`
- `sha`
- `language`
- `binary`
- `generated`
- `vendored`
- `recommendedRank`

### Initial file filters

Exclude from attach/search results by default:

- binaries
- files over `200 KB`
- generated output directories: `dist/`, `build/`, `coverage/`, `.next/`, `out/`, `target/`
- vendored directories: `node_modules/`, `vendor/`, `Pods/`
- lockfiles and minified assets unless the user explicitly requests them later

### Search

Search stays server-side. Rank in this order:

1. exact filename match
2. exact path suffix match
3. directory + filename substring match
4. general substring match
5. fallback `recommendedRank`

Return at most `100` results per query.

### Cache policy

- manifest TTL: `15 minutes`
- invalidate on `push`, `installation_repositories`, and `installation` webhook events
- if the cached `tree_sha` matches the repo HEAD tree, skip rebuild
- if a recursive Git Trees response is `truncated`, switch to subtree traversal rather than accepting an incomplete manifest

## 9. Source Construction Rules

The frontend should not build GitHub-backed `ContextSource` objects itself. It should request them from the backend so summarization and budgets stay deterministic.

### `ContextSource` shape

Add:

- `ContextSourceType = "github"`
- `ContextReference.kind = "github"`

Use these conventions:

- `reference.refId`: `github:<repoId>:<commitSha>:<path>`
- `reference.locator`: `<owner>/<repo>@<commitSha>:<path>`
- `reference.permissionScope`: `github-installation:<installationId>`

### Summary rules

Implement a server-side `summarizeGithubFile()` helper:

- code files:
  - include file path
  - include detected language
  - include top-level exported/class/function/type names where easily detectable
  - include leading docblock/comment summary when present
- docs/config/text files:
  - use first meaningful lines and headings

Do not call an LLM to summarize files in v1.

### Raw excerpt rules

Implement a deterministic `sliceGithubFileForContext()` helper:

- keep full content when the file is at or under the raw cap
- otherwise truncate to the cap and mark `rawContentTruncated: true`

Manual line-range selection is deferred; the backend helper should accept optional `startLine` / `endLine` in its API contract so the UI can add it later without another backend redesign.

## 10. Context Budget Plan

The current repo-scale limits are too low. v1 should ship with these limits:

| Setting | Current | v1 |
|---|---:|---:|
| `MAX_PROMPT_CHARS` | `32000` | `64000` |
| `MAX_ENHANCE_CONTEXT_SOURCE_COUNT` | `8` | `12` |
| `MAX_ENHANCE_CONTEXT_SOURCE_SUMMARY_CHARS` | `2500` | `1200` |
| `MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS` | `12000` | `8000` |
| `MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS` | `32000` | `32000` |
| `MAX_SOURCE_EXPANSION_REQUESTS` | `3` | `3` |

Interpretation:

- more files may be attached, but each source must be tighter
- summary text is intentionally smaller so twelve sources can still fit comfortably
- raw excerpts stay capped because they are only expansion candidates
- with `MAX_SOURCE_EXPANSION_REQUESTS` staying at `3`, most GitHub sources will remain summary-only on a given enhancement run, so deterministic file summarization quality is a primary v1 concern

Implementation note:

- update `src/lib/enhance-context-sources.ts` and `agent_service/context-source-expansion.mjs` in the same change so the frontend and backend budgets stay synchronized

UI rules:

- show selected-source count and remaining budget inside the GitHub picker
- block attach when the selected files would exceed the source-count cap
- warn when attached sources are already truncated

## 11. Prompt/Persistence Integration

Update these files so GitHub sources behave like first-class context attachments:

- `src/lib/context-types.ts`
  - add `github` unions
  - ensure `buildContextBlock()` renders `[GITHUB: ...]` markers
- `src/lib/prompt-builder.ts`
  - count `github` sources in builder-state scoring
- `src/lib/section-health.ts`
  - treat `github` sources as supporting evidence
- `src/lib/template-store.ts`
  - validate `github` references
  - derive template external references for GitHub sources
- `src/lib/prompt-config-adapters.ts`
  - preserve `github` sources through V1/V2 hydration/serialization
- `src/lib/enhance-context-sources.ts`
  - widen source counts and budget constants
- `agent_service/context-source-expansion.mjs`
  - accept `github` as a valid source type

### Persistence choice

Do **not** add `repoConnections` to `ContextConfig` in v1.

Reason:

- the current prompt config shape only needs attached context, not a live repo browser session
- keeping connections server-side avoids a prompt-config schema bump
- saved prompts and templates remain portable; they only carry the attached source snapshot and reference metadata

### Raw content retention

- drafts: preserve GitHub source raw excerpts so refresh/retry still works
- saved prompts/templates: preserve summary + reference metadata; raw excerpt retention follows the existing external-source normalization rules unless later user testing proves deeper retention is required

## 12. Share and Privacy Guardrails

Prompts that contain any `github` source must not be shareable to Community in v1.

Required changes:

- `src/pages/Index.tsx`
  - update `canSharePrompt`
  - compute a GitHub-specific `shareBlockedReason`
- `src/components/OutputPanel.tsx`
  - pass the share-blocked reason into the save/share UI
- `src/components/OutputPanelHeader.tsx`
  - expose why sharing is blocked without requiring the user to guess from a disabled control
- `src/components/OutputPanelSaveDialog.tsx`
  - show a disabled-share message
- `src/pages/Library.tsx`
  - surface the same disabled-share reason for previously saved prompts
- `src/lib/persistence.ts`
  - reject `isShared=true` when `config.contextConfig.sources` contains `type === "github"`
- `src/lib/community.ts`
  - reject or avoid any direct save/share path that would otherwise write `is_shared=true` for a GitHub-backed prompt
- new migration under `supabase/migrations/`
  - update `public.sync_saved_prompt_share()` (or add an equivalent DB-level guard) so the database rejects attempts to publish configs containing `github` sources

Reason:

- current community publishing is trigger-backed at the database layer, not only UI-driven
- current community save/share paths persist `config`
- even without publishing raw file content, repo names, paths, and derived excerpts are sensitive product data

This block can be relaxed later only after a separate product/security review.

## 13. Delivery Plan

### Phase 0: Service groundwork

Goal: create clean backend seams before any GitHub logic lands.

Tasks:

- land the router/bootstrap cleanup from [`agent-service-refactoring.md`](agent-service-refactoring.md) Phase 5, including path-parameter-aware route dispatch for extracted handlers and mixed GET/POST/DELETE route handling
- add a small server-side Neon Data API helper for agent-service reads/writes; do not introduce a direct Postgres pool in v1
- add GitHub env parsing and route auth stubs in `agent_service/service-runtime.mjs`
- add explicit `customAuth`/`skipStandardAuth` handling for `/github/app/setup` and `/github/webhooks`
- add a GitHub route registry where the matched route carries params plus its auth contract
- add a backend feature flag: `GITHUB_CONTEXT_ENABLED`
- add signed-state helpers and secrets for the GitHub setup-return flow

Acceptance criteria:

- new GitHub handlers can be added without growing inline route logic
- path-parameter routes such as `/github/installations/:installationId/repositories` and `/github/connections/:connectionId/*` resolve through the extracted router, not raw pathname branching
- parameterized GitHub routes resolve auth from their matched route definition; no GitHub route can inherit `/enhance` public-key/service-token auth by fallback
- the agent service database layer is explicitly defined as Neon Data API over HTTP with a shared helper and no long-lived Postgres pool
- `node --check` passes on the extracted agent-service modules

### Phase 1: GitHub App connection flow

Goal: users can connect/disconnect repos through the existing agent service.

Tasks:

- add Neon migration for installation/repo/manifests tables
- add `octokit` dependencies
- implement `/github/install-url`, `/github/app/setup`, `/github/installations`, `/github/installations/:installationId/repositories`, `POST /github/connections`, `GET /github/connections`, and `DELETE /github/connections/:connectionId`
- make setup-return and reconnect flows reactivate existing installation/connection rows instead of creating duplicate logical records
- implement repository discovery pagination/query support on `/github/installations/:installationId/repositories`
- add builder UI CTA for `Add from GitHub`
- redirect the verified setup return back to the builder with a lightweight success/failure query param

Acceptance criteria:

- signed-in user can install the app, return through the verified setup flow, and see accessible repos in the picker
- installation repo discovery pages or filters results instead of preloading an entire large installation on picker open
- selecting an unconnected repo creates the repo connection and makes it available for search/preview
- disconnect removes the connection and cached manifest

### Phase 2: Manifest cache and search

Goal: connected repos can be searched quickly without repeated GitHub API scans.

Tasks:

- implement Git Trees fetch + normalized manifest cache
- implement `/manifest/refresh` and `/search`
- add server-side ranking/filtering
- build the UUI ComboBox-based picker with deferred query input and empty/loading/error states

Acceptance criteria:

- warm search does not call GitHub again
- large repos remain searchable without shipping the full manifest to the client
- truncated Git Trees responses fall back to subtree traversal instead of silently dropping files

### Phase 3: Preview and attach

Goal: selected files become budget-safe PromptForge context sources.

Tasks:

- implement `/file` preview and `/context-sources`
- add `github` source/reference support across prompt composition, persistence, and enhancement normalization
- surface selected-source budget in the picker
- render attached GitHub sources in the existing sources area
- thread a GitHub-specific `shareBlockedReason` through builder save/share UI and library actions
- block community sharing for prompts containing GitHub sources in the UI, client persistence helpers, and DB trigger path

Acceptance criteria:

- attached GitHub sources survive draft save/load
- enhancement requests include GitHub sources and complete successfully
- share UI is disabled with an explicit reason
- direct `is_shared=true` writes for GitHub-backed prompts are rejected server-side

### Phase 4: Webhooks, telemetry, and rollout

Goal: make the feature operable in production.

Tasks:

- implement `/github/webhooks`
- invalidate manifests on repo changes / installation removal
- mark installation rows as suspended/deleted and repo connections as access-revoked when webhook events indicate access has been removed
- filter revoked/suspended/deleted rows out of user-facing lists and make refresh/preview fail cleanly for stale connections
- add telemetry events for connect, search, preview, attach, share-blocked
- update `src/lib/telemetry.ts` so the new builder telemetry events are part of the typed event union
- update docs and env examples
- enable the feature flag only after QA passes

Acceptance criteria:

- pushing to a connected repo invalidates the cached manifest
- installation removal disables future refresh/preview requests cleanly
- repo removals from an installation disappear from active picker/search flows until the user reconnects after access returns

## 14. Test Plan

### Unit / integration

Add or extend:

- `src/test/enhance-context-sources.test.ts`
- `src/test/template-store.test.ts`
- `src/test/persistence.test.ts`
- `src/test/context-source-expansion.test.ts`
- new `src/test/service-auth.test.ts`
- new `src/test/github-client.test.ts`
- new `src/test/github-source-picker.test.tsx`
- new `src/test/github-source-context.test.ts`
- new `src/test/agent-service-github-auth-routing.test.ts`
- new `src/test/agent-service-github-manifest.test.ts`
- new `src/test/agent-service-github-installation.test.ts`
- new `src/test/agent-service-github-setup-state.test.ts`
- extend `src/test/output-panel-save-dialog-async.test.tsx` or equivalent save/share UI coverage for GitHub-specific share-blocked messaging
- extend telemetry tests for the new GitHub builder event names

### RLS

Add `test:rls` coverage for:

- users can only read their own `github_installations`
- users can only read their own `github_repo_connections`
- users cannot read another user's manifest cache rows
- GitHub-backed prompts cannot become public even if a client attempts to set `saved_prompts.is_shared = true`

### Playwright

Extend:

- `playwright/builder.desktop.spec.ts`
- `playwright/builder.mobile.spec.ts`

Cover:

- signed-in connect CTA visibility
- picker open/search/select flow
- attach source chip appears
- share action disabled when GitHub sources are attached
- share-blocked reason is visible to the user, not only implied by a disabled control

## 15. Environment and Deployment

Add to frontend build config:

- `VITE_GITHUB_CONTEXT_ENABLED`

Add to agent-service deployment config:

- `GITHUB_CONTEXT_ENABLED`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_POST_INSTALL_REDIRECT_URL`
- `NEON_DATA_API_URL`
- `NEON_AUTH_URL`
- `NEON_SERVICE_ROLE_KEY`

Update:

- `agent_service/README.md`
- `.env.example`
- Azure Web App GitHub Action / secret inventory if required

GitHub App configuration:

- repository permissions: `Contents: Read-only`, `Metadata: Read-only`
- events: `push`, `installation`, `installation_repositories`
- setup URL: agent service `/github/app/setup`
- callback URL: not required for v1 unless `request_oauth_on_install` is introduced later
- webhook URL: agent service `/github/webhooks`

## 16. Open Items Kept Intentionally Out of v1

These are real follow-up candidates, not blockers:

- branch-aware browsing
- line-range UI
- automatic related-file suggestions
- Shiki/Monaco preview
- repomix-based multi-file pack or compression
- opt-in public sharing rules for public-repo sources only

## 17. Definition of Done

The feature is done when all of the following are true:

1. A signed-in user can connect a GitHub App installation and select a repo.
2. The install/setup return is bound to the initiating PromptForge user through verified state and server-side installation lookup.
3. Search returns files from a cached default-branch manifest, including repos whose recursive Git Trees response required subtree fallback.
4. Attached files arrive in PromptForge as `github` `ContextSource`s.
5. Enhancement uses those sources through the existing `context_sources` pipeline.
6. Draft/prompt persistence round-trips the GitHub sources correctly.
7. Community sharing is blocked while GitHub sources remain attached, including direct `is_shared=true` publish attempts.
8. Webhooks invalidate stale manifests.
9. Unit, RLS, and Playwright coverage lands with the feature.
