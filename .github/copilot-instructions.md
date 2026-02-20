# Copilot instructions for ai-prompt-pro

## Build, test, and lint

```sh
npm run dev            # Vite dev server
npm run build          # production build
npm run lint           # ESLint
npm test               # Vitest (all suites, once)
npm run test:watch     # Vitest in watch mode
npm run check:prod     # lint + test + build (pre-merge gate)
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
- Entry point: `src/pages/Index.tsx` → uses `usePromptBuilder` hook to manage prompt config, templates, and versions.
- `usePromptBuilder` is composed from `useContextConfig` (context field updaters), `useDraftPersistence` (dirty state / autosave), plus pure helpers in `prompt-builder-cache.ts` and `prompt-builder-remix.ts`.
- Prompt composition and quality scoring: `src/lib/prompt-builder.ts` (`buildPrompt`, `scorePrompt`) and `src/lib/section-health.ts` (`getSectionHealth`). Context field types and defaults live in `src/lib/context-types.ts`.
- Adding a new context field requires updating: `defaultContextConfig`, `buildContextBlock`, `scorePrompt`, `getSectionHealth`, and `normalizeTemplateConfig` in `src/lib/template-store.ts`.

### Persistence (dual-path)
- `src/lib/persistence.ts`: authenticated users → Neon Data API (PostgREST); signed-out users → localStorage.
- Template snapshots and normalization: `src/lib/template-store.ts`.
- Config schema versioning: `src/lib/prompt-config-adapters.ts` handles V1 ↔ V2 hydration/serialization.
- Database migrations in `supabase/migrations/` (applied via `supabase db push`).

### Agent service
- `agent_service/codex_service.mjs`: Node service using `@openai/codex-sdk` that streams SSE deltas for prompt enhancement.
- Frontend calls it via `streamEnhance` / `extractUrl` in `src/lib/ai-client.ts`.

### Auth
- Neon Auth (Better Auth) via `@neondatabase/neon-js` – initialized in `src/integrations/neon/client.ts`.
- Auth context provided by `src/hooks/useAuth.tsx`.

### Feature flags
- `src/lib/feature-flags.ts` reads `VITE_*` env vars at build time.
- Community mobile rollout: `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` (default `false`).
- Builder redesign phases: `VITE_BUILDER_REDESIGN_PHASE{1..4}`.

## Conventions

- Use the `@/` path alias for all `src/` imports (configured in Vite, Vitest, and tsconfig).
- TypeScript with React function components; 2-space indent, semicolons, double quotes.
- Component files: PascalCase (`PromptLibrary.tsx`). Hooks: `useXxx`. Utilities: kebab-case (`template-store.ts`).
- UI primitives in `src/components/ui/` (shadcn/ui + Radix). Feature components directly in `src/components/`.
- Test files in `src/test/` named `{module}.test.ts(x)`.
- Never hardcode env values; use `VITE_*` for frontend, server-side vars for agent service (see `.env.example`).
- Commits: imperative mood with optional scope prefix (`ui: improve card spacing`).
