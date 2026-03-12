# Prompt Enhancement Transport Review Remediation Plan

**Date:** 2026-03-12
**Status:** Active
**Source:** 2026-03-12 uncommitted-diff review of `src/lib/ai-client.ts`,
`src/test/ai-client-auth.test.ts`, `src/test/ai-client-websocket.test.ts`,
and active docs under `docs/`.

## Goal

Address the reviewed ai-client regressions without regressing the retry budget,
auth-recovery flow, or the existing WebSocket-to-SSE compatibility fallback.

This plan is intentionally scoped to the findings from the current review:

- transient retry attempts are being surfaced as real failed sessions;
- recoverable retry paths still emit terminal-seeming `console.error` noise;
- HTTP 429 responses lose `Retry-After` metadata on the client path;
- the active remediation doc/index drifted away from the branch's real state.

## Findings Covered

| Finding | Current symptom | Risk | Workstream |
| --- | --- | --- | --- |
| Retry-state regression | Recoverable retries call `failCodexSession(...)` before retrying | Session drawer can flash `Failed` and preserve a stale `Last error` even when the request later succeeds | 1 |
| Recoverable-log regression | Recoverable stream failures are logged with `console.error("Stream error:", ...)` before retry | Misleading local/prod logs and noisy debugging signal for requests that self-heal | 1 |
| HTTP rate-limit hint gap | HTTP 429 responses expose `Retry-After`, but `AIClientError.retryAfterMs` is not populated on that path | Callers cannot honor or inspect server cooldown hints; future backoff work lacks source metadata | 2 |
| Plan/index drift | The active 2026-03-12 plan still describes already-addressed timeout/replay issues as current | Future work starts from a stale baseline and duplicates closed work | 3 |
| Coverage drift | Current tests do not lock the reviewed no-failed-session/no-noisy-log/no-HTTP-`Retry-After` contracts | These regressions can return silently even if transport tests stay green | 0, 1, 2 |

## Non-Goals

Do not use this remediation to make unrelated transport-policy changes:

- Do not change the retry cap or the current backoff math.
- Do not broaden retries to 429 rate limits.
- Do not remove `auto`-mode WebSocket-to-SSE fallback for pure connect/open failures.
- Do not change the auth recovery sequence in `postFunctionWithAuthRecovery()`
  beyond threading response metadata.
- Do not redesign the Codex session drawer UI; fix the upstream session/error
  semantics instead.

## Implementation Order

1. Freeze the reviewed behavior in focused tests.
2. Stop surfacing transient failure state and logs before a retry actually fails.
3. Propagate HTTP `Retry-After` metadata into `AIClientError`.
4. Rewrite the remediation doc and docs index to match the real branch state.

---

## Workstream 0: Freeze the Reviewed Contract in Tests First

**Findings addressed:** coverage drift, retry-state regression,
recoverable-log regression, HTTP rate-limit hint gap.

**Files:**

- Modify: `src/test/ai-client-auth.test.ts`
- Modify: `src/test/ai-client-websocket.test.ts`
- Modify: `src/test/index-web-search-streaming.test.tsx` only if a page-level
  session assertion is needed after the lower-level tests land

### Step 1: Add an SSE retry-success session-state test

In `src/test/ai-client-auth.test.ts`, add a focused test that forces:

- one outer enhance retry on the SSE/HTTP path;
- a later successful streamed response;
- `onSession` collection across the whole request.

Use a fetch sequence that is deterministic:

1. first enhance attempt fails with a retryable network error after
   `requestWithRetry()` exhausts its inner retry;
2. second enhance attempt succeeds and streams a normal completion.

Pin these assertions:

- `onDone` fires once;
- `onError` is never called;
- no emitted session snapshot has `status: "failed"`;
- no emitted session snapshot carries `lastErrorMessage`;
- final session status is `completed`.

### Step 2: Freeze the recoverable-log contract on the same SSE path

In that same test, spy on `console.error`.

Pin that:

- recoverable retry paths do not call `console.error`;
- only terminal failures may log through that path.

Restore the spy in `finally` so the suite stays isolated.

### Step 3: Add a forced-WS retry-success regression test

In `src/test/ai-client-websocket.test.ts`, extend the `FakeWebSocket` harness if
needed so a single test can drive multiple connection outcomes in sequence.

Use a forced `ws` scenario that:

1. fails the first connection before any backend payload is seen;
2. allows the second connection to complete successfully.

Pin the same user-visible contract:

- request completes successfully;
- no `failed` session update is emitted during the recoverable first attempt;
- no recoverable `console.error` entry is emitted;
- no SSE fallback occurs in forced `ws` mode.

### Step 4: Add an HTTP 429 `Retry-After` propagation test

