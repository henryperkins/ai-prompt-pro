# Sandbox Filesystem Approach: Autonomous Repo Exploration

**Date:** 2026-03-16  
**Status:** Proposed  
**Depends on:** [`github-integration-implementation-plan.md`](github-integration-implementation-plan.md) Phase 1 (GitHub App connection flow)

## 1. Concept

Instead of pre-selecting files and injecting static text, clone the connected repo into a temporary sandbox directory and let the Codex agent browse it using its built-in file-reading and command-execution capabilities. The agent autonomously decides which files are relevant to the enhancement task.

## 2. Current Deployment Constraints

The agent service runs on **Azure Web App** (Linux, Node 24-lts):

- Startup: `node agent_service/codex_service.mjs`
- Config: `CODEX_SKIP_GIT_REPO_CHECK=true` (already set in production)
- Filesystem: Azure Web App provides `/home` (persistent, shared across instances) and `/tmp` (ephemeral, instance-local, ~1-12 GB depending on plan)
- The Codex SDK spawns a CLI subprocess (`codex exec`) that runs in a sandbox

Key SDK capabilities from `@openai/codex-sdk`:

- `ThreadOptions.workingDirectory` — sets the sandbox working directory
- `ThreadOptions.sandboxMode` — `"read-only"` prevents file writes
- `ThreadOptions.additionalDirectories` — additional paths the agent can access
- `ThreadOptions.skipGitRepoCheck` — skip git repo validation (already true globally)
- The agent can execute commands (`CommandExecutionItem`) and read files (`FileChangeItem`)

## 3. Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant AgentService as Agent Service
    participant GitHub as GitHub API
    participant Sandbox as /tmp sandbox
    participant Codex as Codex CLI Agent

    User->>Frontend: Press Enhance with repo connected
    Frontend->>AgentService: POST /enhance with repo_context
    AgentService->>GitHub: Clone/sparse-checkout repo
    GitHub-->>Sandbox: Repo files written to /tmp/gh-ctx-xxx
    AgentService->>Codex: startThread with workingDirectory=/tmp/gh-ctx-xxx, sandboxMode=read-only
    Codex->>Sandbox: cat, grep, find, ls as needed
    Sandbox-->>Codex: File contents
    Codex-->>AgentService: Enhanced prompt with repo-aware context
    AgentService->>Sandbox: rm -rf /tmp/gh-ctx-xxx
    AgentService-->>Frontend: Stream enhanced prompt
```

### 3.1 Pre-enhancement: Repo checkout

When the enhance request includes a connected repo, before starting the Codex thread:

1. **Create temp directory:** `/tmp/gh-ctx-<requestId>/`
2. **Sparse checkout the repo** using the GitHub App installation token:
   - Use `git clone --filter=blob:none --sparse --depth=1` for minimal initial download
   - Apply sparse-checkout patterns to include only text-like files under a size cap
   - Or use the Git Trees API + Git Blobs API to write files directly (avoids needing `git` on the host)
3. **Apply safety filters:**
   - Skip binaries, `node_modules/`, `vendor/`, `dist/`, `build/`, lockfiles
   - Cap total checkout size (e.g., 50 MB)
   - Cap file count (e.g., 5,000 files)
4. **Write a `.codex-context` manifest** at the repo root listing key structural files (README, package.json, main entry points)

### 3.2 Enhancement thread configuration

Override thread options for repo-aware enhancement:

```javascript
const repoThreadOptions = {
  ...baseThreadOptions,
  workingDirectory: tempRepoPath,
  sandboxMode: "read-only",
  skipGitRepoCheck: true,
  // Keep existing model and reasoning effort
};
```

The enhancement meta-prompt would be augmented with:

```
## CONNECTED REPOSITORY CONTEXT
A local checkout of the repository {owner}/{repo} (branch: {default_branch}) is available
in your working directory. You may read files, search for patterns, and explore the
codebase structure to gather context that improves the enhanced prompt.

