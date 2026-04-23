# Feature Flag Consolidation Plan

Last updated: 2026-04-23

## Scope

Investigate every flag inventoried in
[`../feature-flags.md`](../feature-flags.md) and classify whether it is a
removable feature gate (collapse to always-on), a legitimate configuration
knob that must stay, or a live product experiment that requires a PM decision
before retirement. Then execute the safe collapses and document the rest so
the "configuration chaos" decreases monotonically with each sweep.

## Classification summary

| Flag | Class | Action |
|---|---|---|
| `VITE_GITHUB_CONTEXT_ENABLED` + `GITHUB_CONTEXT_ENABLED` | Paired feature gate; redundant with presence of required config | Collapse with transitional shape (see Plan A below) |
| `CODEX_WEB_SEARCH_ENABLED` + `CODEX_WEB_SEARCH_MODE` | Two distinct Codex SDK options (`webSearchEnabled` + `webSearchMode`), not truly redundant | **Keep both** — documentation clarification only |
| Hero copy A/B (`exp_hero`, `promptforge:launch-exp:hero-copy`) | Live experiment | **Product decision required** — see "Experiment retirement" |
| `STRICT_DOC_DATES` | CI strictness toggle | Leave as-is; `check:prod` already enables it |
| `STRICT_PRIMITIVE_IMPORTS` | CI strictness toggle | Leave as-is; `check:prod` already enables it |
| `VITE_ENHANCE_TRANSPORT` | Mode selector (`auto`/`sse`/`ws`), defaults to smart `auto` | **Keep** — not a feature flag; `auto` already does the right thing |
| `GITHUB_DEBUG_LOGGING` | Diagnostic verbosity | **Keep** — diagnostic toggle, default off is correct |
| `REQUIRE_PROVIDER_CONFIG` | Startup strictness | **Keep** — flipping to true by default breaks local dev without `CODEX_CONFIG_JSON` |
| `STRICT_PUBLIC_API_KEY` | Security strictness, **already default true** | **Keep** — defensive escape hatch |
| `TRUST_PROXY` | Deployment topology | **Keep** — must stay `false` by default; X-Forwarded-For is spoofable by direct clients |
| `ALLOW_UNVERIFIED_JWT_FALLBACK` + `_IN_PRODUCTION` | Security escape hatches | **Keep** — flipping to true would be a security regression |
| `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` + `_TOKEN` | Integration URL/secret | **Keep** — value-based config, presence correctly toggles behavior |

Net: **2 genuinely redundant feature flags** (+ their paired CI env vars in
workflows/tests) are candidates for removal. The rest are either legitimate
deployment/security configuration or product experiments.

## Plan A — GitHub context flag (biggest impact, needs care)

### Progress

- [x] **Phase 1 — backend capability derivation.** `github_context_configured`
  / `github_context_available` now exist in runtime health/readiness, and all
  GitHub routes fail uniformly when the deployment is misconfigured.
- [x] **Phase 2 — frontend capability probe.** The frontend no longer reads
  `VITE_GITHUB_CONTEXT_ENABLED`; it probes `/health/details` at app bootstrap
  and keeps `GitHubSourcePickerDialog` lazy-mounted.
- [x] **Phase 3 — retire the backend flag.** `GITHUB_CONTEXT_ENABLED` is gone
  from env/docs/tests/CI. GitHub availability now derives from config
  presence, and deployment workflows validate complete GitHub secret sets
  instead of toggling a separate boolean.

### Why the naive "always-on" collapse is unsafe

Rubber-duck audit surfaced these blockers for a straightforward removal:

1. **Store-only handlers don't assert app config.**
   `GET /github/installations` and `GET /github/connections` are backed by the
   Neon store alone and never call `assertAppConfigured()`. With the flag
   removed and `DATABASE_URL` present but GitHub App creds missing, these
   routes would return `200 []` instead of `503`, producing a half-working
   picker UI (lists nothing, Connect button 503s).
2. **`AUTH_SESSION_VALIDATION_URL` is independently required.** The GitHub
   routes run under `requireActiveSession: true`. A config-presence check that
   excludes this URL would be a false positive for readiness.
3. **`GitHubSourcePickerDialog` calls `useAuth()`.** Always-mounting the
   dialog breaks tests/stories that render `Index` outside `AuthProvider`.
4. **Setup + webhook routes use custom auth**, so the "user JWT + active
   session" security story doesn't apply uniformly to all 11 GitHub routes.
5. **Test harnesses hardcode `GITHUB_CONTEXT_ENABLED=false`** in
   `vitest.config.ts`, `playwright.config.ts`, and
   `src/test/helpers/agent-service-harness.ts`. Tests for the "disabled"
   behavior class (404 `github_context_disabled`) would need rewriting, not
   just env flipping.

### Safer transitional shape

1. **Backend — remove the env var, derive capability.** Replace
   `githubConfig.enabled` with two computed booleans:
   - `github_context_configured` = all of `appId`, `appPrivateKey`, `appSlug`,
     `stateSecret`, `webhookSecret`, `postInstallRedirectUrl`, `databaseUrl`
     are set.
   - `github_context_available` = `configured && activeSessionValidationConfigured`.
2. **Backend — consistent gating.** Audit every handler in
   `agent_service/github-routes.mjs`. Every route (including store-only
   `installations`/`connections` and the unauth `setup`/`webhook`) calls
   either `assertAppConfigured()` or the new `assertContextAvailable()` so
   misconfigured deployments return `503` uniformly.
