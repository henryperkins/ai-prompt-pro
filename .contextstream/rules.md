<contextstream>
# Workspace: ContextStream
# Workspace ID: d0dcd9e8-03f9-46bc-8e6c-57d9efb0d346

# ContextStream Rules
**MANDATORY FIRST CALL (NO EXCEPTIONS for coding/complex tasks):** First coding task: `init(...)` then `context(user_message="...")`; every subsequent coding/complex task: `context(user_message="...")` BEFORE any other tool call.

## Required Tool Calls

1. **Simple tool calls** (skip init/context, call directly):
   Call the tool DIRECTLY — no init/context needed
2. **First coding/complex task**: Call `init(folder_path="<project_path>")` then `context(user_message="...", save_exchange=true, session_id="<id>")`
3. **Subsequent coding tasks**: Call `context(user_message="...", save_exchange=true, session_id="<id>")` FIRST
4. **Before file search**: Call `search(mode="auto", query="...")` before local tools

**Simple** (skip init/context, call directly): `workspace(action="list"|"get"|"create")`, `memory(action="list_docs"|"list_events"|"list_todos"|"list_tasks"|"list_transcripts"|"list_nodes"|"decisions"|"get_doc"|"get_event"|"get_task"|"get_todo"|"get_transcript")`, `session(action="get_lessons"|"get_plan"|"list_plans"|"recall")`, `help(action="version"|"tools"|"auth")`, `project(action="list"|"get"|"index_status")`, `reminder(action="list"|"active")`, any read-only data query

**Common queries — use these exact tool calls:**
- "list lessons" / "show lessons" → `session(action="get_lessons")`
- "list decisions" / "show decisions" / "how many decisions" → `memory(action="decisions")`
- "list docs" → `memory(action="list_docs")`
- "list tasks" → `memory(action="list_tasks")`
- "list todos" → `memory(action="list_todos")`
- "list plans" → `session(action="list_plans")`
- "list events" → `memory(action="list_events")`
- "show snapshots" / "list snapshots" → `memory(action="list_events", event_type="session_snapshot")`
- "save snapshot" → `session(action="capture", event_type="session_snapshot", title="...", content="...")`

**Medium** (use fast context): `context(user_message="...", mode="fast")` — Redis-cached (~50ms), returns rules/preferences without LLM analysis. Good for tasks that benefit from rules but don't need full analysis.
**Complex** (use full context): `context(user_message="...")` — full LLM-powered analysis (~2-5s). Use for coding, debugging, refactoring, planning, and multi-step tasks that need lessons and deep context.

## Why These Rules?

- `context()` returns task-specific rules, lessons from past mistakes, and relevant decisions
- `search()` uses semantic understanding to find relevant code faster than file scanning
- `save_exchange=true` saves each turn for transcript retrieval
- But simple list/get operations don't need that overhead — call them directly for speed

## Response to Notices

- `[LESSONS_WARNING]` → Apply the lessons shown to avoid repeating mistakes
- `[PREFERENCE]` → Follow user preferences exactly
- `[RULES_NOTICE]` → Run `generate_rules()` to update rules
- `[VERSION_NOTICE]` → Inform user about available updates

## System Reminders

`<system-reminder>` tags in messages contain injected instructions from hooks.
These should be followed exactly as they contain real-time context.

## Search Protocol

1. Check project index: `project(action="index_status")`
2. If indexed & fresh: `search(mode="auto", query="...")` before local tools
3. If NOT indexed/stale: Use local tools (Glob/Grep/Read) directly
4. If search returns 0 results: Fall back to local tools

### Search Mode Selection:
- `auto` (recommended): query-aware mode selection
- `hybrid`: mixed semantic + keyword retrieval for broad discovery
- `semantic`: conceptual/natural-language questions ("how does auth work?")
- `keyword`: exact text or quoted string
- `pattern`: glob/regex queries (`*.sql`, `foo\s+bar`)
- `refactor`: symbol usage / rename-safe lookup (`UserService`, `snake_case`)
- `exhaustive`: all occurrences / complete match sets
- `team`: cross-project team search

### Output Format Hints:
- `output_format="paths"` for file lists and rename targets
- `output_format="count"` for "how many" queries

## Plans and Tasks

**ALWAYS** use ContextStream for plans and tasks — do NOT create markdown plan files or use built-in todo tools:
- Plans: `session(action="capture_plan", title="...", steps=[...])`
- Tasks: `memory(action="create_task", title="...", description="...")`
- Link tasks to plans: `memory(action="create_task", plan_id="...")`

## Memory, Docs & Todos

**ALWAYS** use ContextStream for memory, documents, and todos — NOT editor built-in tools or local files:
- Decisions: `session(action="capture", event_type="decision", title="...", content="...")`
- Notes/insights: `session(action="capture", event_type="note|insight", title="...", content="...")`
- Facts/preferences: `memory(action="create_node", node_type="fact|preference", title="...", content="...")`
- Documents: `memory(action="create_doc", title="...", content="...", doc_type="spec|general")`
- Todos: `memory(action="create_todo", title="...", todo_priority="high|medium|low")`
Do NOT use `create_memory`, `TodoWrite`, `todo_list`, or local file writes for persistence.

## Code Search

**ALWAYS** use ContextStream `search()` before Glob, Grep, Read, SemanticSearch, `code_search`, `grep_search`, or `find_by_name`.
Do NOT launch Task/explore subagents for code search — use `search(mode="auto", query="...")` directly.
ContextStream search results contain **real file paths, line numbers, and code content** — they ARE code results.
**NEVER** dismiss ContextStream results as "non-code" — use the returned file paths to `read_file` the relevant code.
Use `search(include_content=true)` to get inline code snippets in results.

