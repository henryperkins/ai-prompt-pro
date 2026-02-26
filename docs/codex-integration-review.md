# Codex SDK Integration Review

Last updated: 2026-02-26

**Date:** 2026-02-20
**Scope:** `@openai/codex-sdk` integration across `agent_service/`, `src/lib/ai-client.ts`, `src/lib/codex-export.ts`, CI/CD pipelines, and supporting infrastructure.
**Methodology:** Static analysis of all source files, environment configuration, CI workflows, and documentation. No runtime testing performed.

---

## 1. Summary

- The agent service (`agent_service/codex_service.mjs`) uses `@openai/codex-sdk@0.104.0` to power three endpoints: `/enhance` (SSE streaming), `/enhance/ws` (WebSocket streaming), and `/extract-url` (URL content extraction). A fourth endpoint (`/infer-builder-fields`) uses pure heuristic regex matching with no LLM calls.
- The frontend client (`src/lib/ai-client.ts`) implements a dual-transport strategy (WebSocket with SSE fallback), auth token lifecycle management with three-tier recovery (session token, force-refresh, publishable key fallback), and comprehensive error normalization.
- The enhancement pipeline (`agent_service/enhancement-pipeline.mjs`) performs pre-flight prompt analysis (intent classification, domain detection, complexity scoring, structure inspection) and constructs a structured meta-prompt using a 6-part builder framework before sending to the Codex SDK.
- **Critical security finding:** The `.env` file contains real credentials (including a Supabase service-role key) and is committed to the repository.
- **Resilience is well-designed at the application level** (429 retry with exponential backoff, WS-to-SSE fallback, client disconnect detection, auth recovery flows) but lacks infrastructure-level hardening (no graceful shutdown, in-memory-only rate limiting).
- **Observability is the largest operational gap:** The service has zero structured logging, no request correlation IDs, no metrics emission, and no distributed tracing. Production debugging relies entirely on `console.log` statements.
- **The agent service has zero test coverage.** The frontend has unit tests for `ai-client.ts` and `codex-export.ts`, but the backend service that handles all LLM interactions is untested.
- The CI/CD pipeline deploys the entire repository (including `.env`, `.git/`, and dev dependencies) as the deployment artifact for the agent service.

---

## 2. Integration Map

### Data Flow

```
                          +-----------------------+
                          |    Browser / Client    |
                          +-----------+-----------+
                                      |
                   auth: Neon Auth JWT / publishable key
                                      |
                          +-----------v-----------+
                          |  src/lib/ai-client.ts  |
                          |  (dual transport:       |
                          |   WS preferred, SSE     |
                          |   fallback)             |
                          +-----------+-----------+
                                      |
                            WS or SSE (HTTP POST)
                                      |
                          +-----------v-----------+
                          | codex_service.mjs       |
                          | (Node.js HTTP + WS)     |
                          |                         |
                          |  /enhance (SSE)  -------+---> Codex SDK --> OpenAI API
                          |  /enhance/ws (WS) ------+        |
                          |                         |        +-- gpt-5.2 (default)
                          |  /extract-url ----------+---> fetch(url) --> OpenAI Chat API
                          |                         |        +-- gpt-4.1-mini
                          |  /infer-builder-fields --+---> regex heuristics (no LLM)
                          |                         |
                          |  Auth: JWT (JWKS) +     |
                          |   service token +       |
                          |   publishable key       |
                          |                         |
                          |  Rate limit: in-memory  |
                          |   Map per endpoint      |
                          +-----------+-------------+
                                      |
                          +-----------v-----------+
                          | Azure Web App           |
                          | (ai-prompt-pro-agent)   |
                          +-------------------------+

Frontend (Azure Static Web Apps)     Database (Neon Postgres)
  Vite + React + TS + Tailwind         Neon Data API + Neon Auth
```

### Component Inventory

- **Frontend client** (`src/lib/ai-client.ts`, 1592 lines)
  - Dual-transport streaming (WebSocket + SSE)
  - Auth token lifecycle (get, refresh, bootstrap, clear)
  - Error classification and normalization (`AIClientError`)
  - Configurable timeouts, transport mode, WS connect timeout
