# Agent Service

Prompt enhancement backend powered by `@openai/codex-sdk`.

The frontend calls this service directly for AI endpoints.

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
| `OPENAI_API_KEY` or `CODEX_API_KEY` | OpenAI API key |
| `NEON_AUTH_URL` or `NEON_JWKS_URL` | Neon Auth URL (or direct JWKS URL) for JWT session validation (recommended in production) |

### Service configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8001` | Listen port |
| `AGENT_SERVICE_TOKEN` | _(none)_ | Optional service-to-service token (`x-agent-token`) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed browser origins |
| `FUNCTION_PUBLIC_API_KEY` | _(none)_ | Optional publishable key accepted for unauthenticated calls |
| `ALLOW_UNVERIFIED_JWT_FALLBACK` | `false` | Dev-only: allow decoded JWT fallback when Neon Auth config/service is unavailable |
| `ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION` | `false` | Explicit override to permit decoded-JWT fallback in production (emergency use only) |
| `MAX_PROMPT_CHARS` | `16000` | Maximum prompt character length |
| `MAX_INFERENCE_PROMPT_CHARS` | `12000` | Maximum inference prompt length |
| `MAX_URL_CHARS` | `2048` | Maximum extract-url input URL length |
| `EXTRACT_FETCH_TIMEOUT_MS` | `15000` | Timeout for page/OpenAI extraction calls |
| `EXTRACT_MAX_RESPONSE_BYTES` | `1048576` | Max downloaded page size (bytes) |
| `EXTRACT_MODEL` | `gpt-4.1-mini` | OpenAI model for URL extraction summarization |

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

### Endpoint rate limits

| Variable | Default | Description |
|----------|---------|-------------|
| `ENHANCE_PER_MINUTE` | `12` | `/enhance` requests per minute |
| `ENHANCE_PER_DAY` | `300` | `/enhance` requests per day |
| `EXTRACT_PER_MINUTE` | `6` | `/extract-url` requests per minute |
| `EXTRACT_PER_DAY` | `120` | `/extract-url` requests per day |
| `INFER_PER_MINUTE` | `15` | `/infer-builder-fields` requests per minute |
| `INFER_PER_DAY` | `400` | `/infer-builder-fields` requests per day |

## Features

- **Prompt structure analysis**: Pre-flight inspection checks for Role/Task/Context/Format/Constraints sections and includes findings in the prompt input so the enhancer can address gaps.
- **429 retry with backoff**: Automatic retry on rate-limit errors with exponential backoff and jitter. Only retries if no chunks have been emitted yet.
- **Thread resumption**: Pass `thread_id` to continue a previous conversation.
- **SSE streaming**: Compatible with the frontend's `streamEnhance()` parser (supports both `/` and `.` event separators).
- **Client disconnect detection**: Aborts the Codex process when the client disconnects.
- **Neon auth validation**: Verifies JWT bearer tokens via Neon JWKS.
- **CORS + per-endpoint rate limiting**: Browser-safe headers with request throttling for enhance/extract/infer routes.
