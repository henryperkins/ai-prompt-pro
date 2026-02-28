# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite + React TypeScript app (product name: **PromptForge**, repo: `ai-prompt-pro`). Keep feature UI in `src/components/`, shared primitives in `src/components/base/primitives/` (Radix/shadcn) and UUI components in `src/components/base/`, UUI application components in `src/components/application/` (activity-feeds, code-snippet, lists, progress-steps, tables), route-level screens in `src/pages/`, reusable stateful logic in `src/hooks/`, and domain logic/helpers in `src/lib/`.  
UUI marketing components live in `src/components/marketing/`, design foundations in `src/components/foundations/`.  
PromptForge fantasy theme components live in `src/components/fantasy/`, with design tokens in `warcraft/`.  
Community feature components live in `src/components/community/`.  
Icon components in `src/components/icons/`.  
Tests live in `src/test/` (Vitest).  
Mobile E2E coverage and viewport baselines live in `playwright/` (Playwright).  
Backend-adjacent code is split across `agent_service/` (Codex SDK service for prompt enhancement), `supabase/migrations/` (SQL), and `archive/supabase/functions/` (legacy Edge Function references).  
Manual QA checklists and specs live in `docs/`.  
Design-system lint gates live in `scripts/` (legacy-import checks, legacy-ds-props, primitive-ds-imports, Phosphor-icon guardrails, token-runtime drift, docs-freshness).  
Static assets go in `public/`; build output is `dist/` (generated, do not edit manually).  
Storybook config in `.storybook/` for component development.  
Styles in `src/styles/` (`globals.css`, `theme.css`, `typography.css`, `untitled-compat.css`, `promptforge-fantasy.css`).

## Build, Test, and Development Commands
- `npm run dev`: start frontend dev server (Vite, `localhost:8080`).
- `npm run build`: production build to `dist/`.
- `npm run preview`: serve the built app locally.
- `npm run lint`: run ESLint on `ts/tsx` sources.
- `npm test`: run Vitest once.
- `npm run test:unit`: Vitest excluding RLS integration tests (used by check:prod).
- `npm run test:mobile`: run Playwright mobile checks.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:rls`: run Neon RLS-focused tests (requires `NEON_SERVICE_ROLE_KEY`).
- `npm run check:prod`: docs-freshness + design-system gates + lint + `test:unit` + build + token-runtime check (pre-merge gate).
- `npm run check:design-system`: build + all design-system lint gates.
- `npm run agent:codex`: run local Codex SDK agent service.

## Coding Style & Naming Conventions
Use TypeScript with React function components. Follow existing formatting: 2-space indentation, semicolons, and double quotes.  
Name components in PascalCase (`PromptLibrary.tsx`), hooks as `useXxx` (`usePromptBuilder.ts`), and utility modules in lower kebab-case filenames (`template-store.ts`, `text-diff.ts`).  
Prefer `@/` imports for `src/*` paths (configured in Vite/Vitest).  
Primary icon library: `@phosphor-icons/react`. UUI icons: `@untitledui/icons`.  
Use semantic color tokens (`text-primary`, `bg-brand-solid`, `border-secondary`) — never raw Tailwind color scales.  
Use `cx()` from `@/lib/utils/cx` for UUI components; `cn()` from `@/lib/utils` for legacy shadcn (being removed).

## Testing Guidelines
Framework: Vitest with `jsdom` and Testing Library setup from `src/test/setup.ts`.  
Test filenames should match `src/**/*.{test,spec}.{ts,tsx}` and be descriptive (for example, `persistence.test.ts`, `edge-auth.test.ts`).  
Add regression tests for behavior changes in prompt composition, persistence, auth, and RLS.  
For Community mobile UX changes, also add/adjust Playwright checks in `playwright/community.mobile.spec.ts` and keep 320/375/390/428 baselines.

## Feature Flags & Telemetry
Community mobile rollout is gated by `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` (default `true`).  
When this flag is enabled, mobile-specific Community behaviors are active (filter drawer, comment thread drawers, one-tap mobile notifications).  
Community mobile telemetry events are emitted via `src/lib/community-telemetry.ts` and `src/hooks/useCommunityMobileTelemetry.ts`.  
Builder redesign phases: `VITE_BUILDER_REDESIGN_PHASE{1..4}` (all default `true`).  
Launch experiments: `VITE_LAUNCH_EXPERIMENT_HERO_COPY`, `VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA`.  
Feature flag implementation in `src/lib/feature-flags.ts`.

## Commit & Pull Request Guidelines
Recent history mixes terse messages and scoped prefixes (for example, `ci: ...`). Prefer clear imperative commits with optional scope: `ui: improve community post card spacing`. Avoid vague messages like `up` or `Changes`.  
PRs should include: what changed, why, test commands run, screenshots for UI updates, and any env/secret impacts.

