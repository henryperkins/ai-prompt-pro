## Complete Spec: Saved Prompts Library, Community Feed, Remix, and Codex-Style Event Integration

This spec consolidates the *current repo integration points* (what the codebase is already structured to do) with the *planned database + policy contract* so the feature set is end-to-end consistent: private saving, public feed sharing, remixing with attribution + diffs, and a Codex-inspired event model for streaming/reconnectability.    

---

# 1) Goals and non-goals

## Goals

* Give users a **private prompt library** of named, searchable entries that capture:

  * `PromptConfig` (builder state snapshot)
  * `built_prompt` (compiled prompt)
  * `enhanced_prompt` (AI output)
  * metadata: title, description, tags, category
* Allow users to **share** a saved prompt into a **public community feed** (readable without login, but interactive actions require a real account).
* Enable **Remix** as the core social mechanic:

  * remix attribution (parent link)
  * optional remix note (“why I changed this”)
  * computed remix diff (config changes summary)
  * remix counts on parent post
* Provide “developer-signal” engagement:

  * **Upvote**
  * **Verified / Worked for me**
  * **Comments**
* Make the AI “enhance” experience resilient and future-proof by designing for:

  * stable streaming protocol
  * reconnectability
  * prompt-prefix stability (caching efficiency)
  * eventual multi-item outputs (tool calls, structured items)

## Non-goals (MVP)

* Heavy social graph (followers, DMs, profiles beyond avatar/display name)
* Threaded comment trees (flat comments only)
* Downvotes/reputation systems
* Moderation tooling beyond basic flagging + is_public gating (future)

---

# 2) Terminology

* **Builder**: interactive prompt builder driven by `PromptConfig`.
* **Saved Prompt**: private entry in a user’s library (`saved_prompts`).
* **Community Post**: the public feed entry (`community_posts`), created/updated from a saved prompt when shared.
* **Remix**: a new saved prompt (and optionally a community post) derived from an existing community post. Stored as links + diff snapshot.

---

# 3) User stories and UX flows

## A) Build → Enhance → Save (private)

1. User builds a prompt and clicks **Enhance**.
2. Enhanced output streams into OutputPanel.
3. User clicks **Save Prompt**.
4. Modal captures:

   * Title (required)
   * Description (optional)
   * Category (required)
   * Tags (optional)
5. App writes a row in `saved_prompts` with `is_shared=false`.

**Acceptance criteria**

* Saved prompt appears in **Prompt Library → My Prompts**.
* Loading it restores config into builder and shows saved enhanced output.

---

## B) Save & Share (one-shot from builder)

1. User clicks **Save & Share** from OutputPanel.
2. Modal captures:

   * Title (required)
   * Use case (required)
   * Category (required)
   * Tags (optional)
   * Target model (optional)
   * Safety confirmation checkbox (required): “no secrets / no private data”
3. App creates `saved_prompts` row, then marks it `is_shared=true` and sets share metadata.
4. DB creates/updates a `community_posts` row (public shadow copy).

**Acceptance criteria**

* Post becomes visible on `/community` feed.
* Saved prompt shows “Shared” badge + community metrics + “Open in Community”.

---

## C) Share / Unshare from Prompt Library

* In Prompt Library, each saved prompt shows:

  * Share button (if not shared)
  * Unshare button (if already shared)
* Share opens the same share dialog as above.

**Unshare behavior**

* Unsharing should **not destroy** the author’s private saved prompt.
* The community post becomes non-public by setting `community_posts.is_public=false` (not necessarily deleting the row).

**Acceptance criteria**

* Unshared post is not visible on the public feed
* Comments and votes are hidden when post is not public (see RLS section)

---

## D) Browse Community Feed

`/community` provides:

* Sort tabs:

  * New
  * Popular (upvotes)
  * Most Remixed
  * Verified
* Category chips + search (MVP: title search; later: FTS)
* Single-column “Instagram-like” cards:

  * author identity (avatar + display name)
  * time
  * prompt preview panel (expand/collapse)
  * title + use case
  * category + tags
  * counters (▲ ✓ 🔀 💬)
  * actions: Remix, Copy, Open thread, Expand comments inline

**Acceptance criteria**

