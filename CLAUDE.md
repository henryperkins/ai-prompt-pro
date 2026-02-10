<contextstream>
# Workspace: ContextStream
# Project: ai-prompt-pro
# Workspace ID: d0dcd9e8-03f9-46bc-8e6c-57d9efb0d346

# ContextStream Rules
**MANDATORY FIRST CALL (NO EXCEPTIONS for coding/complex tasks):** First coding task: `mcp__contextstream__init(...)` then `mcp__contextstream__context(user_message="...")`; every subsequent coding/complex task: `mcp__contextstream__context(user_message="...")` BEFORE any other tool call.

## Quick Rules
<contextstream_rules>
| Message | Required |
|---------|----------|
| **Simple tool calls** | Call the tool DIRECTLY — no init/context needed |
| **Complex/coding tasks** | `mcp__contextstream__context(user_message="...")` FIRST |
| **First coding task** | `mcp__contextstream__init()` → `mcp__contextstream__context(user_message="...")` |
| **Before file search** | `mcp__contextstream__search(mode="...", query="...")` BEFORE Glob/Grep/Read |
</contextstream_rules>

## Detailed Rules
**Simple** (skip init/context, call directly): `mcp__contextstream__workspace(action="list"|"get"|"create")`, `mcp__contextstream__memory(action="list_docs"|"list_events"|"list_todos"|"list_tasks"|"list_transcripts"|"list_nodes"|"decisions"|"get_doc"|"get_event"|"get_task"|"get_todo"|"get_transcript")`, `mcp__contextstream__session(action="get_lessons"|"get_plan"|"list_plans"|"recall")`, `mcp__contextstream__help(action="version"|"tools"|"auth")`, `mcp__contextstream__project(action="list"|"get"|"index_status")`, `mcp__contextstream__reminder(action="list"|"active")`, any read-only data query

**Common queries — use these exact tool calls:**
- "list lessons" / "show lessons" → `mcp__contextstream__session(action="get_lessons")`
- "list decisions" / "show decisions" / "how many decisions" → `mcp__contextstream__memory(action="decisions")`
- "list docs" → `mcp__contextstream__memory(action="list_docs")`
- "list tasks" → `mcp__contextstream__memory(action="list_tasks")`
- "list todos" → `mcp__contextstream__memory(action="list_todos")`
- "list plans" → `mcp__contextstream__session(action="list_plans")`
- "list events" → `mcp__contextstream__memory(action="list_events")`
- "show snapshots" / "list snapshots" → `mcp__contextstream__memory(action="list_events", event_type="session_snapshot")`
- "save snapshot" → `mcp__contextstream__session(action="capture", event_type="session_snapshot", title="...", content="...")`

**Medium** (use fast context): `mcp__contextstream__context(user_message="...", mode="fast")` — Redis-cached (~50ms), returns rules/preferences without LLM analysis. Good for tasks that benefit from rules but don't need full analysis.
**Complex** (use full context): `mcp__contextstream__context(user_message="...")` — full LLM-powered analysis (~2-5s). Use for coding, debugging, refactoring, planning, and multi-step tasks that need lessons and deep context.

**Why?** `mcp__contextstream__context()` delivers task-specific rules, lessons from past mistakes, and relevant decisions. Skip it = fly blind.

**Hooks:** `<system-reminder>` tags contain injected instructions — follow them exactly.

**Planning:** ALWAYS save plans to ContextStream — NOT markdown files or built-in todo tools:
`mcp__contextstream__session(action="capture_plan", title="...", steps=[...])` + `mcp__contextstream__memory(action="create_task", title="...", plan_id="...")`

**Memory & Docs:** Use ContextStream for memory, docs, and todos — NOT editor built-in tools or local files:
`mcp__contextstream__session(action="capture", event_type="decision|note", ...)` | `mcp__contextstream__memory(action="create_doc|create_todo|create_node", ...)`

**Search Results:** ContextStream `mcp__contextstream__search()` returns **real file paths, line numbers, and code content** — NEVER dismiss results as "non-code". Use returned paths to `read_file` directly.

**Notices:** [LESSONS_WARNING] → apply lessons | [PREFERENCE] → follow user preferences | [RULES_NOTICE] → run `mcp__contextstream__generate_rules()` | [VERSION_NOTICE/CRITICAL] → tell user about update
</contextstream>