- **Agent service** (`agent_service/codex_service.mjs`, 2529 lines)
  - HTTP server with SSE streaming
  - WebSocket server (`ws` library, noServer mode)
  - Codex SDK client (singleton, lazy-initialized)
  - JWT verification via `jose` + Neon JWKS
  - Per-endpoint rate limiting (minute + day windows)
  - CORS enforcement
  - SSRF protection for `/extract-url`
- **Enhancement pipeline** (`agent_service/enhancement-pipeline.mjs`, 555 lines)
  - Intent classification (7 categories via regex)
  - Domain detection (7 domains via regex)
  - Complexity scoring (1-5 scale)
  - Prompt structure inspection (5 core sections)
  - Meta-prompt construction (6-part builder framework)
  - LLM response JSON parsing + post-processing
- **Thread options** (`agent_service/thread-options.mjs`, 39 lines)
  - Sanitization of `modelReasoningEffort` and `webSearchEnabled`
- **Codex export helpers** (`src/lib/codex-export.ts`, 224 lines)
  - AGENTS.md generation (size-capped to 32KB)
  - Bash command generation (TUI, exec, debug, skill scaffold)
  - UTF-8 byte-length truncation
- **CI/CD**
  - `main_ai-prompt-pro-agent.yml` — Agent service deploy to Azure Web App
  - `azure-static-web-apps-gentle-dune-075b4710f.yml` — Frontend deploy to Azure SWA
  - `neon-pr-branches.yml` — Neon branch management for PRs

### Boundaries & Auth

| Boundary | Auth mechanism | Notes |
|----------|---------------|-------|
| Browser → Agent service | Bearer JWT (Neon Auth) | Verified via JWKS; fallback to publishable key |
| Browser → Agent service | `apikey` header | Publishable key for anonymous access |
| Internal → Agent service | `x-agent-token` header | Service-to-service shared secret |
| Agent service → OpenAI | `OPENAI_API_KEY` env var | Used by both Codex SDK and raw fetch |
| Agent service → Neon Auth | JWKS URL | For JWT signature verification |
| Frontend → Neon Data API | Neon Auth JWT | Direct from browser |

---

## 3. Findings Matrix

### 3.1 Security

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| S1 | `.env:17` — `SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."` | **Real service-role key committed to repository.** The `.env` file contains production-grade credentials including the Supabase service-role key, Neon endpoint URLs, and publishable keys. | **P0 / Critical.** Anyone with repo access has admin-level database credentials. If the repo is public or leaked, full data breach is possible. | Rotate all credentials immediately. Remove `.env` from tracking (`git rm --cached .env`). Verify `.gitignore` excludes `.env`. Use a secrets manager or CI-injected env vars for all environments. |
| S2 | `codex_service.mjs:280-282` — `ENHANCE_WS_BEARER_PROTOCOL_PREFIX`, `ENHANCE_WS_APIKEY_PROTOCOL_PREFIX` | Legacy WebSocket subprotocol auth transmits tokens in the `Sec-WebSocket-Protocol` header during the HTTP upgrade. | **Medium.** Tokens may appear in edge/CDN access logs, reverse proxy logs, or browser developer tools network tab. The README already recommends message-body auth, but the legacy path remains functional. | Deprecate subprotocol auth with a sunset timeline. Log a warning when subprotocol auth is used. Add `Sec-WebSocket-Protocol` to log-scrubbing rules in infrastructure. |
| S3 | `codex_service.mjs:510-532` — `allowUnverifiedJwtFallback()` | `ALLOW_UNVERIFIED_JWT_FALLBACK` accepts decoded JWT claims without signature verification. While gated behind env flags and production checks, the mechanism exists. | **Low in production** (double-gated), **High if misconfigured.** An attacker could forge JWT claims if the fallback is enabled in production. | Add startup warning when enabled. Consider removing entirely and using a test-specific auth bypass instead. Add integration test verifying the production gate works. |
| S4 | `codex_service.mjs:1290-1302` — `stripHtml()` | HTML stripping for `/extract-url` uses regex replacement. No DOM parser or sanitization library. | **Low.** This is used for content extraction (not rendering), so XSS risk is minimal. However, malformed HTML could produce unexpected text output fed to the LLM. | Consider using a lightweight HTML-to-text library (e.g., `html-to-text`) for more robust extraction. |
| S5 | `.github/workflows/main_ai-prompt-pro-agent.yml:34` — `path: .` | CI uploads the entire repo as the deployment artifact, including `.env`, `.git/`, dev dependencies, and test files. | **Medium.** Credentials deployed to Azure Web App filesystem. Unnecessary files increase attack surface and artifact size. | Use a targeted `path` or add an `.artifactignore`/exclusion list. Only deploy `agent_service/`, `node_modules/` (prod), and `package.json`. |