* Feed loads quickly (paged, “Load more”)
* Cards remain visually consistent (predictable height with expandable prompt preview)

---

## E) Post Detail

`/community/:postId` shows:

* Full prompt preview (expandable)
* Upvote / Verified buttons (toggle)
* “Remix in Builder” (routes to `/?remix=<id>`)
* “Save to Library” (copies into saved prompts as a remix)
* Remix provenance (“Remixed from …”) + diff view
* Comments list + add comment box
* Remixes list (children)

---

## F) Remix

### Remix into Builder

1. User taps **Remix** on any community post.
2. App routes to builder with `?remix=<postId>`.
3. Builder loads `community_posts.public_config` into PromptConfig.
4. Builder shows a banner: “Remixing @author’s prompt” with “Stop remixing” action.
5. If user saves/shares while remixing:

   * `saved_prompts.remixed_from = parent_post_id`
   * `saved_prompts.remix_note` captured (optional)
   * `saved_prompts.remix_diff` computed (snapshot)

### Save to Library (quick remix)

* On post detail, user can “Save to Library” which:

  * creates a private saved prompt derived from the post (with remixed_from set)
  * then user can edit/share later

**Acceptance criteria**

* Remixed posts show attribution and diff snapshot
* Parent `remix_count` increments only for public remixes (or only for shared remixes, depending on policy chosen—see counters)

---

# 4) Data model

## A) `saved_prompts` (private library)

**Core fields**

* `id uuid PK`
* `user_id uuid FK auth.users`
* `title text NOT NULL`
* `description text DEFAULT ''`
* `category text DEFAULT 'general'`
* `tags text[] DEFAULT '{}'`
* `config jsonb NOT NULL`
* `built_prompt text NOT NULL DEFAULT ''`
* `enhanced_prompt text NOT NULL DEFAULT ''`

**Sharing metadata**

* `is_shared boolean NOT NULL DEFAULT false`
* `use_case text DEFAULT ''`
* `target_model text DEFAULT ''`

**Remix metadata**

* `remixed_from uuid NULL FK → community_posts.id ON DELETE SET NULL`
* `remix_note text DEFAULT ''`
* `remix_diff jsonb NULL`

**Versioning**

* `fingerprint text NULL`
* `revision int NOT NULL DEFAULT 1`

**Timestamps**

* `created_at timestamptz`
* `updated_at timestamptz`

**Constraints**

* Optional: `UNIQUE (user_id, lower(title))` (nice UX)
* Optional: `CHECK (char_length(title) <= 200)`
* Optional: `CHECK (char_length(description) <= 500)`
* Optional: `CHECK (char_length(use_case) <= 1000)` (or similar)

---

## B) `community_posts` (public feed)

**Identity**

* `id uuid PK`
* `saved_prompt_id uuid UNIQUE NOT NULL FK → saved_prompts(id) ON DELETE CASCADE`
* `author_id uuid FK auth.users`

**Public content**

* `title text NOT NULL`
* `description text DEFAULT ''`
* `use_case text DEFAULT ''`
* `category text NOT NULL`
* `tags text[] DEFAULT '{}'`
* `target_model text DEFAULT ''`
* `enhanced_prompt text NOT NULL`

**Public builder state**

* `public_config jsonb NOT NULL` *(sanitized copy for remixing)*
* `starter_prompt text NOT NULL DEFAULT ''` *(short preview derived from config/built prompt)*

**Visibility**

* `is_public boolean NOT NULL DEFAULT true`

  * feed queries always filter `is_public=true`

**Remix lineage**

* `remixed_from uuid NULL FK → community_posts(id) ON DELETE SET NULL`
* `remix_note text DEFAULT ''`
* `remix_diff jsonb NULL`

**Counters**

* `upvote_count int DEFAULT 0`
* `verified_count int DEFAULT 0`
* `comment_count int DEFAULT 0`
* `remix_count int DEFAULT 0`

**Timestamps**

* `created_at timestamptz`
* `updated_at timestamptz`

---

## C) `community_votes`

* `id uuid PK`
* `post_id uuid FK → community_posts(id) ON DELETE CASCADE`
* `user_id uuid FK → auth.users`
* `vote_type text CHECK (vote_type IN ('upvote','verified'))`
* `created_at timestamptz`