3. **Backend — readiness honors availability.** `/ready` stays green only
   when `github_context_available === true`. Deployments that genuinely don't
   want GitHub can omit the config and accept the readiness warning; there is
   no `enabled=false` knob.
4. **Frontend — remove `VITE_GITHUB_CONTEXT_ENABLED`**. Replace the compile-
   time constant with a small capability probe:
   - Fetch `/health/details` once at app bootstrap (or expose a new
     `/capabilities` endpoint) and expose `capabilities.github_context` via a
     React context.
   - `Index.tsx` branches on the capability; the picker CTA and dialog render
     only when `capabilities.github_context === true`.
   - Keep `GitHubSourcePickerDialog` lazy-mounted (render only while open) so
     tests without `AuthProvider` keep working.
5. **Kill-switch preserved as last resort.** Introduce a single backend
   override `GITHUB_CONTEXT_DISABLED=true` (opt-out, not opt-in). Default is
   "available when configured." This replaces the two coupled `_ENABLED`
   flags with one narrow emergency switch and avoids the frontend/backend
   split brain. If not needed operationally, drop even this.
6. **Tests — audit by behavior class, not env var**:
   - App-config-required routes → assert `503 github_config_unavailable` when
     creds missing (today's path already exists).
   - Store-only routes → assert `503` when config incomplete (new assertion).
   - Readiness → snapshot now reflects capability derivation.
   - Frontend Index render-without-auth tests → still pass because dialog is
     lazy-mounted.

This is an ~8–10 file change across `agent_service/`, `src/lib/`,
`src/pages/Index.tsx`, test harnesses, workflows, docs, and `.env.example`.
Worth doing, but not as a drive-by.

## Plan B — Web search flag clarification (no code change)

Initial reading suggested `CODEX_WEB_SEARCH_ENABLED` and
`CODEX_WEB_SEARCH_MODE` were redundant. Deeper inspection of
`agent_service/codex_service.mjs` shows they are in fact two separate Codex
SDK thread-option fields: `webSearchEnabled` (the master toggle) and
`webSearchMode` (the sub-behavior). Line 572 (`delete
executionPreflightThreadOptions.webSearchMode;`) and the explicit
`webSearchEnabled: false` overrides at lines 423 and 562 without touching
`webSearchMode` confirm the SDK treats them independently.

**Action:** no collapse. Update `docs/feature-flags.md` and
`agent_service/README.md` to state the relationship explicitly:
`_ENABLED` is the master toggle; `_MODE` refines behavior when enabled.

## Experiment retirement (Hero copy A/B)

Forcing this experiment on-by-default means picking a winner between the
`control` ("Turn rough ideas into quality prompts with context") and `speed`
("Ship quality prompts faster with grounded context") variants. The decision
rules in [`../launch-experiments.md`](../launch-experiments.md) require a
metric-based call:

- ≥ 5% relative lift in `builder_enhance_clicked` per `builder_loaded`
- No guardrail regression > 2%
- Minimum sample: 1,000 builder sessions per variant

Until those metrics are reviewed, unilaterally picking a variant is out of
scope for flag-cleanup work. **Deferred** pending PM + metrics review. When
retired, remove `src/lib/launch-experiments.ts`, the `exp_hero` query
handling, `promptforge:launch-exp:hero-copy` storage, and the
`HeroCopyVariant` type; fold the winning copy into `brand-copy.ts`.

## Execution order (recommended)

1. **Now — documentation clarifications.** Update `docs/feature-flags.md`
   and `agent_service/README.md` to describe `CODEX_WEB_SEARCH_ENABLED` vs
   `CODEX_WEB_SEARCH_MODE` as two SDK options, not one.
2. **Done — Plan A Phase 1 (backend capability derivation).** Introduce the
   computed `github_context_configured` / `_available` booleans and make all
   handlers consistently assert config. `GITHUB_CONTEXT_ENABLED` still read
   but its default becomes `true` when configured. Ships behind the existing
   flag, so no UX change.
3. **Done — Plan A Phase 2 (frontend capability probe).** Replace
   `VITE_GITHUB_CONTEXT_ENABLED` with a `/capabilities` probe + React
   context. Lazy-mount `GitHubSourcePickerDialog`.
4. **Done — Plan A Phase 3 (retire the flag).** Delete
   `GITHUB_CONTEXT_ENABLED`/`VITE_GITHUB_CONTEXT_ENABLED` from env, CI,
   tests, docs. Add optional `GITHUB_CONTEXT_DISABLED` opt-out only if an
   operational need emerges.
5. **Later — hero copy A/B retirement** after metrics call.

## Non-goals

- **Do not** flip security defaults (`STRICT_PUBLIC_API_KEY`,
  `ALLOW_UNVERIFIED_JWT_FALLBACK*`, `TRUST_PROXY`) to permissive-by-default.
  These are defensive knobs, not feature flags.
- **Do not** make `REQUIRE_PROVIDER_CONFIG=true` the default; it breaks local
  dev without `CODEX_CONFIG_JSON`.
- **Do not** make `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` "always-on"; it's a
  URL, and presence is the correct signal.
- **Do not** remove `VITE_ENHANCE_TRANSPORT`; it's a debugging/mode selector
  that already defaults to the correct smart value.