### 3.2 Resilience

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| R1 | `codex_service.mjs:1525-1567` — `runStreamedWithRetry()` | Retry logic for 429 errors replays the entire Codex thread turn. No idempotency key is sent. The retry guard (`sawAnyEvent`) only prevents retry if events were already yielded to the caller, but the Codex SDK may have executed tool calls or side effects before the 429. | **Medium.** If the Codex agent executed a tool (e.g., file write, shell command) before the rate limit hit, retrying replays the entire turn, potentially causing duplicate side effects. | Add an idempotency token to the thread turn input if the Codex SDK supports it. If not, constrain retries to the initial turn only (no retry after `thread.started`) and document the limitation. |
| R2 | `codex_service.mjs:2524-2528` — `server.listen()` | No `SIGTERM`/`SIGINT` handler. No graceful shutdown logic. | **Medium.** On Azure Web App restart/deploy, in-flight SSE streams and WebSocket connections are terminated without cleanup. Clients receive abrupt disconnections instead of structured error events. | Add a shutdown handler that stops accepting new connections, sends `stream.done` or error events to active streams, waits for in-flight requests (with timeout), then exits. |
| R3 | `codex_service.mjs:915-922` — `getCodexClient()` | Singleton Codex client with no health-check or reconnection logic. | **Low.** If the Codex SDK's internal state becomes corrupted (e.g., after an unhandled rejection), all subsequent requests fail until the process restarts. | Consider adding a periodic health check or client recreation strategy. At minimum, wrap `getCodexClient()` with a try/catch that recreates the client on initialization failure. |
| R4 | `ai-client.ts:680-690` — `requestWithRetry()` | Frontend retry logic retries once after a 250ms delay on retryable errors, but does not implement exponential backoff. | **Low.** A single retry with fixed delay is sufficient for transient network issues but won't help during sustained outages. | Adequate for current traffic. Consider adding a second retry with exponential backoff if users report intermittent failures. |

### 3.3 Performance

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| P1 | `codex_service.mjs:284` — `const rateLimitStores = new Map()` | Rate limiting uses an in-memory `Map`. In a multi-instance deployment, each instance tracks limits independently. | **Medium.** Users can bypass rate limits by hitting different instances. In a single-instance deployment (current Azure Web App), this is acceptable. | For multi-instance: use Redis or Azure Cache. For single-instance: document the limitation and add a TODO. |
| P2 | `codex_service.mjs:803-809` — `pruneStore()` | Pruning triggers only when `store.size > 5000` and scans the entire map synchronously. | **Low.** Under normal traffic, unlikely to hit 5000 entries. Under sustained attack, the O(n) scan blocks the event loop. | Switch to a TTL-based data structure (e.g., `Map` with periodic interval-based pruning) or use a library like `lru-cache`. |
| P3 | `codex_service.mjs:2200-2339` — `handleExtractUrl()` | No caching for URL extraction results. Every request for the same URL triggers a full fetch + OpenAI API call. | **Medium.** Redundant API spend and latency for popular URLs. Multiple users extracting the same article generate duplicate OpenAI calls. | Add a short-TTL cache (5-15 minutes) keyed by URL. Use `Map` with TTL cleanup or `lru-cache`. |
| P4 | `codex_service.mjs:1457-1493` — `summarizeExtractedText()` | URL extraction uses raw `fetch` to the OpenAI Chat Completions API instead of the Codex SDK. This bypasses the SDK's built-in retry logic, token management, and configuration. | **Low.** The raw fetch works correctly but is architecturally inconsistent. Any improvements made to the Codex SDK client (retries, observability) don't apply to extraction. | Either use the Codex SDK for extraction or extract the retry/auth logic into a shared utility. |
| P5 | `enhancement-pipeline.mjs:89-177` — `MASTER_META_PROMPT` | The meta-prompt is ~180 lines of template text sent with every enhancement request. Combined with builder fields, mode addons, and intent addons, the system prompt can be substantial. | **Low.** Token cost is proportional to prompt size. The meta-prompt is well-structured and each section serves a purpose. | Monitor token usage per request. Consider a `quick` mode optimization that sends a smaller meta-prompt. |