In `src/test/ai-client-auth.test.ts`, add a focused HTTP error test where:

- the response status is `429`;
- the JSON body is minimal, for example `{ "error": "Rate limit exceeded." }`;
- the response includes `Retry-After: 7`.

Pin that the surfaced `AIClientError` includes:

- `code: "rate_limited"`;
- `retryAfterMs: 7000`;
- no extra retry attempt on the enhance path.

### Step 5: Add an invalid-header safety test

Add a second HTTP 429 test where `Retry-After` is invalid or non-positive.

Pin that:

- the request still surfaces `code: "rate_limited"`;
- `retryAfterMs` stays `undefined`;
- the client does not throw a parsing error.

### Step 6: Re-run the focused red-test slice

Run:

```bash
npm test -- src/test/ai-client-auth.test.ts src/test/ai-client-websocket.test.ts
```

Do not edit production code until the new assertions fail for the current
implementation.

---

## Workstream 1: Stop Surfacing Transient Failure State Before Retry

**Findings addressed:** retry-state regression, recoverable-log regression.

**Files:**

- Modify: `src/lib/ai-client.ts`
- Verify only: `src/pages/Index.tsx`
- Verify only: `src/components/CodexSessionDrawer.tsx`

### Step 1: Identify every retry branch that currently fails first

Audit `streamEnhance()` and list the branches where code currently does this
order:

1. `emitSessionUpdate(failCodexSession(...))`
2. optional `console.error(...)`
3. `if (canRetryEnhance(...)) { ... continue; }`

Cover all current call sites:

- WebSocket `outcome === "error"`
- forced-WS `outcome === "fallback"`
- SSE `terminalError`
- SSE interrupted stream
- outer `catch` block

### Step 2: Compute retry disposition before surfacing failure state

Refactor each branch so it decides whether the error is terminal before it:

- emits `failCodexSession(...)`;
- sets user-visible failure metadata;
- logs with `console.error`.

The control flow should become:

1. normalize/build the `AIClientError`;
2. ask whether the request may retry;
3. if retry is allowed, clean up and loop without emitting terminal failure UI;
4. if retry is not allowed, emit failure state and surface/log once.

### Step 3: Keep cleanup for retrying attempts, but not terminal presentation

For retry-allowed branches, keep the existing cleanup that is still needed:

- cancel `reader` when it exists;
- sleep for retry backoff;
- reset attempt-local flags;
- restore the baseline session snapshot for the next attempt.

Do **not** do these things on a retry-allowed branch:

- call `failCodexSession(...)`;
- call `onError(...)`;
- call `console.error(...)`.

### Step 4: Preserve the current retry-safety boundary

Do not loosen the existing `sawAttemptActivity` guard while fixing the failure
presentation order.

The retry gate should remain:

- recoverable network/service failures may retry only before backend-emitted
  attempt activity;
- once activity is seen, the first failed attempt is terminal.

This workstream is about when failure is surfaced, not about broadening replay.

### Step 5: Keep terminal failure semantics single-path

For branches where retry is not allowed, retain the current terminal contract:

- one failed session update;
- one `onError(...)` callback;
- one terminal log entry only if the failure is truly terminal.

Make sure the catch path does not double-emit failure after a backoff abort.

### Step 6: Verify page-level behavior against existing consumers

Re-read the current consumers after the refactor:

- `src/pages/Index.tsx` stores every `onSession` update;
- `src/components/CodexSessionDrawer.tsx` renders `status` and
  `lastErrorMessage` directly.

Confirm the upstream fix is sufficient and no UI patch is needed.

If a UI regression remains, add the smallest page-level assertion needed in a
focused test rather than changing drawer behavior ad hoc.

### Step 7: Re-run the focused transport slice

Run:

```bash
npm test -- src/test/ai-client-auth.test.ts src/test/ai-client-websocket.test.ts
```

Do not proceed until:

- retry-success flows complete without any intermediate `failed` session state;
- recoverable retries no longer log through `console.error`;
- existing timeout/replay/fallback tests stay green.

---

## Workstream 2: Propagate HTTP `Retry-After` Metadata Without Changing 429 Policy

**Findings addressed:** HTTP rate-limit hint gap, coverage drift.

**Files:**

- Modify: `src/lib/ai-client.ts`
- Modify: `src/test/ai-client-auth.test.ts`

### Step 1: Extend the HTTP error-reader shape

Update `readFunctionError()` so it can return response metadata in addition to
`message` and `code`.

Add a field for parsed retry delay, for example:

- `retryAfterMs?: number`

Keep the function backward-compatible for callers that only need `message` and
`code`.

### Step 2: Add a dedicated `Retry-After` parser

