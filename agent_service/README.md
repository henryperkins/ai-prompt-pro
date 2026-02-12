# Agent Service

Prompt enhancement backend powered by `@openai/codex-sdk`.

The frontend calls `supabase/functions/enhance-prompt` which proxies to this service's `POST /enhance` endpoint.

## Quick start

```bash
npm install
export OPENAI_API_KEY="<your-openai-api-key>"
npm run agent:codex
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check (returns model and sandbox mode) |
| `POST` | `/enhance` | Stream-enhanced prompt via SSE |

### `POST /enhance` body

```jsonc
{
  "prompt": "Your draft prompt text",       // required
  "thread_id": "thread_abc123",             // optional: resume a previous thread
  "thread_options": {                       // optional
    "modelReasoningEffort": "medium"        // minimal|low|medium|high|xhigh
  }
}
```

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` or `CODEX_API_KEY` | OpenAI API key |

### Service configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8001` | Listen port |
| `AGENT_SERVICE_TOKEN` | _(none)_ | Shared secret for `x-agent-token` header auth |
| `MAX_PROMPT_CHARS` | `16000` | Maximum prompt character length |

### Codex client options

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_BASE_URL` / `CODEX_BASE_URL` | _(none)_ | OpenAI-compatible API base URL |
| `CODEX_PATH_OVERRIDE` | _(none)_ | Absolute path to Codex CLI binary |
| `CODEX_CONFIG_JSON` | _(none)_ | JSON object of CLI `--config` overrides |
| `CODEX_ENV_JSON` | _(none)_ | JSON object of env vars for the CLI process |
| `CODEX_MAX_OUTPUT_TOKENS` | _(none)_ | Max output tokens (passed via CLI config) |

### Default thread options

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEX_MODEL` | `gpt-5.2` | Model name (e.g., `gpt-5.2`, `gpt-5.2-codex`) |
| `CODEX_SANDBOX_MODE` | _(none)_ | `read-only` \| `workspace-write` \| `danger-full-access` |
| `CODEX_WORKING_DIRECTORY` | _(none)_ | Working directory for the Codex agent |
| `CODEX_SKIP_GIT_REPO_CHECK` | `false` | Skip git repo validation |
| `CODEX_MODEL_REASONING_EFFORT` | `high` | `minimal` \| `low` \| `medium` \| `high` \| `xhigh` |
| `CODEX_MODEL_REASONING_SUMMARY` | `detailed` | `auto` \| `concise` \| `detailed` |
| `CODEX_NETWORK_ACCESS_ENABLED` | `false` | Enable network access |
| `CODEX_WEB_SEARCH_MODE` | _(none)_ | `disabled` \| `cached` \| `live` |
| `CODEX_WEB_SEARCH_ENABLED` | `false` | Enable web search |
| `CODEX_APPROVAL_POLICY` | _(none)_ | `never` \| `on-request` \| `on-failure` \| `untrusted` |
| `CODEX_ADDITIONAL_DIRECTORIES` | _(none)_ | JSON array or comma-delimited paths |

### Rate-limit retry

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEX_429_MAX_RETRIES` | `2` | Max retry attempts on 429 errors |
| `CODEX_429_BACKOFF_BASE_SECONDS` | `1.0` | Base delay for exponential backoff |
| `CODEX_429_BACKOFF_MAX_SECONDS` | `20.0` | Maximum backoff delay |

## Features

- **Prompt structure analysis**: Pre-flight inspection checks for Role/Task/Context/Format/Constraints sections and includes findings in the prompt input so the enhancer can address gaps.
- **429 retry with backoff**: Automatic retry on rate-limit errors with exponential backoff and jitter. Only retries if no chunks have been emitted yet.
- **Thread resumption**: Pass `thread_id` to continue a previous conversation.
- **SSE streaming**: Compatible with the frontend's `streamEnhance()` parser (supports both `/` and `.` event separators).
- **Client disconnect detection**: Aborts the Codex process when the client disconnects.
