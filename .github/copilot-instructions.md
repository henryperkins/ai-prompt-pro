# Copilot instructions for ai-prompt-pro

## Architecture overview
- Frontend is a Vite + React app in `src/`. The main flow lives in `src/pages/Index.tsx`, which uses `usePromptBuilder` (`src/hooks/usePromptBuilder.ts`) to manage prompt config, templates, and versions.
- Prompt composition + scoring live in `src/lib/prompt-builder.ts` and `src/lib/context-types.ts`. New context fields must update `defaultContextConfig`, `buildContextBlock`, and scoring (`scorePrompt`, `getSectionHealth` in `src/lib/section-health.ts`).
- Persistence splits local vs cloud: `src/lib/persistence.ts` uses Neon Data API tables when authenticated, otherwise localStorage; template snapshots + normalization are in `src/lib/template-store.ts`.

## Integration flow
- Frontend calls the Azure agent service endpoints via `streamEnhance`/`extractUrl` in `src/lib/ai-client.ts`.
- Agent service (`agent_service/codex_service.mjs`) is a Node service using `@openai/codex-sdk` that streams SSE deltas compatible with the frontend parser.

## Env + secrets (do not hardcode)
- Frontend requires `VITE_NEON_DATA_API_URL`, `VITE_NEON_AUTH_URL`, and `VITE_AGENT_SERVICE_URL`.
- Optional frontend fallback key for signed-out function calls: `VITE_NEON_PUBLISHABLE_KEY`.
- Agent service: `OPENAI_API_KEY` (or `CODEX_API_KEY`) plus optional `CODEX_*` variables (see `agent_service/README.md`).

## Dev workflows
- Frontend: `npm run dev`, build `npm run build`, lint `npm run lint`.
- Tests: `npm run test` (Vitest + jsdom; setup in `src/test/setup.ts`).

## Conventions to follow
- Use the `@/` alias for `src/` imports (configured in Vite/Vitest).
- When adding new prompt/context UI, update both UI components in `src/components/` and the prompt builder + template normalization logic (`buildPrompt`, `scorePrompt`, `normalizeTemplateConfig`).
