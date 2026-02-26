# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Prompt Pro - Build, enhance, and share AI prompts with a structured prompt builder, a private library, and a public community feed.

- Production: `https://prompt.lakefrontdigital.io`
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui (migrating to Untitled UI)
- Backend: Neon Postgres via Neon Data API + Neon Auth
- Optional: prompt enhancement via local Codex SDK agent service (`agent_service/`)
- Node requirement: `^20.19.0 || >=22.12.0`
- Dev server: `http://localhost:8080` (Vite, non-default port)

## Common Commands

```sh
npm run dev              # Start frontend dev server (Vite)
npm run build            # Production build to dist/
npm run preview          # Serve built app locally
npm run lint             # Run ESLint on ts/tsx sources
npm test                 # Run Vitest once
npm run test:watch       # Run Vitest in watch mode
npm run test:mobile     # Run Playwright mobile E2E checks
npm run test:rls        # Run Neon RLS-focused tests
npm run check:prod      # pre-merge gate (design-system checks → lint → test:unit → build → token-runtime)
npm run agent:codex     # Run local Codex SDK agent service
npm run test:unit        # Vitest excluding RLS integration tests (used by check:prod)
npm run check:design-system  # Build + all design-system lint gates
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
- `src/components/base/primitives/`: shared Radix/shadcn-compatible primitives
- `src/components/base/`: Untitled UI core components (migration target)
- `src/components/foundations/`: UUI design tokens, logos, featured icons
- `src/components/marketing/`: UUI marketing components (footers, headers)
- `src/pages/`: route-level screens
- `src/hooks/`: reusable stateful logic
- `src/lib/`: domain logic/helpers (prompt-builder, persistence, ai-client, etc.)
- `src/test/`: Vitest tests
- `playwright/`: Playwright mobile E2E coverage + viewport baselines
- `supabase/migrations/`: SQL migrations
- `agent_service/`: Codex SDK service for prompt enhancement
- `docs/`: specs and runbooks
- `scripts/`: design-system lint gates (legacy-import checks, token-drift, Phosphor-icon guardrails)

## Feature Flags

- `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` - gates mobile-specific Community behaviors (filter drawer, comment thread drawers)
- `VITE_BUILDER_REDESIGN_PHASE{1..4}` - builder redesign phases
- `VITE_LAUNCH_EXPERIMENT_HERO_COPY` - A/B hero copy experiment
- `VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA` - A/B primary CTA experiment
- Feature flag implementation in `src/lib/feature-flags.ts`

## Agent Preferences

- When using the Task tool for codebase exploration, always use `subagent_type: "explore-sonnet"` instead of `"Explore"`.

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
- Additional CI: `codeql.yml` (security scanning), `neon-pr-branches.yml` (preview DB branches)

## Untitled UI (UUI) Component System

The app is migrating from shadcn/ui (Radix) to **Untitled UI** (React Aria + Tailwind). Both systems coexist during migration.

- **Official reference**: https://www.untitledui.com/react/AGENT.md (811 lines, comprehensive)
- **CLI**: `npx untitledui@latest add <component-name> --yes`

### UUI Directory Layout

```
src/components/
├── base/           # UUI core components (Button, Input, Select, Checkbox, Avatar, Badge, Tooltip, etc.)
├── base/primitives # Radix/shadcn-compatible primitives
├── foundations/    # UUI design tokens, logos, featured icons
├── marketing/     # UUI marketing components (footers, headers, CTAs)
└── ...            # App-specific feature components
```

### UUI Conventions

- **React Aria imports MUST be prefixed**: `import { Button as AriaButton } from "react-aria-components"`
- **File naming**: kebab-case for all files (matches our existing convention)
- **No Link component**: Use `Button` with `href` prop + `link-color`/`link-gray`/`link-destructive` color variants
- **Utility**: `cx()` from `@/lib/utils/cx` (UUI) vs `cn()` from `@/lib/utils` (shadcn — being removed)
- **Style organization**: `sortCx()` pattern with `common`/`sizes`/`colors` keys

### UUI Color System (CRITICAL)

**MUST use semantic color tokens — NEVER raw Tailwind color scales.**

```
❌ text-gray-900, bg-blue-700, border-gray-300
✅ text-primary, bg-brand-solid, border-secondary
```

**Text colors**: `text-primary`, `text-secondary`, `text-tertiary`, `text-quaternary`, `text-disabled`, `text-placeholder`, `text-brand-primary`, `text-brand-secondary`, `text-error-primary`, `text-warning-primary`, `text-success-primary`

**Border colors**: `border-primary`, `border-secondary`, `border-tertiary`, `border-disabled`, `border-brand`, `border-error`

**Foreground colors** (icons, non-text elements): `fg-primary`, `fg-secondary`, `fg-tertiary`, `fg-quaternary`, `fg-disabled`, `fg-brand-primary`, `fg-error-primary`, `fg-success-secondary`

**Background colors**: `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-active`, `bg-disabled`, `bg-overlay`, `bg-brand-solid`, `bg-brand-section`, `bg-error-solid`, `bg-success-solid`

### Key UUI Component APIs

**Button** (`@/components/base/buttons/button`):
- `color`: `"primary" | "secondary" | "tertiary" | "link-gray" | "link-color" | "primary-destructive" | "secondary-destructive" | "tertiary-destructive" | "link-destructive"`
- `size`: `"sm" | "md" | "lg" | "xl"`
- `iconLeading`/`iconTrailing`: `FC | ReactNode`
- `isLoading`, `isDisabled`, `showTextWhileLoading`
- `href` makes it a link; `onPress` (not `onClick`) for actions

**Input** (`@/components/base/input/input`):
- `label`, `hint`, `tooltip`, `icon`, `size`: `"sm" | "md"`, `isRequired`, `isDisabled`, `isInvalid`

**Select** (`@/components/base/select/select`):
- Data-driven with `items[]` array (not children-based like Radix)
- Compound: `Select.Item`, `Select.ComboBox`

**Avatar** (`@/components/base/avatar/avatar`):
- Monolithic: `src`, `alt`, `initials`, `size`, `status`, `verified`

**Badge** (`@/components/base/badges/badges`):
- `Badge`, `BadgeWithDot`, `BadgeWithIcon`
- `color`: `"gray" | "brand" | "error" | "warning" | "success" | ...`
- `type`: `"pill-color" | "color" | "modern"`

**Icons** (`@untitledui/icons`):
- Named imports, tree-shakeable: `import { Home01, Settings01 } from "@untitledui/icons"`
- When passing as JSX element: MUST include `data-icon` attribute

### Brand Color Customization

UUI uses a brand color scale from 25–950 in `src/styles/theme.css` via `--color-brand-*` CSS variables. Update these to change the entire brand palette across light and dark modes.
