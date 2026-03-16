# GitHub Repo Integration Recommendation For PromptForge

> **Review Status:** Reviewed 2026-03-16 against actual codebase state.
> Inline annotations marked with **⚠️ REVIEW** identify gaps, corrections, and conflicts found during audit.
> Full critique: [`plans/github-integration-recommendation-critique.md`](plans/github-integration-recommendation-critique.md)
> Concrete implementation plan: [`plans/github-integration-implementation-plan.md`](plans/github-integration-implementation-plan.md)

## Short answer

For this repo, the best fit is not a single bundled stack like "Headless Tree + cmdk + GitHub App/Octokit."

The best fit is:

- `GitHub App + Octokit` on the backend if the feature must support private repos or organization repos.
- A search-first selection UI built around ~~`cmdk` and~~ the existing app primitives.
- A budget-aware context assembly step that treats the model input maximum as a hard ceiling, not a target.
- An optional tree UI and richer preview layer only if user testing shows they are needed.

> **⚠️ REVIEW — cmdk is a phantom dependency.** `cmdk@^1.1.1` is listed in [`package.json`](package.json:87) but **zero source files import it**. The codebase uses UUI [`ComboBox`](src/components/base/select/combobox.tsx:1) (React Aria) for search/select patterns. Building on cmdk means starting from scratch; extending UUI ComboBox follows the established codebase pattern. The recommendation should specify which approach to use after evaluating both.

## Why this is the best fit for this repo

This app is a Vite + React frontend deployed as Azure Static Web Apps, and the production workflow does not include a bundled API surface in the SWA app itself. That means a GitHub integration for private or org repos is not just a UI choice; it requires a real backend integration path.

> **⚠️ REVIEW — Backend path is unspecified.** The existing backend is the agent service at [`agent_service/codex_service.mjs`](agent_service/codex_service.mjs:1) — a 2,370-line monolith deployed as Azure Web App (`ai-prompt-pro-agent`). This recommendation must specify whether GitHub endpoints should: (a) extend the agent service, (b) be a new microservice, or (c) use Azure Functions attached to the SWA. Each option has different deployment, auth, and state management implications.

This repo also already has an attached-source model for prompt context. The GitHub integration should plug into that model instead of creating a completely separate "repo context" subsystem unless the implementation clearly needs one.

The current source flow is built for small, explicit context attachments. It is not built for arbitrary repo ingestion today, so the GitHub feature should introduce a new repo-backed ingestion path and then normalize selected content into the existing source/context flow where possible.

> **⚠️ REVIEW — Type system extension required.** The existing [`ContextSourceType`](src/lib/context-types.ts:1) is `"text" | "url" | "file" | "database" | "rag"` — there is no `"github"` or `"repo"` kind. [`ContextReference.kind`](src/lib/context-types.ts:5) mirrors this union. Adding a repo source requires synchronized updates to [`defaultContextConfig`](src/lib/context-types.ts:82), [`buildContextBlock()`](src/lib/context-types.ts:255), [`scorePrompt()`](src/lib/prompt-builder.ts:476), `getSectionHealth()`, and [`normalizeTemplateConfig()`](src/lib/template-store.ts:35). This is documented in [`CLAUDE.md`](CLAUDE.md:46) as a required checklist.

> **⚠️ REVIEW — `repomix` is already a dev dependency.** [`package.json`](package.json:134) includes `"repomix": "^1.12.0"` and [`repomix.config.json`](repomix.config.json) exists. Repomix packages repository contents as LLM context — exactly the "normalized file manifest" use case described below. The recommendation should evaluate whether repomix can serve as the manifest layer or inform the schema design, rather than building from scratch.

## Recommended architecture

### 1. Auth and repository access

Use a GitHub App with Octokit if the feature is meant for real users connecting private repositories, especially across organizations.

Why:

- Better permission boundaries than user-owned long-lived tokens.
- Cleaner support for org installs and revoked access.
- Better fit for a multi-user product feature than a personal-token-based design.

If the first version is internal-only or admin-only, a fine-grained PAT flow is a simpler fallback, but it should be treated as a scoped shortcut rather than the default long-term architecture.

