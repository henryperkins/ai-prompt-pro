# Agent Service Hardening Remediation Plan

**Date:** 2026-03-12
**Status:** Active
**Source:** 2026-03-12 operational-safety review of `agent_service/`

## Goal

Close the remaining operational-safety, correctness, maintainability, and
documentation gaps in the PromptForge agent service without regressing the
auth, streaming, and SSRF defenses already landed on this branch.

## Current Branch Baseline

Do not restart from the original review snapshot. This branch already closed
several high-risk gaps:

- `agent_service/auth.mjs` now centralizes auth resolution, closes the
  bearer-to-public-key fail-open path, and supports `NEON_AUTH_AUDIENCE`.
- `src/lib/ai-client.ts` now uses a single credential mode per request:
  session/user calls send `Authorization`, anonymous calls send `apikey`.
- `agent_service/codex_service.mjs` now distinguishes `/health` (liveness),
  `/ready` (readiness), and `/health/details` (detailed compatibility payload).
- WebSocket lifecycle guards now include heartbeat, idle timeout, max
  lifetime, buffered-amount cutoff, and tracked abort controllers.
- `agent_service/rate-limit.mjs` now exists as an abstraction boundary, but
  only the `memory` backend is implemented.
- `agent_service/thread-options.mjs` now rejects non-object input and returns
  structured warnings for stripped/invalid options.
- Log hardening removed raw enhancement preview logging and raw upstream
  extraction response bodies.
- `unsafe_url` is now a first-class error code across the service and client.

This plan starts from that baseline and focuses on the remaining work.

## Findings-to-Workstream Map

| Finding | Current state | Workstream |
| --- | --- | --- |
| Auth/config misconfiguration risk | Partially addressed | 1 |
| In-memory rate limiting | Abstraction landed, shared backend missing | 4 |
| `codex_service.mjs` monolith | Auth/rate-limit extracted only | 6 |
| Streaming + retry semantics | Still needs explicit transport-boundary invariant | 2 |
| URL extraction / network surface | Improved, still the riskiest fetch path | 3 |
| Logging leakage | Partially addressed | 5 |
| WebSocket lifecycle / races | Lifecycle guards landed, concurrency tests missing | 2 and 7 |
| Error normalization drift | Better taxonomy, still needs contract freeze | 5 |
| Thread option sanitization confusion | Warnings exist, contract/docs/UI follow-through missing | 5 |
| Env-driven behavior drift | Improved, effective-config guardrails still incomplete | 1 |
| Health/readiness ambiguity | Split endpoints landed, deep readiness still missing | 7 |
| Shutdown edge cases | Drain logic exists, integration proof still missing | 7 |
| Documentation drift | `agent_service/README.md` is stale | 0 |
| Regression coverage gaps | Module tests improved, server integration coverage missing | 8 |

## Implementation Order

Implement in this order:

1. Remove documentation and config-contract drift first so future work uses a
   correct source of truth.
2. Lock auth policy behavior next because it is the highest security boundary
   and the easiest place for regressions during refactors.
3. Make retry safety explicit at the transport boundary before additional
   streaming work lands.
4. Expand URL-fetch defenses and tests while the auth and retry boundaries are
   stable.
5. Add the shared rate-limit backend before any multi-instance rollout.
6. Continue decomposing `codex_service.mjs` only after the risky behavior is
   frozen behind tests and smaller modules.
7. Deepen readiness/shutdown semantics after the service boundaries are
   modularized.
8. Close with CI/test enforcement so the remaining fixes do not drift again.

---

## Workstream 0: Remove Documentation Drift

**Findings addressed:** documentation drift, env-driven behavior confusion,
thread-option contract drift, readiness drift.

**Files:**
- Modify: `agent_service/README.md`
- Modify: `docs/README.md`

### Step 1: Rewrite the endpoint contract

Update `agent_service/README.md` so the endpoint table reflects the live
service:

- `/health` = liveness only
- `/ready` = readiness
- `/health/details` = compatibility/detail payload