### 3.4 Observability

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| O1 | Entire `agent_service/` | No structured logging. All logging is `console.log()` / `console.error()` with unstructured string messages. | **High.** Production debugging requires parsing raw text logs. No way to correlate a user request through the enhance pipeline. No way to filter by user, endpoint, or error type. | Adopt a structured logger (e.g., `pino`). Emit JSON logs with fields: `requestId`, `userId`, `endpoint`, `duration`, `status`, `error`. |
| O2 | Entire `agent_service/` | No request correlation IDs. Requests cannot be traced from the frontend through the agent service to the Codex SDK. | **High.** When a user reports an enhancement failure, there's no way to find the corresponding server-side logs or Codex SDK interaction. | Generate a `requestId` (UUID) per request. Pass it as a header from `ai-client.ts`, log it on every service-side log entry, and include it in error responses. |
| O3 | Entire `agent_service/` | No metrics emission (request count, latency histograms, error rates, Codex SDK response times, token usage). | **Medium.** No visibility into service health, performance trends, or cost drivers without scraping logs. | Emit StatsD/Prometheus metrics for: request count by endpoint, latency percentiles, error rate by type, Codex SDK call duration, OpenAI token usage from response headers. |
| O4 | `codex_service.mjs:2400-2408` — `/health` endpoint | Health check returns static config (model, sandbox mode) but does not validate Codex SDK connectivity or OpenAI API reachability. | **Low.** The health endpoint will report `ok: true` even when the OpenAI API is down or the API key is invalid. | Add a lightweight connectivity check (e.g., list models or send a minimal completion) behind a `?deep=true` query parameter. |

### 3.5 Testing

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| T1 | `agent_service/` — no test files | Zero test coverage for the agent service. The entire Codex SDK integration, auth flow, rate limiting, CORS, SSRF protection, enhancement pipeline, and streaming logic are untested. | **High.** Any refactoring or dependency update can introduce regressions without detection. The `check:prod` gate (design-system checks + `npm run lint` + `npm run test:unit` + `npm run build` + `npm run check:token-runtime`) does not cover the agent service. | Add a test suite for the agent service. Priority areas: (1) auth flow (JWT verification, fallback logic), (2) rate limiting, (3) enhancement pipeline (intent detection, meta-prompt construction, JSON post-processing), (4) SSRF protection, (5) SSE/WS streaming. |
| T2 | `src/test/codex-export.test.ts` | Codex export helpers have test coverage. | **Positive finding.** Good coverage of edge cases (UTF-8 truncation, heredoc delimiter collision, skill name sanitization). | Maintain and extend as new export formats are added. |
| T3 | `src/test/ai-client-sse.test.ts` | Frontend SSE parsing has test coverage. | **Positive finding.** Tests cover SSE text extraction, event meta parsing, and various event shapes. | Extend to cover WebSocket transport path and error normalization. |

### 3.6 Architecture & Correctness

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| A1 | `codex_service.mjs:842` — `options.model = normalizeEnvValue("CODEX_MODEL") || "gpt-5.2"` | Default model is `gpt-5.2`. If this model is unavailable or the name changes, the service fails at runtime with no fallback. | **Medium.** Model availability is an external dependency. A name change or deprecation breaks the service silently until a user reports enhancement failures. | Add model validation at startup (warn if model is not in a known-good list). Consider a fallback model. Log the resolved model name at startup. |
| A2 | `codex_service.mjs:1063-1112` — `chooseRole()`, `chooseTone()`, etc. | `/infer-builder-fields` uses hardcoded regex patterns for field inference. These patterns are not configurable and have limited coverage. | **Low.** The heuristics provide reasonable defaults for common prompt patterns. Edge cases (multilingual prompts, domain-specific jargon) produce no suggestions, which is an acceptable degradation. | Document the heuristic limitations. Consider a hybrid approach where heuristics provide fast suggestions and an optional LLM call provides deeper inference (behind a feature flag). |
| A3 | `codex_service.mjs:1838-1881` — post-processing block | After streaming completes, the service collects all `agent_message` items, picks the primary message, post-processes it (JSON extraction, quality scoring), and emits a synthetic `item/agent_message/delta` event with the full post-processed text. | **Medium.** The client receives both the raw streamed deltas AND the post-processed final text as a separate synthetic event. If the client naively concatenates all deltas, the post-processed text is duplicated. The `ai-client.ts` code handles this via `deltaItemIds` deduplication, but it's a fragile coupling. | Document this contract explicitly. Consider a distinct event type (e.g., `enhance/final`) for the post-processed output to make deduplication unnecessary. |
| A4 | `codex_service.mjs:2474-2483` — `handleProtocols` | WebSocket protocol negotiation rejects connections that don't offer `promptforge.enhance.v1`. | **Positive finding.** Strict protocol enforcement prevents accidental misuse. | No action needed. |