> **⚠️ REVIEW — Existing GitHub OAuth cannot be reused for API access.** The app's existing GitHub sign-in at [`AuthDialog.tsx`](src/components/AuthDialog.tsx:211) delegates to [`neon.auth.signInWithOAuth({ provider: "github" })`](src/hooks/auth-provider.tsx:134) — this is **Neon Auth** (Better Auth adapter), not a GitHub API OAuth flow. The resulting session is a Neon JWT; no GitHub access token is stored or accessible. A GitHub App installation flow requires its own OAuth callback endpoint, token exchange logic, and persistent token storage — an entirely separate pathway from the existing auth system.

> **⚠️ REVIEW — Token storage gap.** GitHub App installation tokens expire in 1 hour and must be stored server-side. The agent service currently has **no persistent storage** and no secrets management beyond environment variables. This recommendation must specify where tokens are stored: Neon Postgres (with encryption), Azure Key Vault, or in-memory (lost on restart).

> **⚠️ REVIEW — GitHub App review requirement.** A GitHub App requesting `contents:read` on private repos requires GitHub App review for public distribution. The recommendation should clarify whether this is a private app (PromptForge users only) or needs public listing approval.

### 2. Repo manifest and file retrieval

Build a normalized file manifest on the backend, then fetch file contents on demand.

Suggested manifest fields:

- `path`
- `name`
- `extension`
- `directory`
- `size`
- `sha`
- `binary`
- `generated`
- `vendored`
- `language`
- `lastModified` if available

This manifest should support:

- search
- filtering by extension or directory
- ranking likely-useful files
- include and exclude decisions
- chunking large files before they become prompt context

> **⚠️ REVIEW — GitHub API rate limits and manifest strategy.** GitHub API rate limits are aggressive: 5,000 requests/hour per installation token (shared across all users of that installation). The recommendation should specify:
> - Whether manifest building uses the Git Trees API (single call, up to 100K entries) or Contents API (per-file)
> - Caching strategy for manifests (TTL, invalidation on push via webhooks)
> - Rate limit pooling across users sharing the same installation
> - Where cached manifests are stored (no persistent cache exists in the current agent service)

> **⚠️ REVIEW — Database schema required.** No schema exists for repo connections, cached manifests, or GitHub App installations. New Neon Postgres tables are needed with RLS policies consistent with existing patterns in [`supabase/migrations/`](supabase/migrations/).

### 3. User experience

Start with search-first selection, not a full tree-first UI.

Recommended v1 interaction:

1. Connect a repo.
2. Build or load a cached manifest.
3. Use quick-open search to find files.
4. Select files or file slices to attach as context.
5. Show a running context budget before submission.

Why this is the better v1:

- ~~`cmdk` is already in the repo.~~
- ~~It is lower-risk than introducing a new tree framework immediately.~~
- Many users will know the file they want faster than they will browse to it.

> **⚠️ REVIEW — cmdk justification removed.** cmdk is installed but unused. The two viable search UI paths are: (a) build a new cmdk-based Command component from scratch, or (b) extend the existing UUI [`ComboBox`](src/components/base/select/combobox.tsx:1) which uses React Aria and is the established pattern. The UUI ComboBox is lower-risk because it is already wired, styled, and accessibility-tested in the codebase.

> **⚠️ REVIEW — Large-repo search scalability.** For repos with 10K+ files, client-side manifest search requires 1–5 MB payload transfer and in-browser fuzzy search. If server-side search becomes necessary, the "simple search UI" becomes a backend search API with debouncing, pagination, and caching — significantly more complex than implied here.

Add a true tree only if testing shows users often browse by folder structure rather than search.

### 4. Context budgeting

The model input maximum should be treated as a hard ceiling, not a packing target.

The system should:

- reserve budget for system instructions, user prompt, and response headroom
- estimate context size before attachment
- reject or trim over-budget selections deterministically
- prefer file slices, extracted symbols, or summarized sections when full-file inclusion is wasteful
- make the budget visible in the UI before the user runs enhancement