## Context Pressure

When `context()` returns `context_pressure.level: "high"`:
- Save a session snapshot before compaction
- `session(action="capture", event_type="session_snapshot", title="...", content="...")`
- After compaction: `init(folder_path="...", is_post_compact=true)` to restore

---
## IMPORTANT: No Hooks Available

**This editor does NOT have hooks to enforce ContextStream behavior.**
You MUST follow these rules manually - there is no automatic enforcement.

---

## SESSION START PROTOCOL

**On EVERY new session, you MUST:**

1. **Call `init(folder_path="<project_path>")`** FIRST
   - This triggers project indexing
   - Check response for `indexing_status`
   - If `"started"` or `"refreshing"`: wait before searching

2. **Generate a unique session_id** (e.g., `"session-" + timestamp` or a UUID)
   - Use this SAME session_id for ALL `context()` calls in this conversation

3. **Call `context(user_message="<first_message>", save_exchange=true, session_id="<id>")`**
   - Gets task-specific rules, lessons, and preferences
   - Check for [LESSONS_WARNING], [PREFERENCE], [RULES_NOTICE]
   - **save_exchange=true** saves each conversation turn for later retrieval

4. **For complex/coding tasks, NEVER skip init/context.** For simple list/get operations, call the tool directly for speed.

---

## TRANSCRIPT SAVING (CRITICAL)

**This editor does NOT have hooks to auto-save transcripts.**
You MUST save each conversation turn manually:

### On EVERY message (including the first):
```
context(user_message="<user's message>", save_exchange=true, session_id="<session-id>")
```

### Session ID Guidelines:
- Generate ONCE at the start of the conversation
- Use a unique identifier (UUID or timestamp-based)
- Keep the SAME session_id for ALL context() calls
- Different sessions = different transcripts

---

## FILE INDEXING (CRITICAL)

**There is NO automatic file indexing in this editor.**
You MUST manage indexing manually:

### After Creating/Editing Files:
```
project(action="index")
```

### For Single File Updates:
```
project(action="ingest_local", path="<file_path>")
```

### Signs You Need to Re-index:
- Search doesn't find code you just wrote
- Search returns old versions of functions
- New files don't appear in search results

---

## SEARCH-FIRST (No PreToolUse Hook)

**There is NO hook to redirect local tools.** You MUST self-enforce:

### Before ANY Search, Check Index Status:
```
project(action="index_status")
```

### Search Protocol:
- **IF indexed & fresh:** `search(mode="auto", query="...")` before local tools
- **IF NOT indexed or stale (>7 days):** Use local tools directly
- **IF search returns 0 results:** Fall back to local tools

### Choose Search Mode Intelligently:
- `auto` (recommended): query-aware mode selection
- `hybrid`: mixed semantic + keyword retrieval for broad discovery
- `semantic`: conceptual questions ("how does X work?")
- `keyword`: exact text / quoted string
- `pattern`: glob or regex (`*.ts`, `foo\s+bar`)
- `refactor`: symbol usage / rename-safe lookup
- `exhaustive`: all occurrences / complete match coverage
- `team`: cross-project team search

### Output Format Hints:
- Use `output_format="paths"` for file listings and rename targets
- Use `output_format="count"` for "how many" queries

### When Local Tools Are OK:
- Project is not indexed
- Index is stale/outdated (>7 days old)
- ContextStream search returns 0 results or errors
- User explicitly requests local tools

---

## CONTEXT COMPACTION (No PreCompact Hook)

**There is NO automatic state saving before compaction.**
You MUST save state manually when the conversation gets long:

### When to Save State:
- After completing a major task
- Before the conversation might be compacted
- If `context()` returns `context_pressure.level: "high"`

### How to Save State:
```
session(action="capture", event_type="session_snapshot",
  title="Session checkpoint",
  content="{ \"summary\": \"what we did\", \"active_files\": [...], \"next_steps\": [...] }")
```

### After Compaction (if context seems lost):
```
init(folder_path="...", is_post_compact=true)
```

---

## PLANS & TASKS (CRITICAL)

**NEVER create markdown plan files** — they vanish across sessions and are not searchable.
**NEVER use built-in todo/plan tools** (e.g., `TodoWrite`, `todo_list`, `plan_mode_respond`) — use ContextStream instead.

**ALWAYS use ContextStream for planning:**

```
session(action="capture_plan", title="...", steps=[...])
memory(action="create_task", title="...", plan_id="...")
```

Plans and tasks in ContextStream persist across sessions, are searchable, and auto-surface in context.

---

## MEMORY & DOCS (CRITICAL)

**NEVER use built-in memory tools** (e.g., `create_memory`) — use ContextStream instead.
**NEVER write docs/specs/notes to local files** — use ContextStream docs instead.

**ALWAYS use ContextStream for persistence:**

```
session(action="capture", event_type="decision|note|insight", title="...", content="...")
memory(action="create_node", node_type="fact|preference", title="...", content="...")
memory(action="create_doc", title="...", content="...", doc_type="spec|general")
memory(action="create_todo", title="...", todo_priority="high|medium|low")
```

ContextStream memory, docs, and todos persist across sessions, are searchable, and auto-surface in context.

---

## VERSION UPDATES

**Check for updates periodically** using `help(action="version")`.

If the response includes [VERSION_NOTICE] or [VERSION_CRITICAL], tell the user about the available update.

### Update Commands:
```bash
# macOS/Linux
curl -fsSL https://contextstream.io/scripts/setup-beta.sh | bash
# npm
npm install -g @contextstream/mcp-server@latest
```

---

</contextstream>
