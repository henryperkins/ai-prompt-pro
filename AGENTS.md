# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite + React TypeScript app. Keep feature UI in `src/components/`, shared primitives in `src/components/base/primitives/` (Radix/shadcn) and UUI components in `src/components/base/`, route-level screens in `src/pages/`, reusable stateful logic in `src/hooks/`, and domain logic/helpers in `src/lib/`.  
UUI marketing components live in `src/components/marketing/`, design foundations in `src/components/foundations/`.  
Tests live in `src/test/` (Vitest).  
Mobile E2E coverage and viewport baselines live in `playwright/` (Playwright).  
Backend-adjacent code is split across `agent_service/` (Codex SDK service for prompt enhancement), `supabase/migrations/` (SQL), and `archive/supabase/functions/` (legacy Edge Function references).  
Manual QA checklists live in `docs/`.
Static assets go in `public/`; build output is `dist/` (generated, do not edit manually).

## Build, Test, and Development Commands
- `npm run dev`: start frontend dev server (Vite).
- `npm run build`: production build to `dist/`.
- `npm run preview`: serve the built app locally.
- `npm run lint`: run ESLint on `ts/tsx` sources.
- `npm test`: run Vitest once.
- `npm run test:mobile`: run Playwright mobile checks.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:rls`: run Neon RLS-focused tests.
- `npm run check:prod`: design-system gates + lint + `test:unit` + build + token-runtime check (pre-merge gate).
- `npm run agent:codex`: run local Codex SDK agent service.

## Coding Style & Naming Conventions
Use TypeScript with React function components. Follow existing formatting: 2-space indentation, semicolons, and double quotes.  
Name components in PascalCase (`PromptLibrary.tsx`), hooks as `useXxx` (`usePromptBuilder.ts`), and utility modules in lower kebab/camel-style filenames (`template-store.ts`, `text-diff.ts`).  
Prefer `@/` imports for `src/*` paths (configured in Vite/Vitest).

## Testing Guidelines
Framework: Vitest with `jsdom` and Testing Library setup from `src/test/setup.ts`.  
Test filenames should match `src/**/*.{test,spec}.{ts,tsx}` and be descriptive (for example, `persistence.test.ts`, `edge-auth.test.ts`).  
Add regression tests for behavior changes in prompt composition, persistence, auth, and RLS.
For Community mobile UX changes, also add/adjust Playwright checks in `playwright/community.mobile.spec.ts` and keep 320/375/390/428 baselines.

## Feature Flags & Telemetry
Community mobile rollout is gated by `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` (default `true` in `.env.example`).  
When this flag is enabled, mobile-specific Community behaviors are active (filter drawer, comment thread drawers, one-tap mobile notifications).  
Community mobile telemetry events are emitted via `src/lib/community-telemetry.ts` and `src/hooks/useCommunityMobileTelemetry.ts`.

## Commit & Pull Request Guidelines
Recent history mixes terse messages and scoped prefixes (for example, `ci: ...`). Prefer clear imperative commits with optional scope: `ui: improve community post card spacing`. Avoid vague messages like `up` or `Changes`.  
PRs should include: what changed, why, test commands run, screenshots for UI updates, and any env/secret impacts.