**Constraints**

* `UNIQUE (post_id, user_id, vote_type)`

---

## D) `community_comments`

* `id uuid PK`
* `post_id uuid FK → community_posts(id) ON DELETE CASCADE`
* `user_id uuid FK → auth.users`
* `body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000)`
* `created_at timestamptz`
* `updated_at timestamptz`

---

# 5) Database triggers, functions, and indexes

## A) Public-config sanitization

Provide a SQL function:

* `strip_sensitive_prompt_config(input_config jsonb) returns jsonb`

**What it must strip**

* Any context sources containing raw content:

  * `contextConfig.sources[].rawContent`
* Any “reference” pointers that could map to private resources:

  * `contextConfig.databaseConnections[].connectionRef`
  * `contextConfig.ragParams.vectorStoreRef`
* Any other secrets or internal IDs

**What it can keep**

* “shape” of the prompt and safe metadata:

  * role/task/format/constraints/tone/complexity
  * tags/category/title/use_case
  * safe “context summary” fields that are not raw content

---

## B) Share/unshare propagation

A trigger on `saved_prompts` should upsert into `community_posts`:

**On share (`is_shared=true`)**

* `community_posts.is_public=true`
* Copy metadata + enhanced prompt
* `public_config = strip_sensitive_prompt_config(saved_prompts.config)`
* `starter_prompt = derived preview`

**On unshare (`is_shared=false`)**

* `community_posts.is_public=false`
* (optional) keep row for stable links + remix lineage

---

## C) Counter maintenance

Triggers update counters on `community_posts`:

* Votes:

  * insert/delete on `community_votes` updates `upvote_count` or `verified_count`
* Comments:

  * insert/delete updates `comment_count`
* Remixes:

  * when a community post is created (or becomes public) with `remixed_from` set:

    * increment parent `remix_count`
  * when a remix post is unpublished (is_public=false) or deleted:

    * decrement parent `remix_count`

Additionally, a reconciliation function is useful:

* `refresh_community_post_metrics(target_post_id uuid)` to recompute counts from source tables

---

## D) Updated-at triggers

Use a standard `set_updated_at` trigger on:

* `saved_prompts`
* `community_posts`
* `community_comments`

---

## E) Indexes (aligned to feed queries)

* Feed sort:

  * `community_posts (created_at desc)`
  * `community_posts (upvote_count desc, created_at desc)`
  * `community_posts (verified_count desc, created_at desc)`
  * `community_posts (remix_count desc, created_at desc)`
* Filtering:

  * `community_posts (category)`
  * `GIN (tags)`
* Remix graph:

  * `community_posts (remixed_from) WHERE remixed_from IS NOT NULL`
* Library list:

  * `saved_prompts (user_id, updated_at desc)`

**Search**

* MVP uses `ILIKE` on title.
* Upgrade path: add a GIN `tsvector` on `title + description + use_case + tags`.

---

# 6) RLS and permissions (critical)

## Key product policy

* Reading the feed should be possible with an anon client (growth-friendly), but **interaction requires a real account** (non-anonymous auth).

### A) `saved_prompts`

* SELECT/INSERT/UPDATE/DELETE: owner only (`user_id = auth.uid()`)

### B) `community_posts`

* SELECT:

  * allowed if `is_public=true` (anyone, including anon)
  * optional: allow author to read their own posts even if `is_public=false`
* UPDATE:

  * author only (`author_id = auth.uid()`)
* INSERT:

  * either blocked (if created by trigger), or author only (if manual insert ever needed)
* DELETE:

  * likely disallowed for normal users; prefer “unpublish” (set is_public=false)

### C) `community_comments`

* SELECT:

  * allowed only when `post.is_public=true`
  * (current contract): even comment owners cannot see comments when a post is not public
* INSERT:

  * only if authenticated and non-anonymous
  * only if parent post is public
  * `user_id = auth.uid()`
* UPDATE/DELETE:

  * owner-only, optionally only while post is public

### D) `community_votes`

* SELECT:

  * owner-only (you only fetch *your own* votes for UI state)
* INSERT/DELETE:

  * only if authenticated and non-anonymous
  * only if post is public
  * `user_id = auth.uid()`

