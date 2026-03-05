# Codex Harness Integration Patterns

## Table of contents
- Mental model
- Why app-server exists
- Process model and boundaries
- Client topology patterns
- Protocol selection guide
- Compatibility and release strategy
- Practical debugging hooks

## Mental model

Treat the Codex harness as:
- agent loop execution
- thread/turn lifecycle and persistence
- tool execution and extension wiring

Treat app-server as the stable API boundary that exposes harness capabilities to product clients.

## Why app-server exists

Use app-server when product UX needs all of these:
- long-lived interactive sessions
- rich streaming progress updates
- granular item-level lifecycle and diffs
- approval prompts for potentially sensitive actions
- thread resume/fork/archive semantics

This is the primary reason app-server is preferred for IDE/desktop/web interactive clients rather than one-shot command interfaces.

## Process model and boundaries

Use this architecture framing in client design docs:

1. Client transport layer (`stdio` JSONL or websocket).
2. Message processor layer (JSON-RPC routing and schema validation).
3. Thread manager abstraction (one logical core session per thread id).
4. Renderer/state layer consuming stable thread/turn/item events.

Design principle:
- One request may fan out into many notifications.
- Server is authoritative for long-running task state.
- Client should reconcile against terminal item/turn events, not only deltas.

## Client topology patterns

### Local IDE/desktop app

- Launch app-server as child process.
- Keep bidirectional channel open for full session duration.
- Persist local thread metadata and reconnect to server-managed thread history.

### Web/container orchestration

- Run app-server inside workspace container near compute.
- Keep persistent worker-to-app-server channel.
- Stream user-facing updates via backend channel (for example SSE/WebSocket).
- Assume browser sessions are ephemeral; keep task state on server side.

### CLI/TUI as client

- Prefer the same app-server protocol boundary used by GUI clients.
- Avoid direct coupling to internal runtime structs when possible.

## Protocol selection guide

Use this quick decision matrix:

- Choose **Codex app-server** when you need full interactive harness semantics (streaming items, approvals, diffs, thread lifecycle).
- Choose **Codex SDK** when you need programmatic agent control without implementing a separate JSON-RPC client.
- Choose **Codex MCP server** when existing MCP orchestration is primary and reduced Codex-specific semantics are acceptable.
- Choose **non-interactive CLI mode** for one-off/CI tasks with simple request-result flow.

## Compatibility and release strategy

Use these safeguards for production clients:

- Pin and test a known app-server version for release-critical clients.
- Validate forward compatibility path against newer app-server binaries.
- Regenerate TypeScript or JSON Schema artifacts when upgrading server versions.
- Keep unsupported or experimental method usage behind explicit feature gates.

## Practical debugging hooks

Use these commands during integration debugging:

```bash
codex app-server generate-ts --out ./schemas
codex app-server generate-json-schema --out ./schemas
codex debug app-server send-message-v2 "run tests and summarize failures"
```

Use captured JSON traces from the debug command to validate client event ordering and state reconciliation logic.