Do not leave the old `/health` description in place because it now gives the
wrong operational meaning.

### Step 2: Rewrite the auth examples

Replace mixed-credential examples with the real contract:

- session/user HTTP requests send `Authorization` only
- anonymous HTTP requests send `apikey` only
- WebSocket `enhance.start` auth follows the same rule
- `x-agent-token` is for service-to-service use only and is not a browser CORS
  header

### Step 3: Document the new environment variables

Add the currently-supported variables that are missing from the README:

- `NEON_AUTH_API_KEY`
- `NEON_AUTH_AUDIENCE`
- `RATE_LIMIT_BACKEND`
- `ENHANCE_WS_HEARTBEAT_MS`
- `ENHANCE_WS_IDLE_TIMEOUT_MS`
- `ENHANCE_WS_MAX_LIFETIME_MS`
- `ENHANCE_WS_MAX_BUFFERED_BYTES`

Call out that `RATE_LIMIT_BACKEND=memory` is the only implemented backend in
this build.

### Step 4: Document `thread_options` validation

Add a short contract note:

- non-object `thread_options` fails validation
- unsupported fields are stripped
- stripped or invalid options generate structured warnings
- warnings appear in enhancement metadata and service logs

### Step 5: Document the stable error taxonomy

Add a compact table for the current client-facing error codes, including
`unsafe_url`, so frontend and backend documentation stay aligned.

### Step 6: Re-index the plan

Add this plan to `docs/README.md` under active planning docs so future work
starts from the current remediation sequence.

### Step 7: Validate doc wiring

Run:

```bash
npm run check:docs
```

**Definition of done**

- `agent_service/README.md` matches the live endpoint/auth/env behavior.
- `docs/README.md` indexes the remediation plan.
- `npm run check:docs` passes.

---

## Workstream 1: Freeze Auth Policy and Effective Config Behavior

**Findings addressed:** auth/config misconfiguration risk, CORS + auth
combination, env-driven behavior drift.

**Files:**
- Modify: `agent_service/auth.mjs`
- Modify: `agent_service/codex_service.mjs`
- Modify: `src/lib/ai-client.ts`
- Add: `src/test/agent-service-auth-http.test.ts`
- Add: `src/test/agent-service-auth-ws.test.ts`

### Step 1: Extract route auth policy into a dedicated module

Move `ROUTE_AUTH_POLICIES` out of `codex_service.mjs` into a small dedicated
module so the allowed modes per route are easy to audit without scanning server
control flow.

### Step 2: Make every route policy explicit

For each route, declare exactly which modes are accepted:

- `user_jwt`
- `service_token`
- `public_key`

Do not rely on a permissive shared default for sensitive routes. If a route is
intentionally public-key capable, say so explicitly in code.

### Step 3: Fail startup on invalid combinations

Add explicit startup validation for combinations that create policy drift:

- service-token-only route configured without `AGENT_SERVICE_TOKEN`
- production `TRUST_PROXY=true` without a trusted-proxy allowlist
- production anonymous/public-key access with wildcard origins where the route
  should not be browser-public
- production `ALLOW_UNVERIFIED_JWT_FALLBACK=true` without the explicit
  production override

### Step 4: Emit a sanitized effective-config summary

At startup, log a compact summary with:

- route auth modes
- public fallback enabled/disabled
- WS enabled
- extract-url enabled
- rate-limit backend
- trust-proxy mode

Do not log raw secrets, tokens, URLs with embedded credentials, or key values.

### Step 5: Start deprecating WebSocket subprotocol auth

Keep the legacy path only for compatibility, but:

- emit a deprecation warning when it is used
- document a removal date or release gate
- prefer `enhance.start` message auth everywhere

### Step 6: Add full HTTP and WS auth integration tests

Cover the real server boundary, not only the auth module:

- valid JWT
- expired JWT
- wrong audience
- invalid service token
- valid anonymous public key
- bearer present while Neon auth is unavailable
- WS `enhance.start` auth using JWT vs `apikey`
- legacy WS subprotocol auth warning path