### E) Non-anonymous requirement

Provide a SQL helper:

* `is_non_anonymous_account()` used in comment/vote policies.

---

# 7) Frontend architecture and integration points

## Routes

* `/` → Builder (Index)
* `/community` → Feed
* `/community/:id` → Post detail

## Core modules

### A) Persistence (private library)

* `src/lib/persistence.ts`

  * `savePrompt(userId, input)` creates/updates `saved_prompts`
  * `listPrompts(userId)` returns prompt summaries
  * `sharePrompt(userId, promptId, shareInput)` updates saved prompt share metadata and flips `is_shared=true`
  * `unsharePrompt(userId, promptId)` sets `is_shared=false`
  * revision handling for optimistic concurrency

### B) Community (public feed + engagement)

* `src/lib/community.ts`

  * feed query: `loadFeed({ sort, category, search, page })`
  * post detail: `loadPost(postId)`
  * remixes list: `loadRemixes(postId)`
  * votes: `loadMyVotes(postIds)`, `toggleVote(postId, type)`
  * comments: `loadComments(postId)`, `addComment(postId, body)`
  * remix helper: `remixToLibrary(postId)` (copy to saved prompts)
  * diff: `computeRemixDiff(parentConfig, nextConfig)`

### C) Builder state / orchestration

* `src/hooks/usePromptBuilder.ts`

  * owns config state, built prompt, enhanced prompt
  * handles save / save+share and injects remix metadata when in remix mode
  * clears remix mode after saving to prevent accidental attribution leakage

### D) Feed UI

* `src/pages/Community.tsx`

  * sort + category + search state
  * paginated “Load more”
  * fetches profile maps and parent post maps for remix attribution
* `src/components/community/*`:

  * `CommunityFeed`, `CommunityPostCard`, `CommunityPostDetail`, `PromptPreviewPanel`, `CommunityComments`, etc.

### E) Remix integration

* Builder supports `/?remix=<community_post_id>`

  * loads `community_posts.public_config` into builder config
  * shows remix banner with “stop remixing” control
  * save/share attaches remix metadata + diff

---

# 8) Backend services

## A) Supabase Edge Functions

### `enhance-prompt`

* Auth required for calling the model proxy
* Applies rate limiting
* Forwards to `AGENT_SERVICE` streaming endpoint and pipes SSE through

### `extract-url`

* (Context ingestion helper)
* Should also be rate-limited and sanitize response sizes

## B) Agent Service

* `/enhance` endpoint:

  * takes built prompt + config
  * calls Codex via `@openai/codex-sdk` (recommended runtime)
  * streams SSE chunks back
* Backend: Node Codex SDK service (`agent_service/codex_service.mjs`).

## C) Request/streaming flow (summary)

```text
Browser UI
  | (SSE request: /functions/enhance-prompt)
  v
Supabase Edge Function: enhance-prompt
  | (HTTP stream proxy)
  v
Agent Service (Node Codex SDK)
  v
Codex SDK event stream
  | (SSE stream of deltas / events)
  v
Agent Service -> Edge Function -> Browser UI
```

---

# 9) Codex-inspired event model (baseline integrated)

This is the architectural layer that makes “enhance/remix/share” feel robust, reconnectable, and future-proof for tool calls and multi-step agent work.

The Codex harness pattern models interactions as:

* **Thread → Turn → Item**, streamed as stable UI-ready events. 

The Codex agent loop guidance emphasizes:

* keep prompts as exact-prefix when possible for caching
* avoid reordering tool lists / static content
* compact when context grows too large 

## A) Minimal event protocol for this app

### Event envelope (SSE)

Every SSE `data:` line is JSON:

```json
{ "event": "thread.started", "thread_id": "..." }
{ "event": "turn.started", "turn_id": "...", "thread_id": "...", "kind": "enhance" }
{ "event": "item.started", "type": "response.output_item.added", "item_id": "...", "item_type": "agent_message" }
{ "event": "item/agent_message/delta", "type": "response.output_text.delta", "item_id": "...", "delta": "..." }
{ "event": "item/completed", "type": "response.output_text.done", "item_id": "...", "payload": { "text": "..." } }
{ "event": "turn.completed", "type": "response.completed", "turn_id": "...", "thread_id": "..." }
```

