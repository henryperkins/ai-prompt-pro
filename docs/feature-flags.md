# Feature Flags Reference

Last updated: 2026-04-24

This is the canonical inventory of feature flags, experiment toggles, and
environment-driven behavior switches across the PromptForge codebase. Update
this document whenever a flag is added, removed, or has its default changed,
and cross-link from the feature's own runbook rather than re-documenting
individual flags elsewhere.

See also
[`plans/2026-04-23-feature-flag-consolidation.md`](plans/2026-04-23-feature-flag-consolidation.md)
for the completed GitHub-context flag retirement and the reasoning behind what
stays configurable.

Scope legend:

- **Frontend build-time** — `import.meta.env.VITE_*`, baked into the Vite bundle
  at build time. Flipping requires a redeploy.
- **Frontend runtime** — evaluated in the browser at load time (query param,
  `sessionStorage`, viewport, etc.). Changes without redeploy.
- **Agent service** — `process.env.*` read by `agent_service/` at boot
  (`service-runtime.mjs`, `auth.mjs`). Restart required.
- **Cloudflare worker** — Wrangler env bindings on `workers/`. Set via
  `wrangler secret put` or `wrangler deploy`.
- **Tooling / CI** — consumed by `scripts/` or CI workflows.

## Frontend build-time flags

| Flag | Default | Purpose | Consumers |
|---|---|---|---|
| `VITE_ENHANCE_TRANSPORT` | `"auto"` | Selects the enhancement transport: `auto` \| `sse` \| `ws`. `auto` prefers WS when the service advertises support and falls back to SSE. | [`src/lib/ai-client.ts`](../src/lib/ai-client.ts) |

GitHub repository-context UI is no longer gated by a frontend build-time flag.
The Builder now probes the public agent-service `/health/details` endpoint at
runtime and only shows `Add from GitHub` when
`github_context_available === true`.

## Frontend runtime experiments

| Experiment | Storage | Override | Variants | Notes |
|---|---|---|---|---|
| Hero copy A/B | `sessionStorage["promptforge:launch-exp:hero-copy"]` | Query `?exp_hero=a\|b\|control\|speed` | `control`, `speed` | Assignment is session-sticky and always runs. See [`launch-experiments.md`](launch-experiments.md) for metrics and decision rules. |

Implementation: [`src/lib/launch-experiments.ts`](../src/lib/launch-experiments.ts),
consumed by [`src/pages/Index.tsx`](../src/pages/Index.tsx).

### Always-on behaviors (no flag)

The following were previously flag-gated and are now unconditionally enabled
on the default path. Flags have been removed; noted here so reviewers do not
re-introduce them:

- Community mobile UX enhancements on mobile viewports
- Builder redesign
- Enhancement controls (primary CTA is fixed to "Enhance prompt")

## Agent service flags

All booleans pass through `normalizeBool(value, defaultValue)` in
[`agent_service/env-parse.mjs`](../agent_service/env-parse.mjs) (accepts
`true/false/1/0/yes/no/on/off`). Enum flags pass through `parseEnumEnv`.

| Flag | Default | Purpose | Location |
|---|---|---|---|
| `GITHUB_DEBUG_LOGGING` | `false` | Adds verbose structured logging for GitHub API calls, manifest builds, and rate-limit handling. | `service-runtime.mjs` |
| `CODEX_WEB_SEARCH_ENABLED` | `false` | Master toggle for the Codex SDK web-search tool at service-default level (per-request `webSearchEnabled` in thread options still overrides). Maps to the SDK's `webSearchEnabled` field. | `service-runtime.mjs` |
| `CODEX_WEB_SEARCH_MODE` | _(unset)_ | Enum: `disabled` \| `cached` \| `live`. Refines how the web-search tool behaves when enabled. Maps to the SDK's `webSearchMode` field (distinct from `webSearchEnabled`). | `service-runtime.mjs` |
| `REQUIRE_PROVIDER_CONFIG` | `false` | Fails service startup if no Codex provider config is discovered, instead of falling back to process-level defaults. | `service-runtime.mjs` |
| `STRICT_PUBLIC_API_KEY` | `true` | When `false`, accepts publishable-format keys without explicit configuration (logs a warning). Leave at default in production. | `service-runtime.mjs` |
| `TRUST_PROXY` | `false` | Enables X-Forwarded-For rate-limit resolution behind a trusted reverse proxy. | `service-runtime.mjs` |
| `ALLOW_UNVERIFIED_JWT_FALLBACK` | `false` | Permits falling back to unverified JWT claims when JWKS validation is unavailable. Development aid; must stay `false` in production. | `auth.mjs` |
| `ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION` | `false` | Explicit escape hatch to allow the unverified fallback even when `NODE_ENV=production`. Never enable unless triaging a live incident. | `auth.mjs` |

See [`agent_service/README.md`](../agent_service/README.md) for related
non-flag configuration (`CODEX_SANDBOX_MODE`, `CODEX_APPROVAL_POLICY`,
`CODEX_MODEL_REASONING_EFFORT`, etc.).

GitHub repository context no longer uses a dedicated env flag. Availability is
derived from the presence of the required GitHub App + storage config and
active-session validation, then surfaced via `/health/details` as
`github_context_available`.

## Cloudflare worker flags

| Flag | Default | Purpose | Location |
|---|---|---|---|
| `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` | _(unset)_ | Presence enables self-service password reset delivery via the email worker. When unset, the auth worker disables reset flows and the UI routes users to support. | [`workers/auth/index.ts`](../workers/auth/index.ts) |
| `PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN` | _(unset)_ | Shared-secret header sent with password-reset webhook requests. Set alongside the URL. | [`workers/auth/index.ts`](../workers/auth/index.ts) |

See [`migration-neon-to-cloudflare.md`](migration-neon-to-cloudflare.md) for
worker deployment details.

## Tooling and CI flags

| Flag | Default | Purpose | Location |
|---|---|---|---|
| `STRICT_DOC_DATES` | _(unset)_ | When `"1"`, `npm run check:docs` treats missing `Last updated:` lines in active operational docs as fatal instead of warnings. Enable in CI jobs that should fail on missing freshness dates. | [`scripts/check-docs-freshness.mjs`](../scripts/check-docs-freshness.mjs) |
| `STRICT_PRIMITIVE_IMPORTS` | _(unset)_ | When `"1"`, `check:no-primitive-ds-imports` fails CI on direct primitive imports. Enabled in `check:prod`. | [`scripts/check-no-primitive-ds-imports.mjs`](../scripts/check-no-primitive-ds-imports.mjs) |

## Ownership and lifecycle

- **Add a flag** — land it with a default that preserves current behavior,
  document it here, and link from the owning feature's runbook (not the other
  way around).
- **Flip a default** — update this table in the same change, call it out in
  the PR description, and update `.env.example` where applicable.
- **Retire a flag** — remove the code path, delete the row from this table,
  and move a short note to the "Always-on behaviors" section above so the
  flag does not get re-introduced.

## Related references

- [`README.md`](../README.md) — frontend environment and deployment overview.
- [`agent_service/README.md`](../agent_service/README.md) — full agent service
  env reference.
- [`github-context-reference.md`](github-context-reference.md) — GitHub
  context rollout and configuration.
- [`launch-experiments.md`](launch-experiments.md) — live experiment
  definitions, metrics, and decision rules.
- [`migration-neon-to-cloudflare.md`](migration-neon-to-cloudflare.md) —
  worker deployment and secret management.