### Step 7: Re-run the focused auth suite

Run:

```bash
npx vitest run \
  src/test/agent-service-auth.test.ts \
  src/test/agent-service-auth-http.test.ts \
  src/test/agent-service-auth-ws.test.ts \
  src/test/ai-client-auth.test.ts \
  src/test/ai-client-websocket.test.ts
```

**Definition of done**

- Route auth modes are explicit and auditable.
- Startup rejects invalid auth/config combinations.
- HTTP and WS auth behavior is covered at the server boundary.

---

## Workstream 2: Make Retry Safety an Explicit Transport Invariant

**Findings addressed:** streaming + retry semantics, duplicate output risk,
WebSocket concurrency races.

**Files:**
- Modify: `agent_service/codex_service.mjs`
- Add: `src/test/agent-service-stream-retry.test.ts`
- Add: `src/test/agent-service-websocket-lifecycle.test.ts`

### Step 1: Introduce a transport-boundary commit flag

Add an explicit `responseCommitted` or `clientVisibleEventSent` flag at the
SSE/WS writer boundary. Set it the first time the client can observe output.

Do not infer retry safety from buffered event arrays alone.

### Step 2: Pass the commit state into `runStreamedWithRetry`

Change retry decisions so the function checks the transport commit flag before
retrying. The invariant must be:

- retry allowed only when no client-visible event has been sent
- retry blocked after the first visible SSE event, WS frame, or synthetic
  metadata event

### Step 3: Treat side-effectful Codex events as non-retryable

Even before client-visible output, block retry if the streamed event sequence
contains a non-retry-safe side effect such as:

- tool execution
- thread state mutation that cannot be replayed safely
- other non-prelude events outside the retry-safe allowlist

### Step 4: Add a per-socket single-flight guard

Reject a second `enhance.start` while one enhancement is already active on the
same socket. Return a stable error instead of racing two runs through one
connection.

### Step 5: Audit “emit once” metadata

Verify that attempt count, usage metadata, final post-processed payload, and
completion status are emitted once even when a retry occurs before commit.

### Step 6: Add the retry and WS lifecycle tests

Cover:

- 429 before first byte retries
- 429 after first byte does not retry
- retry-safe prelude-only failure retries
- tool-like side effect before visible output does not retry
- duplicate `enhance.start` on one socket is rejected
- heartbeat/idle timeout closes the socket cleanly

### Step 7: Re-run the targeted streaming suite

Run:

```bash
npx vitest run \
  src/test/agent-service-stream-retry.test.ts \
  src/test/agent-service-websocket-lifecycle.test.ts \
  src/test/stream-errors.test.ts
```

**Definition of done**

- Retry behavior depends on explicit transport state, not implicit event-order
  assumptions.
- The server never retries after client-visible output or side effects.
- One socket can drive only one active enhancement at a time.

### Follow-up (2026-03-12): Client-side retry invariant

The client (`src/lib/ai-client.ts`) now enforces the same boundary:

- Overall `timeoutMs` owns the full request budget, including retry sleeps.
  Retry backoff waits on `requestController.signal` and is capped to the
  remaining budget so the timeout cannot drift.
- Request replay is allowed only before any backend-emitted attempt activity.
  A dedicated `sawAttemptActivity` flag (separate from `sawSessionProgress`)
  blocks retries after any event carrying `thread_id`, `turn_id`, `item_id`,
  item lifecycle events, output events, or tool-call prelude events.
- Fallback compatibility (WS → SSE in `auto` mode) and same-request replay
  are separate decisions. `allowFallbackAfterError` drives transport switching;
  `canRetryEnhance()` drives request replay.

See `docs/plans/2026-03-12-enhance-retry-regression-remediation.md` for the
detailed remediation plan and done criteria.

---

## Workstream 3: Expand URL-Fetch Hardening and SSRF Coverage