### Item types we care about

* `agent_message` (streaming model output)
* `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `todo_list`, `error` (Codex SDK item union)
* optional app-level synthetic items (for example `saved_prompt_created`) if we decide to stream write-side actions later

### Backward compatibility

* Continue emitting the existing “delta text” shape (`choices.delta.content`) for the enhanced text stream, so older clients still work.
* New clients consume the richer `event` envelope.

## B) Persistence for reconnectability (Phase 2)

To support “resume after reload” and auditable remix lineage, persist turn/item events (or at least turn summaries).

Lightweight approach:

* Table `turn_events(thread_id, turn_id, item_id, event_type, payload, created_at)`
* On reconnect:

  * fetch latest events for thread
  * reconstruct UI state deterministically

## C) Prompt caching requirements (Phase 2+)

Adopt Codex-style “exact prefix stability”:

* Keep system instructions stable at the front.
* Append variable content at the end (user prompt, context, diffs).
* Ensure tool lists are stable and consistently ordered to avoid cache misses. 

## D) Compaction (future)

If you move toward multi-step agent threads, add a compaction strategy:

* summarize or compact old items when token budget is exceeded
* keep a compact “latent” item if supported (pattern referenced in Codex notes) 

---

# 10) Security and abuse-prevention

## A) Privacy controls

* Sharing requires an explicit “no sensitive info” confirmation in UI.
* DB sanitizes `public_config` via `strip_sensitive_prompt_config`.
* Community content renders as plain text (no HTML injection).

## B) Auth gating

* Anonymous sessions can enhance prompts (if that’s a product requirement).
* Sharing / voting / commenting require non-anonymous authenticated accounts (enforced by UI + RLS).

## C) Rate limiting

* Apply rate limiting in Edge Functions:

  * enhance
  * extract-url
* Optional: add DB-level throttle for comments/votes (future)

## D) Visibility control and safety “unpublish”

* Unsharing sets `community_posts.is_public=false`
* Hidden posts are removed from feed queries
* Comments/votes become invisible when post is not public

---

# 11) Testing plan

## A) DB / RLS

* RLS tests for:

  * comments visibility tied to `community_posts.is_public`
  * votes visibility restricted to vote owner
  * saved prompts owner-only
  * share/unshare propagation correctness

## B) Frontend unit tests

* Remix query param loads config and sets remix state
* Saving clears remix state
* Vote toggles optimistically and reverts on error
* Feed pagination resets on sort/category/search change

## C) Integration tests (happy paths)

* Save prompt → appears in library
* Share → appears in community feed
* Remix → share remix → parent remix_count increments
* Unshare → post disappears from feed; comments hidden

---

# 12) Migration and rollout plan

## Migration strategy

* If `templates` is legacy, either:

  1. **Migrate templates → saved_prompts** and keep a compatibility view/table for a release, then remove later, or
  2. Keep templates as legacy forever and only use saved_prompts for new flows

## Rollout

* Feature flag “Community”

  * enable feed read-only first
  * then enable sharing
  * then enable votes/comments
* Monitor abuse vectors (spam, mass comments)
* Add moderation gate (Edge Function) only if needed

---

# 13) Deliverables checklist

## Database

* `saved_prompts`, `community_posts`, `community_votes`, `community_comments`
* Functions: `strip_sensitive_prompt_config`, `is_non_anonymous_account`, `refresh_community_post_metrics`
* Triggers: share/unshare sync, counters, updated_at
* RLS policies as specified

## Backend

* `enhance-prompt` edge function (streaming proxy + rate limit)
* agent service `/enhance` (streaming; event protocol upgrade path)

## Frontend

* Builder:

  * Save Prompt dialog
  * Save & Share dialog
  * Remix banner + stop remix
* Library:

  * My Prompts listing
  * Share/unshare actions
  * Open shared post
* Community:

  * Feed with sort/filter/search/pagination
  * Post card with prompt preview + actions
  * Post detail with remixes + comments
  * Votes + verified toggles
  * Copy + remix actions

## Codex integration (planned phase)

* Event envelope spec + client parser
* Optional event persistence for reconnection

---
