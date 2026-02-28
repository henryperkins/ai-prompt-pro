# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptForge (repo: ai-prompt-pro) — Build, enhance, and share AI prompts with a structured prompt builder, a private library, and a public community feed.

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
npm run test:unit        # Vitest excluding RLS integration tests (used by check:prod)
npm run test:watch       # Run Vitest in watch mode
npm run test:mobile      # Run Playwright mobile E2E checks
npm run test:rls         # Run Neon RLS-focused tests (requires NEON_SERVICE_ROLE_KEY)
npm run check:prod       # pre-merge gate (docs-freshness → design-system gates → lint → test:unit → build → token-runtime)
npm run check:design-system  # Build + all design-system lint gates
npm run agent:codex      # Run local Codex SDK agent service
```

Run a single test file:
```sh
npx vitest run src/test/persistence.test.ts
```

## Architecture

### Frontend (Vite + React + TypeScript)
- Brand copy locked in `src/lib/brand-copy.ts` (name: PromptForge, brand line, tagline, pillars).
- Entry point: `src/pages/Index.tsx` → uses `usePromptBuilder` hook to manage prompt config, templates, and versions.
- `usePromptBuilder` is composed from `useContextConfig` (context field updaters), `useDraftPersistence` (dirty state / autosave), plus pure helpers in `prompt-builder-cache.ts` and `prompt-builder-remix.ts`.
- Prompt composition and quality scoring: `src/lib/prompt-builder.ts` (`buildPrompt`, `scorePrompt`) and `src/lib/section-health.ts` (`getSectionHealth`).
- Context field types, defaults (`defaultContextConfig`), and `buildContextBlock` live in `src/lib/context-types.ts`.
- Adding a new context field requires updating: `defaultContextConfig` and `buildContextBlock` in `src/lib/context-types.ts`, `scorePrompt` in `src/lib/prompt-builder.ts`, `getSectionHealth` in `src/lib/section-health.ts`, and `normalizeTemplateConfig` in `src/lib/template-store.ts`.
- Routes: Builder (`/`), Presets (`/presets`), Community (`/community`), Library (`/library`), History (`/history`), Profile (`/profile`), plus Contact, Privacy, Terms, Support Inbox, Feed, and Component Showcase pages.

### Persistence (dual-path)
- `src/lib/persistence.ts`: authenticated users → Neon Data API (PostgREST); signed-out users → localStorage.
- Template snapshots and normalization: `src/lib/template-store.ts`.
- Config schema versioning: `src/lib/prompt-config-adapters.ts` handles V1 ↔ V2 hydration/serialization.
- Database migrations in `supabase/migrations/`.

### Agent service
- `agent_service/codex_service.mjs`: Node service using `@openai/codex-sdk` that streams SSE deltas for prompt enhancement.
- Frontend calls it via `streamEnhance` / `extractUrl` in `src/lib/ai-client.ts`.
- Deployed via Azure Web App (`main_ai-prompt-pro-agent.yml` workflow).

### Auth
- Neon Auth (Better Auth) via `@neondatabase/neon-js` – initialized in `src/integrations/neon/client.ts`.
- Auth context provided by `src/hooks/useAuth.tsx`.

## Key Directories

- `src/components/`: feature UI components
- `src/components/base/`: UUI core components (buttons, input, select, checkbox, avatar, badges, tooltip, dialog, drawer, tabs, textarea, tags, progress-indicators, button-group, form, label)
- `src/components/base/primitives/`: shared Radix/shadcn-compatible primitives
- `src/components/application/`: UUI application components (activity-feeds, code-snippet, lists, progress-steps, tables)
- `src/components/foundations/`: UUI design tokens, logos, payment-icons
- `src/components/marketing/`: UUI marketing components (footers, headers, contact)
- `src/components/community/`: Community feed, post cards, comments, profile hero, report dialog
- `src/components/fantasy/`: PromptForge fantasy theme components (PFButton, PFPanel, PFQualityGauge, etc.)
- `src/components/icons/`: OAuth and custom icon components
- `src/pages/`: route-level screens
- `src/hooks/`: reusable stateful logic
- `src/lib/`: domain logic/helpers (prompt-builder, persistence, ai-client, etc.)
- `src/lib/utils/`: utility functions (`cx.ts`, `icon-slot.tsx`, `is-react-component.ts`, `countries.tsx`)
- `src/styles/`: global CSS, theme tokens, typography, UUI compatibility, fantasy theme
- `src/test/`: Vitest tests
- `playwright/`: Playwright mobile E2E coverage + viewport baselines
- `supabase/migrations/`: SQL migrations
- `agent_service/`: Codex SDK service for prompt enhancement
- `docs/`: specs, runbooks, QA checklists, and design reviews
- `scripts/`: design-system lint gates (legacy-import checks, legacy-ds-props, primitive-ds-imports, Phosphor-icon guardrails, token-runtime drift, docs-freshness)
- `warcraft/`: PromptForge fantasy design tokens and theme utilities
- `.storybook/`: Storybook configuration for component development

## Feature Flags

- `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` - gates mobile-specific Community behaviors (filter drawer, comment thread drawers)
- `VITE_BUILDER_REDESIGN_PHASE{1..4}` - builder redesign phases (all default `true`)
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
- Primary icon library: `@phosphor-icons/react`; UUI icons: `@untitledui/icons`
- Use semantic color tokens — never raw Tailwind color scales

## Environment Variables

Key frontend vars (see `.env.example` for full list):
- `VITE_NEON_PROJECT_ID`, `VITE_NEON_DATA_API_URL`, `VITE_NEON_AUTH_URL`
- `VITE_AGENT_SERVICE_URL` (required for Enhance/Extract/Infer features)
- `VITE_ENHANCE_TRANSPORT` (`auto` | `sse` | `ws`)

Key agent service vars:
- `OPENAI_API_KEY` / `AZURE_OPENAI_API_KEY`, `AGENT_SERVICE_TOKEN`
- `CODEX_CONFIG_JSON`, `CODEX_MODEL`, `CODEX_MODEL_REASONING_EFFORT`
- Rate limits: `ENHANCE_PER_MINUTE`, `ENHANCE_PER_DAY`, `EXTRACT_PER_MINUTE`, `EXTRACT_PER_DAY`, `INFER_PER_MINUTE`, `INFER_PER_DAY`

## Deployment

- Azure Static Web Apps via `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
- Agent service via `.github/workflows/main_ai-prompt-pro-agent.yml`
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
├── base/           # UUI core components (Button, Input, Select, Checkbox, Avatar, Badge, Tooltip, Dialog, Drawer, Tabs, Textarea, Tags, ProgressIndicators, ButtonGroup, Form, Label)
├── base/primitives # Radix/shadcn-compatible primitives
├── application/    # UUI application components (activity-feeds, code-snippet, lists, progress-steps, tables)
├── foundations/    # UUI design tokens, logos, payment-icons
├── marketing/     # UUI marketing components (footers, headers, contact)
├── community/     # Community feed, post cards, comments, profile
├── fantasy/       # PromptForge fantasy theme components
├── icons/         # OAuth and custom icons
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