**Findings addressed:** URL extraction/network access surface, SSRF edge cases.

**Files:**
- Modify: `agent_service/network-security.mjs`
- Modify: `agent_service/codex_service.mjs`
- Add: `agent_service/network-fetch.mjs`
- Add: `src/test/network-fetch.test.ts`
- Modify: `src/test/network-security.test.ts`

### Step 1: Separate validation from fetch orchestration

Move fetch-specific logic for `/extract-url` into a dedicated
`agent_service/network-fetch.mjs` wrapper so URL canonicalization, redirect
handling, and byte limits are not mixed into the route handler.

### Step 2: Canonicalize the risky URL shapes up front

Extend canonicalization and tests for:

- localhost aliases such as `127.1`
- integer or hex IPv4 forms
- IPv4-mapped IPv6
- userinfo confusion (`allowed.com@evil.com`)
- mixed-case schemes and hosts
- punycode / IDN normalization

### Step 3: Re-validate every redirect hop

For every redirect:

- resolve the next absolute URL
- enforce `http` / `https` only
- re-resolve DNS
- re-run private-host checks
- decrement the redirect budget

Do not trust the original URL validation to cover later hops.

### Step 4: Harden transfer limits

Keep the existing byte cap, then add or verify:

- per-hop timeout
- total request timeout
- streamed byte counting after decompression
- early abort when `content-length` already exceeds the cap
- optional content-type allowlisting if product constraints allow it

### Step 5: Add the dedicated SSRF test matrix

Create focused test cases for:

- RFC1918 IPv4
- IPv6 loopback and link-local
- redirect to private IP
- redirect to unsupported scheme
- userinfo confusion
- punycode host normalization
- over-limit response bodies
- slow timeout path

### Step 6: Re-run the network suite

Run:

```bash
npx vitest run \
  src/test/network-security.test.ts \
  src/test/network-fetch.test.ts \
  src/test/stream-errors.test.ts
```

**Definition of done**

- URL validation is centralized and reusable.
- Every redirect hop is re-validated.
- The SSRF suite covers the known bypass families from the review.

---

## Workstream 4: Replace Per-Process Rate Limiting with a Shared Backend

**Findings addressed:** in-memory rate limiting, restart resets, multi-instance
drift, proxy-identity ambiguity.

**Files:**
- Modify: `agent_service/rate-limit.mjs`
- Modify: `agent_service/codex_service.mjs`
- Add: `src/test/rate-limit.test.ts`
- Add: `src/test/rate-limit-identity.test.ts`

### Step 1: Freeze the limiter interface first

Before adding Redis or Postgres, lock the shared contract for
`createRateLimiter()` so every backend supports the same inputs and return
shape.

### Step 2: Define canonical client identity rules

Use one stable identity order:

1. authenticated subject
2. validated service token identity
3. trusted proxy client IP
4. direct remote IP

Do not trust `X-Forwarded-For` unless the request came through an explicitly
trusted proxy.

### Step 3: Implement the external backend

Preferred order:

1. Redis for shared TTL counters
2. Postgres only if Redis is unavailable and traffic is moderate

Keep `memory` as a dev/local backend, not the production default.

### Step 4: Extend the quota model for WebSockets

Add or verify:

- active connection limit
- cumulative bytes per connection
- messages per minute
- active enhancement count per connection

### Step 5: Add restart and multi-instance tests

Even if integration coverage is partially mocked, verify that:

- counters survive process restarts for the shared backend
- two limiter instances enforce one shared quota
- untrusted forwarded headers do not change identity

### Step 6: Re-run the rate-limit suite

Run:

```bash
npx vitest run \
  src/test/rate-limit.test.ts \
  src/test/rate-limit-identity.test.ts
```

**Definition of done**

- Production no longer depends on per-process counters.
- Client identity is consistent across HTTP and WS routes.
- Trust-proxy behavior is explicit and tested.

---

## Workstream 5: Freeze Logging, Error Taxonomy, and Thread-Option Feedback

