# GitHub Context Reference

Last updated: 2026-04-24

> Status: Active operational reference for PromptForge GitHub repository context.

## Purpose

Document the shipped GitHub repository-context flow, required configuration, and
the guardrails around storage, sharing, and cache invalidation.

## Availability model

- Frontend: no dedicated `VITE_` flag. The Builder probes
  `/health/details` and exposes `Add from GitHub` only when
  `github_context_available=true`.
- Agent service: GitHub context becomes available when the required GitHub App,
  storage, and session-validation config is present.
- Database: apply `supabase/migrations/20260316010000_github_context_schema.sql`

The Builder only exposes `Add from GitHub` when the runtime capability probe
reports GitHub context as available. The service routes stay unavailable unless
the complete GitHub App/storage/session-validation configuration is present.

## Required runtime configuration

Frontend:

- `VITE_AGENT_SERVICE_URL`
- `VITE_AUTH_WORKER_URL`

Agent service:

- `AUTH_SESSION_VALIDATION_URL` (recommended for worker-issued PromptForge sessions)
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_POST_INSTALL_REDIRECT_URL`
- `ALLOWED_ORIGINS` as an explicit list if you want origin-scoped setup redirects
- `GITHUB_DEBUG_LOGGING` only for short-lived GitHub storage debugging
- `NEON_DATABASE_URL` or `DATABASE_URL`

Legacy compatibility:

- `NEON_AUTH_URL` / `NEON_JWKS_URL` can still provide bearer validation, but the
  active frontend auth path now comes from the worker-issued PromptForge session.

For local PromptForge development, set both `ALLOWED_ORIGINS` and
`GITHUB_POST_INSTALL_REDIRECT_URL` to `http://localhost:8080`.

## Builder flow

1. Sign in to PromptForge.
2. Open `Show advanced controls` if needed, then open `Context and sources`.
3. Choose `Add from GitHub` once the runtime capability probe marks GitHub
   context as available.
4. Install or reuse the PromptForge GitHub App installation.
5. Pick a repository, connect it, search files, preview content, and attach the
   selected files as context sources.

Attached GitHub files count toward the shared builder source cap.

## Security and product constraints

- Repository routes accept signed-in PromptForge user sessions only. They do not
  allow publishable-key fallback or service-token fallback.
- `GET /github/app/setup` uses signed setup-state validation instead of normal
  user auth.
- `POST /github/webhooks` uses GitHub webhook-signature validation instead of
  normal user auth.
- Post-install redirects only rewrite onto the request origin when that origin
  is explicitly listed in `ALLOWED_ORIGINS`. Wildcard or unset CORS falls back
  to `GITHUB_POST_INSTALL_REDIRECT_URL`.
- GitHub-backed prompts cannot be publicly shared. The frontend and database
  both enforce the user-facing message: `Remove GitHub sources before sharing this prompt.`
- `github_setup_states` stays service-only; end-user clients cannot read it via RLS.

## Storage and invalidation model

The rollout adds four tables:

- `github_installations`
- `github_repo_connections`
- `github_repo_manifest_cache`
- `github_setup_states`

Webhook events invalidate cached manifests and repo access state:

- `push`: invalidate affected repo manifests
- `installation`: mark installations deleted, suspended, or reactivated
- `installation_repositories`: revoke/reactivate repo connections and invalidate
  affected manifests

## Verification

Run the targeted suites that cover the feature:

```sh
npx vitest run src/test/service-auth.test.ts src/test/github-client.test.ts src/test/agent-service-github-routing.test.ts src/test/agent-service-github-webhooks.test.ts src/test/persistence.test.ts src/test/context-source-expansion.test.ts src/test/enhance-context-sources.test.ts
npx vitest run src/test/rls-github-context.test.ts
npx playwright test playwright/builder.desktop.spec.ts -g "GitHub repository files"
```

Use `npm run build` before merge to catch Vite/env regressions.