### 3.7 Cost

| # | Evidence | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|
| C1 | Entire service | No mechanism to track OpenAI API spend per user, per endpoint, or per time period. | **Medium.** A single user making many enhancement requests (within rate limits) could generate significant API costs. No alerting on spend anomalies. | Track token usage from OpenAI response headers (`x-ratelimit-remaining-tokens`, etc.) and Codex SDK `usage` events. Emit as metrics. Set budget alerts in the OpenAI dashboard. |
| C2 | `codex_service.mjs:842` — `gpt-5.2` default + `codex_service.mjs:65` — `gpt-4.1-mini` for extraction | Two different models are used: `gpt-5.2` for enhancement (via Codex SDK) and `gpt-4.1-mini` for URL extraction (via raw API). | **Informational.** Using a smaller model for extraction is a good cost optimization. Ensure the extraction model is sufficient for the summarization task. | Document the model choices and rationale. Consider making the extraction model configurable via env var (already done: `EXTRACT_MODEL`). |

---

## 4. Options & Trade-offs

### 4.1 Credential Remediation (S1)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. Rotate credentials, `git rm --cached .env`, add to `.gitignore` | **Low** | Does not purge credentials from git history. |
| B. Option A + `git filter-branch` or `BFG Repo Cleaner` to purge history | **Medium** | Rewrites git history; requires force-push and team coordination. |
| C. Option B + migrate to a secrets manager (Azure Key Vault, GitHub Secrets only) | **High** | Full credential lifecycle management. Eliminates `.env` as an attack vector. |

**Recommendation:** Start with Option A immediately. Schedule Option B for the next maintenance window. Evaluate Option C based on team size and deployment complexity.

### 4.2 Structured Logging (O1, O2)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. Replace `console.log` with `pino` structured logger, add `requestId` | **Low** | Immediate observability improvement. No infrastructure changes. |
| B. Option A + emit to Azure Application Insights or a log aggregator | **Medium** | Adds a dependency but enables alerting, dashboards, and log search. |
| C. Option B + OpenTelemetry traces for Codex SDK calls | **High** | Full distributed tracing. Requires OTel SDK integration and a trace backend. |

**Recommendation:** Option A is high-value/low-effort. Start there.

### 4.3 Agent Service Test Suite (T1)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. Unit tests for pure functions (enhancement pipeline, auth helpers, rate limiting) | **Low** | Covers the most testable code without mocking the Codex SDK. |
| B. Option A + integration tests with mocked Codex SDK | **Medium** | Tests the request→response flow including streaming. Requires a mock server or SDK stub. |
| C. Option B + contract tests against the real OpenAI API (with a test key) | **High** | Validates SDK compatibility but adds API cost, flakiness, and key management. |

**Recommendation:** Start with Option A (the enhancement pipeline alone has ~20 testable pure functions). Add Option B for the streaming paths.

### 4.4 Graceful Shutdown (R2)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. Add `SIGTERM` handler that calls `server.close()` and waits for in-flight connections | **Low** | Prevents abrupt termination. Does not actively notify streaming clients. |
| B. Option A + send structured error events to active WS/SSE connections before closing | **Medium** | Clients receive clean termination signals. Requires tracking active connections. |

**Recommendation:** Option A is a quick win. Extend to Option B when the connection tracking infrastructure from rate limiting can be reused.

### 4.5 Extract-URL Caching (P3)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. In-memory LRU cache with 10-minute TTL, keyed by URL | **Low** | Eliminates redundant fetches/API calls for popular URLs. Cache lost on restart. |
| B. Redis/external cache with configurable TTL | **Medium** | Survives restarts. Shared across instances. Adds infrastructure dependency. |