**Findings addressed:** sensitive logging leakage, error normalization drift,
thread-option confusion.

**Files:**
- Modify: `agent_service/codex_service.mjs`
- Modify: `agent_service/stream-errors.mjs`
- Modify: `agent_service/thread-options.mjs`
- Modify: `src/lib/ai-client.ts`
- Add: `src/test/agent-service-logging.test.ts`

### Step 1: Centralize redaction

Extract a reusable redaction helper for:

- `Authorization`
- `apikey`
- `x-agent-token`
- prompt text
- model outputs
- fetched response bodies

Require every log path to go through it before logging request-derived data.

### Step 2: Freeze the client-facing error codes

Create a compact contract and keep it stable:

- `auth_invalid`
- `auth_expired`
- `rate_limited`
- `unsafe_url`
- `upstream_timeout`
- `upstream_unavailable`
- `validation_error`
- `internal_error`

Only the message text may vary; the machine code should not.

### Step 3: Ensure request correlation survives failures

Make sure every error response and every warning/error log carries the same
`request_id` so operators can trace one failure across the full request path.

### Step 4: Preserve `thread_options` warnings end-to-end

Verify that warnings survive:

- server sanitization
- enhancement metadata emission
- client parsing
- any UI surface or debug tooling that consumes metadata

If the UI intentionally does not render warnings, document that they remain an
operator/debug signal only.

### Step 5: Add the logging and error-contract tests

Cover:

- secret-bearing headers are redacted
- prompt bodies are not logged raw
- `unsafe_url` maps consistently from server to client
- invalid `thread_options` warnings survive in metadata

### Step 6: Re-run the contract suite

Run:

```bash
npx vitest run \
  src/test/agent-service-logging.test.ts \
  src/test/thread-options.test.ts \
  src/test/enhance-thread-options.test.ts \
  src/test/stream-errors.test.ts
```

**Definition of done**

- Sensitive material is redacted consistently.
- Error codes are stable and documented.
- `thread_options` warnings are either surfaced intentionally or explicitly
  documented as debug-only.

---

## Workstream 6: Continue Decomposing `codex_service.mjs`

**Findings addressed:** monolithic server file, hidden coupling, maintainability
under growth.

**Files:**
- Modify: `agent_service/codex_service.mjs`
- Add: `agent_service/route-auth-policy.mjs`
- Add: `agent_service/health-routes.mjs`
- Add: `agent_service/enhance-http-route.mjs`
- Add: `agent_service/enhance-ws-route.mjs`
- Add: `agent_service/extract-url-route.mjs`
- Add: `agent_service/shutdown.mjs`

### Step 1: Extract by policy boundary first

Move config parsing, route-auth policy, readiness, and shutdown tracking out of
the main file before extracting route handlers. Policy code is the highest
leverage area for readability.

### Step 2: Extract the HTTP enhance route

Move SSE request validation, stream orchestration, and response writing into a
dedicated route module with a narrow dependency surface.

### Step 3: Extract the WS enhance route

Move protocol negotiation, lifecycle timers, and message handling into a
dedicated module so WS complexity does not keep expanding inside the bootstrap
file.

### Step 4: Extract URL extraction and inference routes

Keep request validation, service orchestration, and response shaping in route
modules. Shared fetch/model helpers belong in dedicated service modules, not in
the HTTP entrypoint.

### Step 5: Keep bootstrap thin

After extraction, `codex_service.mjs` should mainly:

- load config
- create shared services
- wire routes
- start the server
- coordinate shutdown

### Step 6: Set a file-size target

Do not accept a cosmetic split. Target:

- `codex_service.mjs` under 1200 lines
- no route handler longer than roughly 250 lines

### Step 7: Re-run syntax and focused tests

Run:

```bash
node --check agent_service/codex_service.mjs
node --check agent_service/health-routes.mjs
node --check agent_service/enhance-http-route.mjs
node --check agent_service/enhance-ws-route.mjs
node --check agent_service/extract-url-route.mjs
```

