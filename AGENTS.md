# Project Guidelines

## Architecture

- Product name is **PromptForge** (repo stays `ai-prompt-pro`). The frontend lives in `src/`; routes are wired in `src/App.tsx`; the main builder screen is `src/pages/Index.tsx`.
- Builder state flows through `src/hooks/usePromptBuilder.ts`; prompt/domain helpers live in `src/lib/`. When adding a builder context field, update `src/lib/context-types.ts`, `src/lib/prompt-builder.ts`, `src/lib/section-health.ts`, and `src/lib/template-store.ts` together.
- Persistence is dual-path in `src/lib/persistence.ts`: signed-out users use localStorage, signed-in users use Neon Data API/Auth.
- The live AI backend is `agent_service/`. `archive/supabase/functions/` is legacy/reference-only.
- Design-system feature code should import from `src/components/base/`; `src/components/base/primitives/` is internal/transitional.

## Build and Test

- Node version: `^20.19.0 || >=22.12.0`.
- Local setup: `npm install`, `cp .env.example .env`, `npm run dev` (Vite on `http://localhost:8080`).
- Core validation: `npm run lint`, `npm run test:unit`, `npm run build`.
- Pre-merge gate: `npm run check:prod`.
- Design-system gate: `npm run check:design-system`.
- Useful targeted checks: `npx vitest run src/test/persistence.test.ts`, `npm run test:mobile`.
- Local AI service: `npm run agent:codex`. `npm run test:rls` requires `NEON_AUTH_URL` + `NEON_DATA_API_URL`. GitHub RLS seeding additionally uses `NEON_DATABASE_URL` (or `DATABASE_URL`).

## Conventions

- Use TypeScript React function components, 2-space indentation, semicolons, and double quotes.
- Use the `@/` alias for `src/*` imports.
- Feature code should import design-system components from `@/components/base/*`; avoid `@/components/base/primitives/*` in app code.
- Use `cx` from `@/lib/utils/cx`; `cn` is legacy compatibility only.
- Use semantic color tokens such as `text-primary`, `bg-brand-solid`, and `border-secondary`; do not introduce raw Tailwind color scales.
- Primary icons: `@phosphor-icons/react`. UUI icons: `@untitledui/icons`.
- Persisted theme values are `default` and `midnight`; legacy `light`/`dark` values normalize to that model.
- Never hardcode environment values. Frontend AI features need `VITE_AGENT_SERVICE_URL`; cloud-backed persistence needs `VITE_NEON_DATA_API_URL` and `VITE_NEON_AUTH_URL`.

## Setup Gotchas

- Vite runs on `localhost:8080`, not `5173`. Update local origin/redirect envs accordingly; `.env.example` still contains `5173` values for `ALLOWED_ORIGINS` and `GITHUB_POST_INSTALL_REDIRECT_URL`.
- If the frontend is served over HTTPS, `VITE_AGENT_SERVICE_URL` must also be HTTPS or the browser will block mixed-content requests.
- `docs/reviews/` contains historical snapshots, not the current source of truth. `docs/archive/` is local-only and gitignored.

## Reference Docs

- `README.md` for setup and deployment overview.
- `docs/README.md` for the docs index and maintenance policy.
- `docs/design-system.md` and `docs/component-adoption.md` for design-system rules and import policy.
- `docs/builder-workflow-reference.md` for shipped builder UX terminology and review artifacts.
- `docs/github-context-reference.md` for GitHub repository-context rollout and configuration.
- `docs/neon-cutover-runbook.md` for production persistence validation and rollback.
- `agent_service/README.md` for service routes, provider configuration, and env details.
