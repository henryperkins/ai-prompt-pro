# Agent Service

Prompt enhancement backend powered by `@openai/codex-sdk`.

The frontend calls this service directly for AI endpoints.

## Quick start

```bash
npm install
export AZURE_OPENAI_API_KEY="<your-azure-openai-api-key>"
export CODEX_CONFIG_JSON='{"model":"<your-azure-deployment-name>","model_provider":"azure","model_providers":{"azure":{"name":"Azure OpenAI","base_url":"https://fifteenmodels.openai.azure.com/openai/v1","env_key":"AZURE_OPENAI_API_KEY","wire_api":"responses"}}}'
npm run agent:codex
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check (returns model and sandbox mode) |
| `POST` | `/enhance` | Stream-enhanced prompt via SSE |
| `WS` | `/enhance/ws` | Stream-enhanced prompt via WebSocket |
| `POST` | `/extract-url` | Fetch URL content and return extracted bullet points |
| `POST` | `/infer-builder-fields` | Heuristic builder-field suggestions |

### `POST /enhance` body

```jsonc
{
  "prompt": "Your draft prompt text",       // required
  "thread_id": "thread_abc123",             // optional: resume a previous thread
  "builder_mode": "guided",                 // optional: quick|guided|advanced
  "builder_fields": {                       // optional but recommended: pass all 6 keys, even empty
    "role": "",
    "context": "",
    "task": "",
    "output_format": "",
    "examples": "",
    "guardrails": ""
  },
  "thread_options": {                       // optional
    "modelReasoningEffort": "medium"        // minimal|low|medium|high|xhigh
  }
}
```

### `WS /enhance/ws`

- Subprotocols:
  - `promptforge.enhance.v1` (required)
- First client message: send an `enhance.start` envelope with auth and payload:

```jsonc
{
  "type": "enhance.start",
  "auth": {
    "bearer_token": "<jwt>",   // required unless using apikey/service token fallback
    "apikey": "<key>"          // optional
  },
  "payload": {
    "prompt": "Your draft prompt text"
  }
}
```

- Legacy auth subprotocols (`auth.bearer.*`, `auth.apikey.*`, `auth.service.*`) are still accepted for compatibility, but message auth is recommended to reduce token exposure in edge logs.
- Server messages mirror the SSE event payloads and end with `{ "event": "stream.done", "type": "stream.done" }`.

### `POST /extract-url` body

```jsonc
{
  "url": "https://example.com/article" // required
}
```

### `POST /infer-builder-fields` body

```jsonc
{
  "prompt": "Draft prompt text",          // required
  "current_fields": {                     // optional
    "role": "",
    "tone": "",
    "lengthPreference": "",
    "format": [],
    "constraints": []
  },
  "lock_metadata": {                      // optional
    "role": "user",
    "tone": "empty"
  }
}
```

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key (required when using Azure provider config) |
| `OPENAI_API_KEY` or `CODEX_API_KEY` | Fallback OpenAI API key (used only when no provider config is resolved) |
| `NEON_AUTH_URL` or `NEON_JWKS_URL` | Neon Auth URL (or direct JWKS URL) for bearer-session validation (recommended in production) |

### Provider resolution order

The service resolves AI provider settings in this order:

1. `~/.codex/config.toml`
2. `CODEX_CONFIG_JSON`
3. OpenAI fallback (`OPENAI_API_KEY` / `CODEX_API_KEY`, optional)

Set `REQUIRE_PROVIDER_CONFIG=true` to disable step 3 and fail fast instead of falling back.

### Service configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8001` | Listen port |
| `AGENT_SERVICE_TOKEN` | _(none)_ | Optional service-to-service token (`x-agent-token`) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed browser origins |
| `REQUIRE_PROVIDER_CONFIG` | `false` | If `true`, startup fails unless provider config is resolved from `~/.codex/config.toml` or `CODEX_CONFIG_JSON` |
| `FUNCTION_PUBLIC_API_KEY` | _(none)_ | Optional publishable key accepted for unauthenticated calls |
| `STRICT_PUBLIC_API_KEY` | `true` | Require exact match with configured public key values; if `false`, allows publishable-format fallback when no key is configured (not recommended) |
| `TRUST_PROXY` | `false` | If `true`, honors forwarded IP headers for rate limiting/auth context |
| `TRUSTED_PROXY_IPS` | _(none)_ | Optional JSON array or comma-delimited list of trusted proxy source IPs when `TRUST_PROXY=true` |
| `ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS` | `5000` | Time allowed for first websocket message before the socket is closed |
| `ENHANCE_WS_MAX_PAYLOAD_BYTES` | `65536` | Maximum websocket message payload size in bytes |
| `ENHANCE_WS_MAX_CONNECTIONS_PER_IP` | `10` | Maximum concurrent `/enhance/ws` connections allowed per client IP |
| `MAX_HTTP_BODY_BYTES` | `262144` | Maximum HTTP JSON body size in bytes before returning `413 payload_too_large` |
| `ALLOW_UNVERIFIED_JWT_FALLBACK` | `false` | Dev-only: allow decoded JWT fallback when Neon Auth config/service is unavailable |
| `ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION` | `false` | Explicit override to permit decoded-JWT fallback in production (emergency use only) |
| `MAX_PROMPT_CHARS` | `16000` | Maximum prompt character length |
| `MAX_INFERENCE_PROMPT_CHARS` | `12000` | Maximum inference prompt length |
| `MAX_URL_CHARS` | `2048` | Maximum extract-url input URL length |
| `EXTRACT_FETCH_TIMEOUT_MS` | `15000` | Timeout for page/OpenAI extraction calls |
| `EXTRACT_FETCH_MAX_REDIRECTS` | `5` | Maximum redirects followed during `/extract-url` fetch (each hop re-validates public-network target) |
| `EXTRACT_MAX_RESPONSE_BYTES` | `1048576` | Max downloaded page size (bytes) |
| `EXTRACT_MODEL` | Inherits `CODEX_MODEL`/provider model (or `gpt-4.1-mini` for non-Azure) | OpenAI model for URL extraction summarization |
| `SHUTDOWN_DRAIN_TIMEOUT_MS` | `10000` | Time to wait for in-flight connections to drain before forced exit on SIGTERM/SIGINT |
| `EXTRACT_URL_CACHE_TTL_MS` | `600000` | TTL for cached `/extract-url` responses (milliseconds) |
| `EXTRACT_URL_CACHE_MAX_ENTRIES` | `200` | Maximum number of cached `/extract-url` responses |