Then re-run the targeted agent-service vitest slices affected by the extraction.

**Definition of done**

- Policy and route logic are no longer intertwined in one file.
- The bootstrap file becomes reviewable without scrolling through every
  transport detail.

---

## Workstream 7: Deepen Readiness and Shutdown Proof

**Findings addressed:** false-positive health/readiness, incomplete graceful
shutdown, WS/SSE drain uncertainty.

**Files:**
- Modify: `agent_service/codex_service.mjs`
- Modify: `agent_service/health-routes.mjs`
- Modify: `agent_service/shutdown.mjs`
- Add: `src/test/agent-service-readiness.test.ts`
- Add: `src/test/agent-service-shutdown.test.ts`

### Step 1: Define readiness as dependency usability

Make `/ready` fail when required dependencies are not usable, not merely
configured. At minimum, check:

- provider/model configuration resolves
- auth configuration for enabled routes is valid
- rate-limit backend is reachable
- Codex client can initialize

### Step 2: Keep `/health` narrowly scoped

Do not add dependency checks back into `/health`. It should remain a pure
liveness endpoint for orchestrators.

### Step 3: Make shutdown behavior explicit for streaming clients

On shutdown:

- stop accepting new requests immediately
- return a clear error/close reason to new WS upgrade attempts
- terminate active SSE streams with a final structured event when possible
- close active WS connections with a reason code
- abort in-flight fetches and Codex runs

### Step 4: Prove the drain timeout behavior

Add tests for:

- active SSE during shutdown
- active WS during shutdown
- in-flight `/extract-url` during shutdown
- hard timeout expiration when a client hangs

### Step 5: Re-run readiness/shutdown coverage

Run:

```bash
npx vitest run \
  src/test/agent-service-readiness.test.ts \
  src/test/agent-service-shutdown.test.ts
```

**Definition of done**

- `/health` and `/ready` have distinct, test-backed semantics.
- Shutdown behavior is deterministic for HTTP, SSE, WS, and in-flight fetches.

---

## Workstream 8: Enforce the Regression Harness in CI

**Findings addressed:** missing server integration coverage, future drift risk.

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/main_ai-prompt-pro-agent.yml`
- Add if needed: `src/test/agent-service.smoke.test.ts`

### Step 1: Add a dedicated agent-service test command

Create a stable script such as `npm run test:agent-service` that runs the
backend-focused test slices added in this plan.

### Step 2: Put the script in the pre-merge path

Either extend `check:prod` or add a separate required CI job so agent-service
tests are not optional.

### Step 3: Add a minimal server smoke slice

Keep one fast test that boots the service and verifies:

- `/health`
- `/ready`
- one rejected auth path
- one accepted anonymous/JWT path

This should be cheap enough to run on every PR.

### Step 4: Add a rollout checklist for deploys

For service deploys, require:

- docs updated when env or endpoint contracts change
- focused test suite green
- `npm run build` green
- startup log confirms effective config
- `/health` and `/ready` verified in the target environment

### Step 5: Run the final verification set

At minimum:

```bash
npm run lint
npm run check:docs
npm run build
```

Run `npm run check:prod` too if the agent-service tests are wired into it by
the end of this workstream.

**Definition of done**

- The agent-service regression suite runs in CI.
- Docs drift is caught when contracts change.
- Deploy validation uses `/health` plus `/ready`, not liveness alone.

---

## Exit Criteria

This remediation plan is complete when all of the following are true:

- auth modes are explicit per route and invalid startup combinations fail fast;
- retry safety is enforced by an explicit transport-boundary commit invariant;
- URL-fetch validation covers redirect, alias, and timeout edge cases;
- production rate limiting no longer depends on per-process memory;
- logs redact secrets and error codes stay machine-stable;
- `codex_service.mjs` is split into auditable route/service modules;
- `/ready` and shutdown behavior have integration coverage;
- backend-focused tests run in CI;
- `agent_service/README.md` reflects the live contract.
