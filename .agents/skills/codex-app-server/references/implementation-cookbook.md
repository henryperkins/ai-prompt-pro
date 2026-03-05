# Codex App Server Implementation Cookbook

## Table of contents
- Minimal stdio loop
- Handshake sequence
- Thread and turn sequence
- Approval handling sequence
- Auth mode sequence
- Validation checklist

## Minimal stdio loop

```ts
import { spawn } from "node:child_process";
import readline from "node:readline";

const proc = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
const rl = readline.createInterface({ input: proc.stdout });

const send = (m: unknown) => proc.stdin.write(`${JSON.stringify(m)}\n`);

rl.on("line", (line) => {
  const msg = JSON.parse(line);
  // Route by envelope shape: response (id), notification (method without id), or server request (method + id).
  console.log(msg);
});
```

## Handshake sequence

1. Send `initialize` request:

```json
{
  "method": "initialize",
  "id": 1,
  "params": {
    "clientInfo": {
      "name": "my_client",
      "title": "My Client",
      "version": "0.1.0"
    }
  }
}
```

2. Wait for successful response.
3. Send `initialized` notification:

```json
{ "method": "initialized", "params": {} }
```

## Thread and turn sequence

1. Start a thread:

```json
{ "method": "thread/start", "id": 2, "params": { "model": "gpt-5.2-codex" } }
```

2. Read response and store `thread.id`.
3. Start a turn:

```json
{
  "method": "turn/start",
  "id": 3,
  "params": {
    "threadId": "thr_123",
    "input": [{ "type": "text", "text": "Summarize this repository." }]
  }
}
```

4. Stream and apply notifications until terminal `turn/completed`.

Track these notifications as minimum set:
- `turn/started`
- `item/started`
- `item/*/delta` (optional stream updates)
- `item/completed`
- `turn/completed`

## Approval handling sequence

When server sends request `item/commandExecution/requestApproval` (or file-change equivalent):

1. Read request payload (`id`, `threadId`, `turnId`, `itemId`, details).
2. Ask end user for decision.
3. Send response using same `id`.

Example accept:

```json
{ "id": 101, "result": { "decision": "accept" } }
```

Example decline:

```json
{ "id": 101, "result": { "decision": "decline" } }
```

4. Continue consuming stream and finalize using `item/completed`.

## Auth mode sequence

### API key mode

```json
{
  "method": "account/login/start",
  "id": 10,
  "params": { "type": "apiKey", "apiKey": "sk-..." }
}
```

### ChatGPT browser mode

```json
{ "method": "account/login/start", "id": 11, "params": { "type": "chatgpt" } }
```

Open returned `authUrl`, wait for `account/login/completed` and `account/updated`.

### External token mode

```json
{
  "method": "account/login/start",
  "id": 12,
  "params": {
    "type": "chatgptAuthTokens",
    "idToken": "<jwt>",
    "accessToken": "<jwt>"
  }
}
```

Implement server-request handler for `account/chatgptAuthTokens/refresh` and respond with new tokens inside timeout budget.

## Validation checklist

Run these checks in CI or release tests:

1. Reject non-init calls before handshake.
2. Reject second `initialize` on same connection.
3. Verify thread/turn/item flow reaches `turn/completed`.
4. Verify approval request/response loop unblocks turn.
5. Verify websocket overload handling for `-32001` uses retry backoff.
6. Verify auth lifecycle notifications update client state.
