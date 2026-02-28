# Copilot instructions for ai-prompt-pro

## Build, test, and lint

```sh
npm run dev            # Vite dev server (localhost:8080)
npm run build          # production build
npm run lint           # ESLint
npm test               # Vitest (all suites, once)
npm run test:unit      # Vitest excluding RLS integration tests (used by check:prod)
npm run test:watch     # Vitest in watch mode
npm run check:prod     # docs-freshness + design-system gates + lint + test:unit + build + token-runtime check
npm run check:design-system  # build + all design-system lint gates
```

Run a single test file:
```sh
npx vitest run src/test/persistence.test.ts
```

Run a single test by name:
```sh
npx vitest run -t "saves draft to localStorage"
```

Playwright mobile E2E:
```sh
npm run test:mobile
```

RLS integration tests (require `NEON_SERVICE_ROLE_KEY`):
```sh
npm run test:rls
```

## Architecture

### Frontend (Vite + React + TypeScript)
- Product name: **PromptForge** (repo remains `ai-prompt-pro`). Brand copy locked in `src/lib/brand-copy.ts`.
- Entry point: `src/pages/Index.tsx` → uses `usePromptBuilder` hook to manage prompt config, templates, and versions.
- `usePromptBuilder` is composed from `useContextConfig` (context field updaters), `useDraftPersistence` (dirty state / autosave), plus pure helpers in `prompt-builder-cache.ts` and `prompt-builder-remix.ts`.
- Prompt composition and quality scoring: `src/lib/prompt-builder.ts` (`buildPrompt`, `scorePrompt`) and `src/lib/section-health.ts` (`getSectionHealth`). Context field types, defaults (`defaultContextConfig`), and `buildContextBlock` live in `src/lib/context-types.ts`.
- Adding a new context field requires updating: `defaultContextConfig` and `buildContextBlock` in `src/lib/context-types.ts`, `scorePrompt` in `src/lib/prompt-builder.ts`, `getSectionHealth` in `src/lib/section-health.ts`, and `normalizeTemplateConfig` in `src/lib/template-store.ts`.
- Routes: Builder (`/`), Presets (`/presets`), Community (`/community`), Library (`/library`), History (`/history`), Profile (`/profile`), plus Contact, Privacy, Terms, Support Inbox, Feed, and Component Showcase pages.

### Persistence (dual-path)
- `src/lib/persistence.ts`: authenticated users → Neon Data API (PostgREST); signed-out users → localStorage.
- Template snapshots and normalization: `src/lib/template-store.ts`.
- Config schema versioning: `src/lib/prompt-config-adapters.ts` handles V1 ↔ V2 hydration/serialization.
- Database migrations in `supabase/migrations/` (applied via `supabase db push`).

### Agent service
- `agent_service/codex_service.mjs`: Node service using `@openai/codex-sdk` that streams SSE deltas for prompt enhancement.
- Frontend calls it via `streamEnhance` / `extractUrl` in `src/lib/ai-client.ts`.
- Deployed via Azure Web App (`main_ai-prompt-pro-agent.yml` workflow).

### Auth
- Neon Auth (Better Auth) via `@neondatabase/neon-js` – initialized in `src/integrations/neon/client.ts`.
- Auth context provided by `src/hooks/useAuth.tsx`.

### Feature flags
- `src/lib/feature-flags.ts` reads `VITE_*` env vars at build time.
- Community mobile rollout: `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` (default `true`).
- Builder redesign phases: `VITE_BUILDER_REDESIGN_PHASE{1..4}` (all default `true`).
- Launch experiments: `VITE_LAUNCH_EXPERIMENT_HERO_COPY`, `VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA`.

### Design system (UUI migration)
- Migrating from shadcn/ui (Radix) to **Untitled UI** (React Aria + Tailwind). Both coexist.
- UUI components in `src/components/base/` (buttons, input, select, checkbox, avatar, badges, tooltip, dialog, drawer, tabs, textarea, tags, progress-indicators, button-group, form, label).
- UUI application components in `src/components/application/` (activity-feeds, code-snippet, lists, progress-steps, tables).
- Radix/shadcn primitives in `src/components/base/primitives/`.
- UUI foundations (tokens, logos, payment-icons) in `src/components/foundations/`.
- UUI marketing components (footers, headers, contact) in `src/components/marketing/`.
- PromptForge fantasy theme components in `src/components/fantasy/`, design tokens in `warcraft/`.
- Design-system lint scripts in `scripts/`: legacy-import checks, legacy-ds-props, primitive-ds-imports, Phosphor-icon guardrails, token-runtime drift, docs-freshness.
- Must use semantic color tokens (`text-primary`, `bg-brand-solid`, `border-secondary`) — never raw Tailwind scales.
- `cx()` from `@/lib/utils/cx` (UUI) vs `cn()` from `@/lib/utils` (shadcn — being removed).

## Conventions

- Use the `@/` path alias for all `src/` imports (configured in Vite, Vitest, and tsconfig).
- TypeScript with React function components; 2-space indent, semicolons, double quotes.
- Component files: PascalCase (`PromptLibrary.tsx`). Hooks: `useXxx`. Utilities: kebab-case (`template-store.ts`).
- UI primitives in `src/components/base/primitives/` (Radix). UUI components in `src/components/base/`. Feature components directly in `src/components/`.
- Test files in `src/test/` named `{module}.test.ts(x)`.
- Never hardcode env values; use `VITE_*` for frontend, server-side vars for agent service (see `.env.example`).
- Commits: imperative mood with optional scope prefix (`ui: improve card spacing`).
- Primary icon library: `@phosphor-icons/react`. UUI icons: `@untitledui/icons`.
- Storybook available (`.storybook/`) for component development.