Add a small helper near the HTTP error-handling code that reads the
`Retry-After` response header and normalizes it to milliseconds.

Handle these cases explicitly:

- delta-seconds headers, for example `7`;
- optionally HTTP-date headers if cheap to support cleanly;
- empty, invalid, zero, or negative values should return `undefined`.

Do not throw from this parser.

### Step 3: Thread retry metadata through every non-OK HTTP exit

Update `postFunctionWithAuthRecovery()` so every non-OK response path carries
the parsed `retryAfterMs` into `normalizeClientError(...)`.

Cover:

- the first post-auth request failure;
- the forced-refresh retry failure;
- the publishable-key fallback failure.

### Step 4: Preserve retry metadata even when the JSON body has no error code

Right now `normalizeClientError()` only preserves `retryAfterMs` on the
`options.code` branch.

Update it so the rate-limit branch also keeps `retryAfterMs` when the client
infers `code: "rate_limited"` from status/message rather than from an explicit
payload code.

If you preserve it in other branches too, keep the logic narrow and documented.

### Step 5: Keep 429 as metadata-only, not retry-triggering

Do not change `canRetryEnhance()` as part of this workstream.

The intended behavior remains:

- 429 errors surface immediately;
- `retryAfterMs` is attached for callers/telemetry/future UX use;
- the client does not auto-retry rate limits.

### Step 6: Re-run the focused auth slice

Run:

```bash
npm test -- src/test/ai-client-auth.test.ts
```

Confirm:

- 429 responses populate `retryAfterMs` when the header is valid;
- invalid header values are ignored safely;
- no new retry attempt is introduced on 429.

---

## Workstream 3: Remove Plan and Index Drift

**Findings addressed:** plan/index drift.

**Files:**

- Modify: `docs/plans/2026-03-12-enhance-retry-regression-remediation.md`
- Modify: `docs/README.md`
- Modify: `docs/plans/2026-03-12-agent-service-hardening-remediation.md` only
  if a short cross-reference is useful after the implementation settles

### Step 1: Rewrite the active plan to match the real review baseline

Replace the stale description of already-addressed timeout/replay issues with
the findings from the current review:

- transient failed-session surfacing before retry;
- recoverable log noise;
- missing HTTP `Retry-After` propagation;
- coverage/documentation drift.

Keep the plan implementation-oriented, not as a review narrative.

### Step 2: Re-state the implementation order in the doc

Make the plan sequence match the real execution order:

1. tests first;
2. retry-state/logging fix;
3. HTTP metadata propagation;
4. docs/index cleanup and validation.

This prevents future readers from reopening already-closed timeout-budget work
instead of the current issues.

### Step 3: Update the docs index description

In `docs/README.md`, keep the same tracked plan path but change the summary text
so it describes the new scope accurately.

The index blurb should mention:

- retry-state surfacing;
- HTTP rate-limit hint propagation;
- documentation drift cleanup.

### Step 4: Decide whether the broader agent-service plan needs a note

After the code fix is ready, decide whether
`docs/plans/2026-03-12-agent-service-hardening-remediation.md` needs a short
cross-reference under streaming/retry semantics.

Only add it if it improves discoverability; do not duplicate the full plan.

### Step 5: Run the docs guardrail

Run:

```bash
npm run check:docs
```

Do not close the remediation until the rewritten plan is indexed and the docs
link check passes.

---

## Validation Sequence

Run this sequence after implementation:

1. `npm test -- src/test/ai-client-auth.test.ts src/test/ai-client-websocket.test.ts`
2. `npx eslint src/lib/ai-client.ts src/test/ai-client-auth.test.ts src/test/ai-client-websocket.test.ts`
3. `npm run check:docs`

If a page-level assertion or UI patch was needed, add the smallest relevant
test slice before closing the work.

## Manual QA

Do one manual pass in the app after code changes land:

1. Trigger an enhancement under a transient offline/network-failure condition
   that recovers before retries are exhausted.
2. Confirm the request eventually completes.
3. Confirm the Codex session drawer does not show a stale failed state or last
   error after a successful retry.
4. Trigger a hard terminal failure and confirm the drawer still shows the final
   error once the retry budget is exhausted.

## Done Criteria

This remediation is done when all of the following are true:

- recoverable retry paths no longer emit intermediate `failed` session updates;
- recoverable retry paths no longer emit misleading terminal-style
  `console.error` noise;
- HTTP 429 responses surface `AIClientError.retryAfterMs` when
  `Retry-After` is valid;
- 429 responses still do not auto-retry;
- the active 2026-03-12 remediation doc and `docs/README.md` both describe the
  current findings rather than already-closed timeout/replay work;
- focused tests and `npm run check:docs` pass.
