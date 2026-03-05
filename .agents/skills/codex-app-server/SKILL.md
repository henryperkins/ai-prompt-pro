---
name: codex-app-server
description: Build or debug Codex app-server integrations that embed Codex in a product UI with JSON-RPC over stdio/WebSocket, including initialization, thread and turn lifecycle, streaming item events, approval flows, auth/account handling, model discovery, and config/mcp/app plumbing. Use when implementing a custom Codex client, fixing protocol handling bugs, or mapping product UX to app-server methods/events.
---

# Codex App Server

Implement Codex app-server clients as strict JSON-RPC systems with explicit lifecycle handling, state machines, and approval routing. Keep transport handling minimal and push protocol complexity into typed request/notification handlers.

## Workflow

Use this sequence for new integrations and for protocol bug triage:

1. Establish transport and framing.
2. Complete handshake (`initialize` then `initialized`).
3. Build thread lifecycle (`thread/start`, `thread/resume`, optional `thread/fork`).
4. Build turn lifecycle (`turn/start`, stream notifications, `turn/completed`).
5. Add approval handling for command/file/tool requests.
6. Add account/auth flows and model capability discovery.
7. Add retries/backoff and failure classification.
8. Validate with end-to-end traces.

## Implement

### 1) Establish transport

Use one of:
- `stdio` with newline-delimited JSON messages
- `websocket` with one JSON message per text frame

Keep a single message parser that supports request, response, and notification envelopes.

For websocket mode overload handling, treat JSON-RPC error `code: -32001` as retryable and apply exponential backoff with jitter.

### 2) Perform handshake

Send exactly one `initialize` request per connection, then send `initialized` notification.

Fail fast if any non-initialize request is attempted before successful initialization.

If you need experimental methods/fields, set `capabilities.experimentalApi: true` during `initialize`.

### 3) Manage threads

Support at least:
- `thread/start`
- `thread/resume`
- `thread/read`
- `thread/list`

Treat returned `thread.id` as the canonical key for state tracking and event routing.

Use `thread/read` for inspection without resuming/subscribing.

### 4) Manage turns and stream items

Start work with `turn/start` and always consume notifications until `turn/completed`.

Treat `item/started` and `item/completed` as source of truth for item lifecycle. Use delta events only for progressive rendering.

Render at least these item families in UI/logging:
- agent messages (`item/agentMessage/delta` + completion)
- command execution
- file changes
- mcp tool calls
- plan and reasoning

### 5) Handle approvals

Implement server-initiated request handlers for:
- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

Respond with supported decisions (`accept`, `acceptForSession`, `decline`, `cancel`, and command amendment variant when provided).

Scope approval UI by `threadId` + `turnId` from the approval request payload.

### 6) Handle auth and account state

Support:
- `account/read`
- `account/login/start`
- `account/logout`
- `account/rateLimits/read`

Implement external token refresh response path for server request `account/chatgptAuthTokens/refresh` when using externally managed ChatGPT tokens.

### 7) Add resilience and observability

Classify failures by transport, JSON-RPC envelope, protocol contract, upstream auth/rate-limit, and tool/sandbox errors.

Persist trace logs of outbound requests and inbound notifications with monotonic timestamps and correlation by `id`, `threadId`, and `turnId`.

Use notification opt-out only after confirming that suppressed methods are not required for your UI/state reconciliation.

## Validate

Run the following checks before shipping:

1. Run handshake test: request before init must fail; second `initialize` must fail.
2. Run lifecycle test: `thread/start` -> `turn/start` -> streamed items -> `turn/completed`.
3. Run approval test: trigger command/file approval and verify accept/decline behavior.
4. Run auth test for your chosen mode (`apiKey`, `chatgpt`, or `chatgptAuthTokens`).
5. Run overload retry test in websocket mode (`-32001`).

## References

Load only the section needed:
- `references/protocol-quick-reference.md`: method index, event model, item taxonomy, common errors.
- `references/implementation-cookbook.md`: copy-ready JSON-RPC sequences for handshake, thread/turn flows, approval flows, and auth flows.
- `references/harness-integration-patterns.md`: harness architecture, client deployment topologies, and protocol selection guidance (app-server vs SDK vs MCP).
