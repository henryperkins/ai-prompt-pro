# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite + React TypeScript app. Keep feature UI in `src/components/`, shared primitives in `src/components/ui/`, route-level screens in `src/pages/`, reusable stateful logic in `src/hooks/`, and domain logic/helpers in `src/lib/`.  
Tests live in `src/test/` (Vitest).  
Backend-adjacent code is split across `supabase/functions/` (Edge Functions), `supabase/migrations/` (SQL), and `agent_service/` (FastAPI service for Azure OpenAI integration).  
Static assets go in `public/`; build output is `dist/` (generated, do not edit manually).

## Build, Test, and Development Commands
- `npm run dev`: start frontend dev server (Vite).
- `npm run build`: production build to `dist/`.
- `npm run preview`: serve the built app locally.
- `npm run lint`: run ESLint on `ts/tsx` sources.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:rls`: run Supabase RLS-focused tests.
- `npm run check:prod`: lint + tests + build (pre-merge gate).
- `uvicorn agent_service.main:app --host 0.0.0.0 --port 8001 --reload`: run local Python agent service.

## Coding Style & Naming Conventions
Use TypeScript with React function components. Follow existing formatting: 2-space indentation, semicolons, and double quotes.  
Name components in PascalCase (`PromptLibrary.tsx`), hooks as `useXxx` (`usePromptBuilder.ts`), and utility modules in lower kebab/camel-style filenames (`template-store.ts`, `text-diff.ts`).  
Prefer `@/` imports for `src/*` paths (configured in Vite/Vitest).

## Testing Guidelines
Framework: Vitest with `jsdom` and Testing Library setup from `src/test/setup.ts`.  
Test filenames should match `src/**/*.{test,spec}.{ts,tsx}` and be descriptive (for example, `persistence.test.ts`, `edge-auth.test.ts`).  
Add regression tests for behavior changes in prompt composition, persistence, auth, and RLS.

## Commit & Pull Request Guidelines
Recent history mixes terse messages and scoped prefixes (for example, `ci: ...`). Prefer clear imperative commits with optional scope: `ui: improve community post card spacing`. Avoid vague messages like `up` or `Changes`.  
PRs should include: what changed, why, test commands run, screenshots for UI updates, and any env/secret impacts.

## Agent-Specific Instructions
For any code-touching request, run `query_project` immediately after receiving the prompt before opening files. Start with semantic queries, then use symbol/dependency queries for identifiers/relationships.

Suggested queries:
- `query_project(query: "Summarize modules involved in prompt persistence flow")`
- `query_project(query: "Where is usePromptBuilder defined and consumed?", type: "symbol")`
- `query_project(query: "Map dependencies between ai-client and Supabase functions", type: "dependency")`

Skip this only when the user provides exact file paths or the request is purely non-code.