**Recommendation:** Option A is sufficient for a single-instance deployment.

### 4.6 Rate Limiting Scalability (P1)

| Option | Effort | Trade-off |
|--------|--------|-----------|
| A. Document the single-instance limitation and add a TODO | **Low** | No code change. Risk accepted for current deployment. |
| B. Use `ioredis` + a sliding-window rate limiter | **Medium** | Scales to multi-instance. Adds Redis dependency. |
| C. Use Azure API Management or a CDN-level rate limiter | **High** | Offloads rate limiting entirely. Requires infrastructure provisioning. |

**Recommendation:** Option A for now. Move to Option B when scaling to multiple instances.

---

## 5. Action Plan

### P0 — Do Now

| Item | Finding | Action | Acceptance Criteria |
|------|---------|--------|---------------------|
| 1 | S1 | Rotate all credentials in `.env` | New credentials issued; old ones revoked |
| 2 | S1 | Remove `.env` from git tracking | `git rm --cached .env` executed; `.gitignore` updated |
| 3 | S5 | Scope CI deploy artifact | `main_ai-prompt-pro-agent.yml` uploads only `agent_service/`, `shared/`, `node_modules/` (prod), `package.json`, `package-lock.json` |

### P1 — Next Sprint

| Item | Finding | Action | Acceptance Criteria |
|------|---------|--------|---------------------|
| 4 | O1, O2 | Add structured logging with `pino` + request correlation IDs | All request handlers emit structured JSON logs with `requestId` |
| 5 | R2 | Add graceful shutdown handler | `SIGTERM` triggers `server.close()` with 10s drain timeout |
| 6 | T1 | Add unit tests for enhancement pipeline | `enhancement-pipeline.mjs` pure functions have >80% line coverage |
| 7 | P3 | Add in-memory LRU cache for `/extract-url` | Repeated URL requests within TTL return cached results |
| 8 | S2 | Log deprecation warning for subprotocol auth | Warning emitted on every subprotocol auth usage |

### P2 — Backlog

| Item | Finding | Action | Acceptance Criteria |
|------|---------|--------|---------------------|
| 9 | P1 | Evaluate external rate-limit store (Redis) | Decision document for multi-instance scaling |
| 10 | R1 | Investigate Codex SDK idempotency support | Documented finding on whether the SDK supports idempotency keys |
| 11 | C1 | Add token usage tracking + budget alerts | Per-request token counts logged; OpenAI dashboard alerts configured |
| 12 | O3 | Emit Prometheus/StatsD metrics | Metrics endpoint or push-based emission for key counters |
| 13 | P4 | Unify extraction to use Codex SDK or shared fetch utility | `summarizeExtractedText` uses the same retry/auth path as enhance |
| 14 | A1 | Add model availability validation at startup | Startup logs resolved model; warns if not in known-good list |
| 15 | T1 | Add integration tests for SSE/WS streaming paths | Mock Codex SDK; test full request→stream→response flow |
| 16 | S1 | Purge credentials from git history (BFG or filter-branch) | Git history contains no secrets |
| 17 | A3 | Define explicit event contract for post-processed output | New `enhance/final` event type; client dedup removed |

---

## 6. Open Questions

1. **Deployment topology:** Is the agent service currently single-instance on Azure Web App? Are there plans to scale horizontally? (Impacts P1 rate-limiting decision.)
2. **Traffic volume:** What is the current request rate for `/enhance` and `/extract-url`? (Impacts caching TTL and rate-limit tuning.)
3. **Model availability:** Is `gpt-5.2` consistently available in the configured OpenAI org? Has there been any model deprecation or migration in the past?
4. **Budget constraints:** Is there a monthly budget cap for OpenAI API usage? Should the service enforce a hard limit or just alert?
5. **Credential rotation:** Who owns the Supabase and Neon credentials? Is there a runbook for rotation?
6. **Subprotocol auth deprecation:** Are there known clients still using the WebSocket subprotocol auth path? What is the migration timeline?
7. **Codex SDK versioning:** Is `@openai/codex-sdk@0.104.0` the latest stable version? Is there a pinning strategy or automated dependency update process?
8. **Enhancement pipeline eval:** Has the quality scoring output been validated against human ratings? Is there an eval dataset?

---

*Review produced by static analysis. Runtime testing and load testing recommended as follow-up.*
