# Codex App Server Protocol Quick Reference

## Table of contents
- Architecture model
- Transport and framing
- Core primitives
- Required initialization contract
- Common method groups
- Event model and item lifecycle
- Approval protocol
- Error and retry guidance

## Architecture model

Treat app-server as the stable boundary around the Codex harness.

- Keep harness details internal; consume only JSON-RPC method/event contracts.
- Model client state around `Thread` -> `Turn` -> `Item`.
- Assume one request can produce many asynchronous notifications.
- Support server-initiated requests (approvals/token refresh), not only notifications.

## Transport and framing

Use one transport per connection:

- `stdio` (default): JSONL, one JSON object per line
- `websocket` (experimental): one JSON object per WS text frame

Use JSON-RPC semantics with omitted `"jsonrpc": "2.0"` wire field.

## Core primitives

- `Thread`: durable conversation/session container
- `Turn`: one user input and resulting agent work
- `Item`: atomic typed unit inside a turn (message, tool call, file change, etc.)

## Required initialization contract

1. Send one `initialize` request per connection.
2. Wait for response.
3. Send `initialized` notification.
4. Send all other methods only after steps 1-3 complete.

Rules:
- Pre-init methods -> `Not initialized` error.
- Repeated `initialize` on same connection -> `Already initialized` error.
- Set `capabilities.experimentalApi: true` only when you need experimental surface.
- Use `clientInfo.name` as stable integration identity (compliance/logging workflows).

## Common method groups

### Session and work

- `thread/start`, `thread/resume`, `thread/fork`
- `thread/read`, `thread/list`, `thread/archive`, `thread/unarchive`
- `turn/start`, `turn/steer`, `turn/interrupt`
- `review/start`

### Runtime and discovery

- `model/list`
- `experimentalFeature/list`
- `skills/list`, `skills/config/write`
- `app/list`
- `mcpServerStatus/list`, `config/mcpServer/reload`
- `config/read`, `config/value/write`, `config/batchWrite`

### Auth and limits

- `account/read`
- `account/login/start`, `account/login/cancel`, `account/logout`
- `account/rateLimits/read`
- Server request: `account/chatgptAuthTokens/refresh`

### One-off command path

- `command/exec` (no thread/turn creation)

## Event model and item lifecycle

Treat `item/*` lifecycle as authoritative state.

- `item/started`: item begins
- optional `item/*/delta`: progressive stream updates
- `item/completed`: terminal state + final payload

Turn-level notifications:
- `turn/started`
- `turn/completed`
- `turn/diff/updated`
- `turn/plan/updated`
- `thread/tokenUsage/updated`

Important guidance:
- Use deltas for display only; reconcile against final `item/completed` payload.
- Expect out-of-order arrival across unrelated item ids; order by per-item sequence in your renderer.

## Approval protocol

App-server may pause turn execution and issue server-initiated requests.

Common approval requests:
- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

Client responsibilities:
- Show approval UI scoped by `threadId` and `turnId`.
- Respond with a valid decision (`accept`, `acceptForSession`, `decline`, `cancel`, and amendment when offered).
- Resume UI flow based on final `item/completed` status (`completed`, `failed`, or `declined`).

## Error and retry guidance

### Retryable patterns

- Websocket overload: JSON-RPC error `code: -32001` with message `Server overloaded; retry later.`
- Transient connection breaks
- External token refresh path after `401` in `chatgptAuthTokens` mode

Use exponential backoff with jitter and max-attempt ceilings.

### Non-retryable patterns

- Contract violations (`Not initialized`, invalid params)
- Unsupported experimental surface without opt-in
- explicit approval decline outcomes

### Useful error categories (when surfaced)

- `ContextWindowExceeded`
- `UsageLimitExceeded`
- `BadRequest`
- `Unauthorized`
- `SandboxError`
- `InternalServerError`
