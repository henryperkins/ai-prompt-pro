# PromptForge

Build, enhance, and share AI prompts with a structured prompt builder, a private library, and a public community feed.

- Production: `https://prompt.lakefrontdigital.io`
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui
- Backend: Cloudflare Pages + Cloudflare Workers + D1/KV
- Optional: prompt enhancement via a local Codex SDK agent service (`agent_service/`)
- Legacy compatibility: Neon/Postgres remains in selected migration and GitHub-context storage paths until those are fully retired.

## Features

- Prompt builder with guided sections, templates, and quality scoring
- Streaming enhancement (SSE or WebSocket) via `agent_service`
- Optional GitHub repository context for signed-in builders (GitHub App-backed, non-shareable)
- Private prompt library with save/load, share/unshare, and bulk edit
- Community feed with search/filter/sort, upvotes, verified votes, comments, and remix attribution
- Prompt history/version restore and reusable presets
- Community mobile UX enhancements enabled by default

## Local development

1. Install dependencies:

```sh
npm install
```

2. Configure environment:

```sh
cp .env.example .env
```

3. Start the dev server:

```sh
npm run dev
```

The frontend Vite app runs at `http://localhost:8080`.

## Common commands

- `npm run dev`: start frontend dev server (Vite)
- `npm run build`: production build to `dist/`
- `npm run preview`: serve the built app locally
- `npm run lint`: run ESLint on `ts/tsx` sources
- `npm test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run test:mobile`: run Playwright mobile checks
- `npm run test:rls`: run Neon RLS-focused tests
- `npm run check:prod`: design-system gates + lint + `test:unit` + build + token-runtime check (pre-merge gate)
- `npm run agent:codex`: run local Codex SDK agent service

## Project structure

- `src/`: Vite + React TypeScript app
- `src/components/`: feature UI components
- `src/components/base/`: Untitled UI core components + Radix primitives
- `src/pages/`: route-level screens
- `src/hooks/`: reusable stateful logic
- `src/lib/`: domain logic/helpers
- `src/test/`: Vitest tests
- `playwright/`: Playwright mobile E2E coverage + viewport baselines
- `archive/supabase/functions/`: archived legacy Edge functions (reference only)
- `supabase/migrations/`: legacy Postgres migrations; GitHub context still uses the GitHub-context migration while that service storage remains Postgres-backed
- `workers/`: Cloudflare Workers backend for auth, API persistence, and email delivery
- `agent_service/`: Codex SDK service for prompt enhancement
- `docs/`: specs + runbooks + QA checklists (`docs/README.md` is the index)
- `docs/reviews/`: historical point-in-time review snapshots (not operational source of truth)
- `public/`: static assets
- `dist/`: build output (generated, do not edit manually)

## Environment variables

See `.env.example` for the full list.

Key frontend vars:

- `VITE_AUTH_WORKER_URL`
- `VITE_API_WORKER_URL`
- `VITE_AGENT_SERVICE_URL` (required for Enhance/Extract/Infer features)
- `VITE_AGENT_PUBLIC_API_KEY` (optional fallback key for signed-out agent calls)
- `VITE_ENHANCE_REQUEST_TIMEOUT_MS` (optional; unset by default, set a positive ms value to enable a client-side enhance timeout)
- `VITE_ENHANCE_TRANSPORT` (`auto` | `sse` | `ws`)
- `VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS` (optional; defaults to 3500ms)

For the full inventory of feature flags (frontend build-time, runtime
experiments, agent service booleans, worker toggles, and CI gates), see
[`docs/feature-flags.md`](docs/feature-flags.md).

## GitHub repository context (optional)

PromptForge can attach repository files as Builder context through a GitHub App
backed flow.

- The Builder automatically shows `Add from GitHub` only when the public
  agent-service `/health/details` response reports
  `github_context_available=true`.
- Keep browser auth pointed at the worker via `VITE_AUTH_WORKER_URL`.
- Configure the service with `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_APP_SLUG`, `GITHUB_APP_STATE_SECRET`, `GITHUB_WEBHOOK_SECRET`,
  `GITHUB_POST_INSTALL_REDIRECT_URL`, `NEON_DATABASE_URL`
  (or `DATABASE_URL`), and `AUTH_SESSION_VALIDATION_URL`.
- For local PromptForge development, use `http://localhost:8080` for both
  `ALLOWED_ORIGINS` and `GITHUB_POST_INSTALL_REDIRECT_URL`.
- Apply `supabase/migrations/20260316010000_github_context_schema.sql` to the
  Postgres database used by `NEON_DATABASE_URL` / `DATABASE_URL` before enabling
  the feature outside local development.
- GitHub-backed prompts cannot be shared publicly. The Builder blocks share
  attempts and the database enforces the same rule.

