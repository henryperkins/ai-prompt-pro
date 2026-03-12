# Agent Service Refactoring Plan

## 1. Code Smells & Anti-Patterns Found

### 1.1 God Object / Monolithic File
`codex_service.mjs` is **3,829 lines** handling 10+ distinct concerns:
configuration parsing, structured logging, HTTP response helpers, SSE streaming,
WebSocket management, URL extraction (HTML parsing, fetch with fallback, summarization,
caching), enhancement orchestration, builder-field inference, request routing, CORS,
and graceful shutdown.

### 1.2 Duplicated Utility Functions (DRY Violations)
| Function | Locations |
|----------|-----------|
| `normalizeEnvValue()` | `codex_service.mjs:455`, `auth.mjs:10` |
| `normalizeBool()` | `codex_service.mjs:462`, `auth.mjs:17` |
| `headerValue()` | `codex_service.mjs:741`, `auth.mjs:52` |
| `parseStringArray*()` | `codex_service.mjs:486`, `auth.mjs:26` |
| `toFiniteNumber()` | `codex_service.mjs:306`, `stream-errors.mjs:1` |
| `hasText()` | `codex_service.mjs:1151`, `builder-field-inference.mjs:94`, `context-source-expansion.mjs:13` |
| `normalizeFieldValue()` | `enhancement-pipeline.mjs:348`, `context-source-expansion.mjs:8` |
| `extractJsonObject()` | `context-source-expansion.mjs:69`, `builder-field-inference.mjs:120` |
| `toErrorMessage()` | `codex_service.mjs:1143`, `auth.mjs:144` |
| `asNonEmptyString()` | `codex_service.mjs:1077` (also patterns in `auth.mjs`, `codex-session.ts`) |

### 1.3 SOLID Violations

**Single Responsibility Principle:**
- `codex_service.mjs` has 10+ responsibilities
- `handleExtractUrl()` (190 lines): fetching, HTML parsing, summarization, caching, error handling
- `runEnhanceTurnStream()` (540 lines): full enhancement streaming lifecycle
- `handleEnhanceWebSocketConnection()` (380 lines): entire WS lifecycle

**Open/Closed Principle:**
- Adding a new endpoint requires modifying `requestHandler()` directly
- Rate-limit configuration is hard-coded per endpoint

**Dependency Inversion Principle:**
- All configuration resolved at module load time via top-level `const` from `process.env`
- `getCodexClient()` singleton with module-level state prevents testing
- No dependency injection for config, logging, or services

### 1.4 Other Issues
- ~200 lines of repetitive env-var parsing boilerplate (each follows identical pattern)
- Custom errors use ad-hoc `error.code` properties instead of typed error classes
- No JSDoc on most functions; complex orchestration functions have zero parameter docs
- URL extraction logic (HTML stripping, meta tags, binary detection) mixed inline
- Workflow event helpers mixed with business logic
- WebSocket helpers and connection management mixed with routing

## 2. Refactoring Strategy

### Phase 1: Extract Shared Utility Modules

| New Module | Lines Saved | Functions Extracted |
|-----------|-------------|---------------------|
| `env-parse.mjs` | ~110 | `normalizeEnvValue`, `normalizeBool`, `parsePositiveIntegerEnv`, `parseJsonObjectEnv`, `parseStringArrayEnv`, `parseEnumEnv`, `toFiniteNumber`, `asNonEmptyString`, `hasText` |
| `logging.mjs` | ~30 | `cleanLogFields`, `logEvent`, `SERVICE_NAME` |
| `request-context.mjs` | ~130 | `createRequestContext`, `setRequestError`, `completeRequestContext`, `captureUsageMetrics`, `attachHttpRequestLifecycleLogging`, `inferErrorCodeFromStatus`, `hashUserIdentifier`, `hashTextForLogs` |
| `http-helpers.mjs` | ~100 | `json`, `beginSse`, `writeSse`, `endSse`, `headerValue`, `baseCorsHeaders`, `resolveCors` |

### Phase 2: Extract Domain Modules

| New Module | Lines Saved | Functions Extracted |
|-----------|-------------|---------------------|
| `url-extract.mjs` | ~300 | HTML stripping, meta extraction, fetch with fallback, safe redirects, summarization, URL cache |
| `enhance-workflow.mjs` | ~200 | All workflow step builders, web search detection, `emitEnhancementWorkflowStep` |
| `codex-retry.mjs` | ~140 | `isRateLimitError`, `isRateLimitTurnFailure`, `runStreamedWithRetry`, `runBufferedWithRetry`, `replayBufferedEvents` |
| `ws-helpers.mjs` | ~110 | All WebSocket utility functions, auth header extraction, protocol handling |

### Phase 3: Update Consumers
- Update `auth.mjs` to import from `env-parse.mjs` (eliminate local duplicates)
- Slim `codex_service.mjs` from ~3,829 to ~2,100 lines (composition root)
- All existing public API contracts remain unchanged

## 3. Backward Compatibility

- **No public API changes**: All HTTP endpoints, WebSocket protocol, SSE event shapes, and
  request/response formats remain identical.
- **No env-var changes**: All environment variables keep the same names and semantics.
- **Import compatibility**: All existing imports from helper modules continue to work.
  New modules only add exports; no existing exports are removed.
- **Frontend consumers unaffected**: `ai-client.ts`, `codex-stream.ts`, `codex-session.ts`
  interact only via HTTP/WS protocol — no shared code imports changed.

## 4. File Impact Summary

```
agent_service/
├── codex_service.mjs        ← MODIFIED (slim from 3829 → ~2100 lines)
├── auth.mjs                 ← MODIFIED (use shared env-parse)
├── env-parse.mjs            ← NEW (shared env parsing utilities)
├── logging.mjs              ← NEW (structured logging)
├── request-context.mjs      ← NEW (request lifecycle tracking)
├── http-helpers.mjs         ← NEW (HTTP/SSE/CORS response helpers)
├── url-extract.mjs          ← NEW (URL fetching, HTML parsing, summarization)
├── enhance-workflow.mjs     ← NEW (workflow step event builders)
├── codex-retry.mjs          ← NEW (429 retry with backoff)
└── ws-helpers.mjs           ← NEW (WebSocket utilities)
```
