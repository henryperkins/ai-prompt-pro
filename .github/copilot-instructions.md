# Copilot instructions for ai-prompt-pro

## Architecture overview
- Frontend is a Vite + React app in `src/`. The main flow lives in `src/pages/Index.tsx`, which uses `usePromptBuilder` (`src/hooks/usePromptBuilder.ts`) to manage prompt config, templates, and versions.
- Prompt composition + scoring live in `src/lib/prompt-builder.ts` and `src/lib/context-types.ts`. New context fields must update `defaultContextConfig`, `buildContextBlock`, and scoring (`scorePrompt`, `getSectionHealth` in `src/lib/section-health.ts`).
- Persistence splits local vs cloud: `src/lib/persistence.ts` uses Supabase tables when authenticated, otherwise localStorage; template snapshots + normalization are in `src/lib/template-store.ts`.

## Integration flow
- Frontend calls Supabase Edge Functions via `streamEnhance`/`extractUrl` in `src/lib/ai-client.ts`.
- Deno Edge Functions live in `supabase/functions/**` and share CORS/auth/rate-limit helpers in `_shared/security.ts`.
- `enhance-prompt` proxies SSE from the Codex SDK agent service; keep SSE event format compatible with the `streamEnhance` parser (expects `data: ...` and `data: [DONE]`).
- Agent service (`agent_service/codex_service.mjs`) is a Node service using `@openai/codex-sdk` that streams SSE deltas compatible with the frontend parser.

## Env + secrets (do not hardcode)
- Frontend requires `VITE_SUPABASE_URL` (or `VITE_SUPABASE_PROJECT_ID`) and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). `src/integrations/supabase/client.ts` throws if missing.
- Edge functions: `AGENT_SERVICE_URL` (+ optional `AGENT_SERVICE_TOKEN`) for `enhance-prompt`, and `LOVABLE_API_KEY` for `extract-url`.
- Agent service: `OPENAI_API_KEY` (or `CODEX_API_KEY`) plus optional `CODEX_*` variables (see `agent_service/README.md`).

## Dev workflows
- Frontend: `npm run dev`, build `npm run build`, lint `npm run lint`.
- Tests: `npm run test` (Vitest + jsdom; setup in `src/test/setup.ts`).

## Conventions to follow
- Use the `@/` alias for `src/` imports (configured in Vite/Vitest).
- When adding new prompt/context UI, update both UI components in `src/components/` and the prompt builder + template normalization logic (`buildPrompt`, `scorePrompt`, `normalizeTemplateConfig`).