See `docs/github-context-reference.md` for the active rollout guide and
`agent_service/README.md` for the backend routes/configuration.

## Deploy to Cloudflare Pages (production frontend)

This repo now ships the public frontend via Cloudflare Pages using:

- Workflow: `.github/workflows/cloudflare-pages.yml`

Required GitHub repository secrets include:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_AUTH_WORKER_URL`
- `VITE_API_WORKER_URL`
- `VITE_AGENT_SERVICE_URL`
- `VITE_AGENT_PUBLIC_API_KEY` (or legacy `VITE_NEON_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`)

The current Cloudflare Worker serves both `/auth/*` and `/api/*`, so
`VITE_AUTH_WORKER_URL` and `VITE_API_WORKER_URL` may point to the same worker
base URL.

## Deploy to Azure Static Web Apps (legacy/manual path)

The Azure Static Web Apps workflow is retained only as a legacy/manual rollback
path. The active public frontend deploy is Cloudflare Pages.

- Workflow: `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
- SWA CLI config: `swa-cli.config.json`
- Runtime routing/security config: `public/staticwebapp.config.json`

Required GitHub repository secrets:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_DUNE_075B4710F`
- `VITE_NEON_PROJECT_ID`
- `VITE_NEON_DATA_API_URL`
- `VITE_NEON_AUTH_URL`
- `VITE_NEON_PUBLISHABLE_KEY`
- `VITE_AGENT_SERVICE_URL`

Deployment flow:

```sh
# Validate production build locally
npm run build

# Optional: preview SWA packaging locally
npm run swa:build
npm run swa:start

# Manual production deploy (if needed outside CI)
npm run swa:deploy:dry-run
npm run swa:deploy
```

CI/CD flow:

- Azure SWA deploys only from manual `workflow_dispatch`.
- Pushes to `main` and pull-request previews use `.github/workflows/cloudflare-pages.yml`.

## Codex SDK Agent Service (recommended)

This project can route prompt enhancement through a Node service that uses `@openai/codex-sdk`.

1. Start the Codex service:

```sh
npm install
# Prefer `.env` for local dev, but exporting also works.
export OPENAI_API_KEY="<your-openai-api-key>"
export CODEX_MODEL="gpt-5.4-mini"
npm run agent:codex
```

2. Configure frontend + runtime env:

```sh
export VITE_AGENT_SERVICE_URL="http://localhost:8001"
export VITE_AUTH_WORKER_URL="http://localhost:8787"
export VITE_API_WORKER_URL="http://localhost:8787"
# Optional fallback key for signed-out agent-service calls
export VITE_AGENT_PUBLIC_API_KEY="<publishable-agent-key>"
export FUNCTION_PUBLIC_API_KEY="<same-publishable-agent-key>"
```

Optional hardening:

```sh
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Local dev note:

- If `VITE_AGENT_PUBLIC_API_KEY` (frontend) and `FUNCTION_PUBLIC_API_KEY` (service) are set, enhancement can fall back to anonymous key auth when user-session auth is not configured. Legacy `VITE_NEON_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` names are still accepted for older deployments.
- `ALLOW_UNVERIFIED_JWT_FALLBACK=true` enables decoded-JWT fallback only when Neon Auth config/service is unavailable.
- Use this for local development only and keep it disabled in production.

### Deploy the agent outside Azure

The recommended Azure App Service replacement is DigitalOcean App Platform,
with a Droplet + Docker fallback if staging shows managed-platform limits for
long SSE or WebSocket sessions. The current agent service is a long-running
Node HTTP server with SSE and WebSocket routes, so a container host is a better
fit than a direct edge-function port.

- Container: `Dockerfile.agent`
- App Platform spec: `.do/app.yaml`
- Manual deployment workflow: `.github/workflows/digitalocean-agent.yml`
- Migration plan: `docs/plans/2026-04-24-agent-service-azure-exit.md`

After DigitalOcean is healthy, set the Cloudflare Pages secret
`VITE_AGENT_SERVICE_URL` to the DigitalOcean app URL or custom domain and rerun
the Pages workflow.

3. Run the frontend as usual:

```sh
npm run dev
```

## Agent service

The prompt enhancement backend uses `@openai/codex-sdk`. See `agent_service/README.md` for setup and configuration.

## Legacy Postgres rollout notes

- Migration `20260210010000_phase1_community_schema.sql` backfills `public.templates` into `public.saved_prompts`.
- Migration `20260316010000_github_context_schema.sql` adds GitHub installation,
  repo-connection, manifest-cache, and setup-state storage plus GitHub share guards.
- Prompt CRUD, draft, version, and community persistence now use the Cloudflare Worker API/D1 path in `src/lib/cf-persistence.ts`.
- Keep these Postgres notes for GitHub-context storage and rollback compatibility until the remaining Postgres-backed paths are migrated or removed.