This is the biggest gap between the current app and the GitHub feature. The current PromptForge source flow is optimized for a small number of compact sources, so a repo integration needs explicit budgeting logic rather than assuming the existing source caps are sufficient.

> **⚠️ REVIEW — Current budget limits are fundamentally undersized for repo content.** The existing hard limits in [`enhance-context-sources.ts`](src/lib/enhance-context-sources.ts:22):
>
> | Constant | Value | Repo-scale problem |
> |----------|-------|--------------------|
> | `MAX_ENHANCE_CONTEXT_SOURCE_COUNT` | 8 | Typical file selection is 10–50 files |
> | `MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS` | 12,000/source | A single 300-line file is ~12K chars |
> | `MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS` | 32,000 total | 3–5 files exhaust this |
> | `MAX_PROMPT_CHARS` (agent service) | 32,000 | Prompt + sources + system instructions must all fit |
>
> The recommendation correctly identifies budgeting as the biggest gap but does not propose new numeric limits. A repo context budget strategy is needed that either: (a) raises limits with a separate repo-source allocation, (b) introduces server-side summarization/chunking that compresses repo content before it counts against the budget, or (c) both.

> **⚠️ REVIEW — Enhancement pipeline interaction.** The recommendation does not address how the enhancement pipeline would use repo context differently from other sources. Code files may need: different summarization strategies than prose, ability to request related files not in the initial selection (imports, type definitions), and different truncation heuristics.

### 5. Preview

Do not start with Monaco unless rich code navigation is a proven requirement.

Recommended order:

- v1: plain read-only preview
- v1.1 or v2: add Shiki if static syntax highlighting is needed
- later: add Monaco only if users need a heavier editor-like preview experience

That keeps the initial surface smaller while still leaving room for a richer code-reading experience.

## What I would not recommend as the first version

I would not recommend making the first version:

- tree-first
- Monaco-first
- client-side-only for private repos
- centered on "include as much of the repo as possible"

Those choices add complexity early and do not match the actual user goal well enough.

## Best recommendation by scenario

### Best overall for this repo

`GitHub App + Octokit backend` + ~~`cmdk`~~ `search-first file selection` + `budget-aware context assembly`

This is the best long-term recommendation for PromptForge if the feature is meant to be production-grade.

### Best low-friction internal option

Fine-grained PAT + Octokit + search-first UI

Use this only if:

- the feature is internal
- users are technical
- org-wide installation and permission management are not needed yet

### Best low-complexity public-only option

Public repo manifest + public file fetch + search-first UI

Use this if:

- private repo support is not required in v1
- you want to validate the workflow before adding GitHub App installation flow

## Final recommendation

For PromptForge, the best recommendation is:

- keep `GitHub App + Octokit` as the backend recommendation for production private-repo support
- make ~~`cmdk`-driven~~ search-first selection the primary UI (evaluate UUI ComboBox extension vs. cmdk)
- treat the model input maximum as a hard ceiling
- add tree browsing and rich preview only after the workflow proves they are necessary

So the right repo-specific answer is not:

- "Best overall: Headless Tree + cmdk + GitHub App/Octokit"

It is:

- "Best overall: GitHub App + Octokit backend, search-first repo selection, and budget-aware context assembly; add a tree or richer preview only if usage justifies it."

---

## Pre-implementation decisions required

Before creating an implementation plan, these decisions need answers:

| # | Decision | Options |
|---|----------|---------|
| 1 | Where do GitHub API endpoints live? | Extend agent service / New microservice / Azure Functions |
| 2 | Use cmdk or extend existing UUI ComboBox? | cmdk requires new component; ComboBox is established pattern |
| 3 | New `ContextSourceType` value or new `ContextConfig` field? | Affects persistence, templates, and full config pipeline |
| 4 | Can repomix inform or replace the manifest layer? | Already a dependency; may reduce custom code |
| 5 | What are the new budget limits for repo sources? | Current 8-source / 32K-char caps are insufficient |
| 6 | Where are GitHub installation tokens stored? | Neon Postgres / Azure Key Vault / In-memory |
| 7 | Is v1 public-repos-only or private-repos? | Determines whether GitHub App flow is needed for v1 |