Focus on files directly relevant to the user's prompt. Do not exhaustively read
every file — select the most relevant code, configuration, and documentation.
```

### 3.3 Post-enhancement: Cleanup

After the turn completes (success or failure):

```javascript
finally {
  await fs.rm(tempRepoPath, { recursive: true, force: true });
}
```

### 3.4 Fallback behavior

If repo checkout fails (API rate limit, network issue, repo too large):
- Log the error
- Fall back to the v1 static-injection path using pre-attached source summaries
- Emit a workflow step indicating the fallback

## 4. Checkout Strategies

### Strategy A: Git sparse clone (requires git on host)

```bash
git clone --filter=blob:none --sparse --depth=1 \
  https://x-access-token:${INSTALLATION_TOKEN}@github.com/${owner}/${repo}.git \
  /tmp/gh-ctx-xxx

cd /tmp/gh-ctx-xxx
git sparse-checkout set --no-cone '!node_modules' '!vendor' '!dist' '!build' '!*.lock'
```

**Pros:** Standard git workflow, handles .gitignore, efficient blob fetching
**Cons:** Requires `git` binary on Azure Web App (available on Linux plans), clone latency varies (2-15s for typical repos)

### Strategy B: API-based file tree materialization (no git needed)

1. Fetch recursive tree via Git Trees API (already built in v1's `github-manifest.mjs`)
2. Filter entries using the same manifest filter rules
3. Fetch file content via Git Blobs API for text files under the size cap
4. Write files to `/tmp/gh-ctx-xxx/` preserving directory structure

**Pros:** No `git` dependency, exact control over what gets downloaded, reuses v1 manifest code
**Cons:** Many individual API calls for large repos (though blobs can be fetched in parallel), higher GitHub API quota consumption

### Strategy C: Hybrid — tree API for manifest, sparse clone for content

1. Use Git Trees API to build the manifest (same as v1)
2. Determine relevant paths based on the user's prompt (use the existing source expansion preflight to pick initial paths)
3. Sparse-checkout only those paths plus structural files (README, package.json, etc.)

**Pros:** Minimal API calls, minimal disk usage, fast
**Cons:** The agent can only explore the sparse-checked-out subset; if it wants a file not in the initial set, it can't find it

### Recommended: Strategy A with safety caps

Git sparse clone is the most practical for Azure Web App:
- `git` is pre-installed on Azure Linux App Service instances
- Sparse clone with `--filter=blob:none` downloads only tree metadata initially
- File content is fetched on demand by git when the agent reads files
- This means the agent's file reads are **lazy** — only files the agent actually opens get downloaded from GitHub

## 5. Safety and Resource Management

### Filesystem isolation

- Each request gets its own `/tmp/gh-ctx-<requestId>/` directory
- `sandboxMode: "read-only"` prevents the agent from writing to the repo
- The Codex CLI sandbox provides process-level isolation

### Size caps

| Limit | Value | Enforcement |
|---|---|---|
| Max repo size for checkout | 100 MB | Check repo size via GitHub API before clone |
| Max file count | 10,000 | Stop sparse-checkout expansion at limit |
| Max single file size for agent access | 500 KB | Enforced by sparse-checkout patterns |
| Max checkout duration | 30s | Abort clone with timeout |
| Max total enhancement duration | 120s | Existing `ENHANCE_WS_MAX_LIFETIME_MS` |

### Concurrency

- Limit concurrent repo checkouts per instance (e.g., 3) to prevent disk exhaustion
- Use a semaphore/queue in the agent service
- When the checkout queue is full, fall back to v1 static injection

### Disk cleanup

- `finally` block removes the temp directory after every request
- Periodic sweep of `/tmp/gh-ctx-*` directories older than 5 minutes (catches orphaned checkouts from crashes)
- Monitor `/tmp` usage via Azure App Service diagnostics

### Token security

- Installation tokens are passed to `git clone` via HTTPS URL and exist only in the process environment
- The temp directory is readable only by the app process (0700 permissions)
- Tokens expire in 1 hour; clones complete in seconds

## 6. Enhancement Pipeline Changes

### Modified flow

The current enhancement flow at `resolveEnhancementInputWithSourceExpansion()` stays for non-repo requests. For repo-connected requests, a parallel path:

1. **Repo checkout** — happens in parallel with enhancement context detection
2. **Thread options override** — `workingDirectory` and `sandboxMode` are set
3. **Augmented meta-prompt** — the system prompt tells the agent about the available repo
4. **No separate source expansion preflight** — the agent explores on its own
5. **Same output schema** — `ENHANCEMENT_OUTPUT_SCHEMA` is unchanged; the enhanced prompt comes back the same way

### Source summaries still included

Even with sandbox access, the initially attached sources (from v1) are still included as summaries in the prompt. This gives the agent a starting point — "the user specifically selected these files" — before it explores further.

### Workflow events

New workflow steps emitted during repo-aware enhancement:

- `repo_checkout` — status: loading/completed/failed, detail: repo name + branch
- `repo_exploration` — status: in_progress/completed, detail: files examined count
- Existing `source_context` step still fires for pre-attached summaries

## 7. Frontend Changes

### Minimal UI additions

- Show a "Repo context: {owner}/{repo}" indicator in the enhancement workflow trace
- Show exploration progress: "Examining 12 files from {repo}..."
- Show fallback notice if checkout failed

### No change to source picker

The v1 manual file picker remains available. Users can still pre-select specific files for deterministic behavior. The sandbox exploration is an **additional** capability, not a replacement.

### New enhance request field

```typescript
interface EnhanceRequest {
  // ... existing fields
  repo_context?: {
    connection_id: string;
    mode: "sandbox" | "attached-only";  // user can choose
  };
}
```

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Clone latency adds 5-15s to enhancement | User-visible delay | Show checkout progress in workflow events; offer attached-only mode as faster alternative |
| Large repos exhaust /tmp disk | Service degradation | Hard size caps, concurrency limits, periodic cleanup |
| Agent reads too many files, runs long | Token cost, timeout | Enhancement timeout already exists; token budget monitoring per request |
| Git not available on host | Feature broken | Verify during deployment; fall back to Strategy B |
| GitHub rate limits during clone | Clone fails | Fall back to v1 static injection; use existing installation token quota tracking |
| Multi-instance Azure scaling | Orphaned temp dirs | Each instance cleans its own /tmp; periodic sweep |
| User's private code in /tmp | Data exposure | Per-request isolation, immediate cleanup, 0700 permissions, no persistent storage |

## 9. Phasing

### Phase 1 (v1): Static injection as planned

Ship the current implementation plan as-is. This provides the GitHub App connection, manifest cache, manual file picker, and budget-safe static context injection.

### Phase 2 (v1.5): Sandbox exploration

After v1 is stable:

1. Add repo checkout infrastructure to the agent service
2. Add `workingDirectory` and `sandboxMode` support to the enhancement thread path
3. Augment the enhancement meta-prompt with repo context instructions
4. Add workflow events for checkout/exploration progress
5. Add the `repo_context.mode` field to the enhance request
6. Default to `"attached-only"` (v1 behavior); let users opt in to `"sandbox"`

### Phase 3 (v2): Default sandbox with smart pre-selection

- Make sandbox the default mode when a repo is connected
- Use the preflight LLM to suggest initial files before exploration begins
- Track which files the agent actually reads and surface them in the UI
- Consider caching popular repo checkouts across requests (shared read-only mount)

## 10. Azure Web App Feasibility

The approach is viable on Azure App Service (Linux):

- **git is pre-installed** on Linux App Service (`/usr/bin/git`)
- **/tmp is instance-local ephemeral storage** (not shared across scale-out instances), sized 1-12 GB depending on plan
- **The Codex CLI subprocess** can access `/tmp` since it inherits the process environment
- **`CODEX_SKIP_GIT_REPO_CHECK=true`** is already set, so the Codex CLI won't reject non-git working directories or complain about shallow clones
- **Node.js `child_process.execFile`** can run `git clone` with proper timeout and signal handling

The main constraint is `/tmp` size on smaller App Service plans. For the Basic (B1) plan, `/tmp` is ~1 GB. With a 100 MB per-repo cap and 3 concurrent checkouts, worst case is 300 MB — well within limits.