### Codex client options

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_BASE_URL` / `CODEX_BASE_URL` | _(none)_ | OpenAI-compatible API base URL |
| `CODEX_PATH_OVERRIDE` | _(none)_ | Absolute path to Codex CLI binary |
| `CODEX_CONFIG_JSON` | _(none)_ | JSON object of CLI `--config` overrides, including `model_provider` and `model_providers` when `~/.codex/config.toml` is unavailable |
| `CODEX_ENV_JSON` | _(none)_ | JSON object of env vars for the CLI process |
| `CODEX_MAX_OUTPUT_TOKENS` | _(none)_ | Max output tokens (passed via CLI config) |

### Default thread options

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEX_MODEL` | Provider model (`config.toml`), `AZURE_OPENAI_DEPLOYMENT`, or `gpt-5.2` (non-Azure fallback) | Model/deployment name (for Azure, set this to your deployment name) |
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

### Endpoint rate limits

| Variable | Default | Description |
|----------|---------|-------------|
| `ENHANCE_PER_MINUTE` | `12` | `/enhance` requests per minute |
| `ENHANCE_PER_DAY` | `300` | `/enhance` requests per day |
| `EXTRACT_PER_MINUTE` | `6` | `/extract-url` requests per minute |
| `EXTRACT_PER_DAY` | `120` | `/extract-url` requests per day |
| `INFER_PER_MINUTE` | `15` | `/infer-builder-fields` requests per minute |
| `INFER_PER_DAY` | `400` | `/infer-builder-fields` requests per day |

## Known limitations

- **Per-process rate limiting**: Rate-limit counters are stored in an in-memory `Map` and are not shared across multiple instances. Restarting the process resets all counters.
- **Per-process extract-URL cache**: The `/extract-url` response cache is also in-memory and per-process, so cache hits only benefit the same instance.

## Features

- **Prompt structure analysis**: Pre-flight inspection checks for Role/Task/Context/Format/Constraints sections and includes findings in the prompt input so the enhancer can address gaps.
- **429 retry with backoff**: Automatic retry on rate-limit errors with exponential backoff and jitter. Only retries if no chunks have been emitted yet.
- **Thread resumption**: Pass `thread_id` to continue a previous conversation.
- **SSE streaming**: Compatible with the frontend's `streamEnhance()` parser (supports both `/` and `.` event separators).
- **Client disconnect detection**: Aborts the Codex process when the client disconnects.
- **Neon auth validation**: Verifies JWT bearer tokens via Neon JWKS.
- **HTTP payload guardrail**: Rejects oversized JSON request bodies with `413` without buffering unbounded payloads in memory.
- **CORS + per-endpoint rate limiting**: Browser-safe headers with request throttling for enhance/extract/infer routes.
