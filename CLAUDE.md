# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Prompt Pro - Build, enhance, and share AI prompts with a structured prompt builder, a private library, and a public community feed.

- Production: `https://prompt.lakefrontdigital.io`
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui
- Backend: Neon Postgres via Neon Data API + Neon Auth
- Optional: prompt enhancement via local Codex SDK agent service (`agent_service/`)

## Common Commands

```sh
npm run dev              # Start frontend dev server (Vite)
npm run build            # Production build to dist/
npm run preview          # Serve built app locally
npm run lint             # Run ESLint on ts/tsx sources
npm test                 # Run Vitest once
npm run test:watch       # Run Vitest in watch mode
npm run test:mobile     # Run Playwright mobile E2E checks
npm run test:rls        # Run Supabase RLS-focused tests
npm run check:prod      # lint + tests + build (pre-merge gate)
npm run agent:codex     # Run local Codex SDK agent service
```

Run a single test file:
```sh
npx vitest run src/test/persistence.test.ts
```

## Architecture

### Frontend (Vite + React + TypeScript)
- Entry point: `src/pages/Index.tsx` → uses `usePromptBuilder` hook to manage prompt config, templates, and versions.
- `usePromptBuilder` is composed from `useContextConfig` (context field updaters), `useDraftPersistence` (dirty state / autosave), plus pure helpers in `prompt-builder-cache.ts` and `prompt-builder-remix.ts`.
- Prompt composition and quality scoring: `src/lib/prompt-builder.ts` (`buildPrompt`, `scorePrompt`) and `src/lib/section-health.ts` (`getSectionHealth`).
- Context field types and defaults live in `src/lib/context-types.ts`.

### Persistence (dual-path)
- `src/lib/persistence.ts`: authenticated users → Neon Data API (PostgREST); signed-out users → localStorage.
- Template snapshots and normalization: `src/lib/template-store.ts`.
- Config schema versioning: `src/lib/prompt-config-adapters.ts` handles V1 ↔ V2 hydration/serialization.
- Database migrations in `supabase/migrations/`.

### Agent service
- `agent_service/codex_service.mjs`: Node service using `@openai/codex-sdk` that streams SSE deltas for prompt enhancement.
- Frontend calls it via `streamEnhance` / `extractUrl` in `src/lib/ai-client.ts`.

### Auth
- Neon Auth (Better Auth) via `@neondatabase/neon-js` – initialized in `src/integrations/neon/client.ts`.
- Auth context provided by `src/hooks/useAuth.tsx`.

## Key Directories

- `src/components/`: feature UI components
- `src/components/ui/`: shared shadcn/ui primitives (Radix-based)
- `src/pages/`: route-level screens
- `src/hooks/`: reusable stateful logic
- `src/lib/`: domain logic/helpers (prompt-builder, persistence, ai-client, etc.)
- `src/test/`: Vitest tests
- `playwright/`: Playwright mobile E2E coverage + viewport baselines
- `supabase/migrations/`: SQL migrations
- `agent_service/`: Codex SDK service for prompt enhancement
- `docs/`: specs and runbooks

## Feature Flags

- `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` - gates mobile-specific Community behaviors (filter drawer, comment thread drawers)
- `VITE_BUILDER_REDESIGN_PHASE{1..4}` - builder redesign phases
- Feature flag implementation in `src/lib/feature-flags.ts`

## Coding Conventions

- Use `@/` path alias for all `src/` imports (configured in Vite, Vitest, and tsconfig)
- TypeScript with React function components; 2-space indent, semicolons, double quotes
- Component files: PascalCase (`PromptLibrary.tsx`)
- Hooks: `useXxx` (`usePromptBuilder.ts`)
- Utilities: kebab-case (`template-store.ts`)
- Test files: `{module}.test.ts(x)` in `src/test/`

## Environment Variables

Key frontend vars (see `.env.example` for full list):
- `VITE_NEON_PROJECT_ID`, `VITE_NEON_DATA_API_URL`, `VITE_NEON_AUTH_URL`
- `VITE_AGENT_SERVICE_URL` (required for Enhance/Extract/Infer features)
- `VITE_ENHANCE_TRANSPORT` (`auto` | `sse` | `ws`)

## Deployment

- Azure Static Web Apps via `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
- SWA CLI config: `swa-cli.config.json`
- Runtime routing: `public/staticwebapp.config.json`
