# AI Prompt Pro

Build, enhance, and share AI prompts with a structured prompt builder, a private library, and a public community feed.

- Production: `https://prompt.lakefrontdigital.io`
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui
- Backend: Neon Postgres via Neon Data API + Neon Auth
- Optional: prompt enhancement via a local Codex SDK agent service (`agent_service/`)

## Features

- Prompt builder with guided sections, templates, and quality scoring
- Streaming enhancement (SSE or WebSocket) via `agent_service`
- Private prompt library with save/load, share/unshare, and bulk edit
- Community feed with search/filter/sort, upvotes, verified votes, comments, and remix attribution
- Prompt history/version restore and reusable presets
- Optional Community mobile UX enhancements behind `VITE_COMMUNITY_MOBILE_ENHANCEMENTS`

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
- `supabase/migrations/`: SQL migrations
- `agent_service/`: Codex SDK service for prompt enhancement
- `docs/`: specs + runbooks + QA checklists (`docs/README.md` is the index)
- `docs/reviews/`: historical point-in-time review snapshots (not operational source of truth)
- `public/`: static assets
- `dist/`: build output (generated, do not edit manually)

## Environment variables

See `.env.example` for the full list.

Key frontend vars:

- `VITE_NEON_PROJECT_ID`
- `VITE_NEON_DATA_API_URL`
- `VITE_NEON_AUTH_URL`
- `VITE_NEON_PUBLISHABLE_KEY` (optional fallback key for signed-out calls)
- `VITE_AGENT_SERVICE_URL` (required for Enhance/Extract/Infer features)
- `VITE_ENHANCE_REQUEST_TIMEOUT_MS` (optional; defaults to 90s)
- `VITE_ENHANCE_TRANSPORT` (`auto` | `sse` | `ws`)
- `VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS` (optional; defaults to 3500ms)
- `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` (feature flag)

## Deploy to Azure Static Web Apps (production)

This repo is configured for Azure Static Web Apps using:

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

- Push to `main` triggers production deployment to the linked Azure Static Web App.
- Pull requests create/update preview environments and close them when PRs are closed.

## Codex SDK Agent Service (recommended)

This project can route prompt enhancement through a Node service that uses `@openai/codex-sdk`.

1. Start the Codex service:
```sh
npm install
# Prefer `.env` for local dev, but exporting also works.
export AZURE_OPENAI_API_KEY="<your-azure-openai-api-key>"
export CODEX_CONFIG_JSON='{"model_provider":"azure","model_providers":{"azure":{"name":"Azure OpenAI","base_url":"https://<resource>.openai.azure.com/openai/v1","env_key":"AZURE_OPENAI_API_KEY","wire_api":"responses"}}}'
npm run agent:codex
```

2. Configure frontend + runtime env:
```sh
export VITE_AGENT_SERVICE_URL="http://localhost:8001"
export VITE_NEON_DATA_API_URL="https://<your-endpoint>.apirest.c-<region>.aws.neon.tech/neondb/rest/v1"
export VITE_NEON_AUTH_URL="https://<your-endpoint>.neonauth.c-<region>.aws.neon.tech/neondb/auth"
# Optional fallback key for signed-out function calls
export VITE_NEON_PUBLISHABLE_KEY="<neon-publishable-key>"
```

Optional hardening:
```sh
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Local dev note:
- If `VITE_NEON_PUBLISHABLE_KEY` (frontend) and `FUNCTION_PUBLIC_API_KEY` (service) are set, enhancement can fall back to anonymous key auth when Neon Auth is not configured.
- `ALLOW_UNVERIFIED_JWT_FALLBACK=true` enables decoded-JWT fallback only when Neon Auth config/service is unavailable.
- Use this for local development only and keep it disabled in production.

3. Run the frontend as usual:
```sh
npm run dev
```

## Agent service

The prompt enhancement backend uses `@openai/codex-sdk`. See `agent_service/README.md` for setup and configuration.

## Database rollout notes

- Migration `20260210010000_phase1_community_schema.sql` backfills `public.templates` into `public.saved_prompts`.
- During rollout, `public.templates` is intentionally retained for compatibility and rollback safety.
- Active prompt persistence paths in the app now target `public.saved_prompts`; plan a follow-up migration to drop `public.templates` after rollout validation.
