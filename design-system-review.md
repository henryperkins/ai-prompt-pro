# Design System Review (Repo-Specific)

Review date: February 23, 2026

## Scope
This review is based on repository artifacts and command output in this workspace.

Primary evidence:
- `src/index.css`
- `src/styles/globals.css`
- `src/styles/untitled-compat.css`
- `tailwind.config.ts`
- `src/components/base/buttons/button.tsx`
- `src/components/base/input/input.tsx`
- `src/components/base/badges/badges.tsx`
- `src/components/base/select/select.tsx`
- `scripts/check-token-runtime-drift.mjs`
- `scripts/check-no-primitive-ds-imports.mjs`
- `scripts/check-no-legacy-ds-props.mjs`
- `src/test/design-token-contrast.test.ts`
- `src/test/community-mobile-ux.test.tsx`
- `playwright/community.mobile.spec.ts`
- `docs/community-mobile-qa-checklist.md`

## Current Baseline (Measured)
Passed checks:
- `npm run -s check:no-legacy-ui-imports`
- `STRICT_PRIMITIVE_IMPORTS=1 npm run -s check:no-primitive-ds-imports`
- `npm run -s check:no-legacy-ds-props`
- `npm run -s check:token-runtime` (`137` classes validated)

Failed checks:
- `npx vitest run src/test/design-token-contrast.test.ts`
  - `primary-foreground` on `primary` below `4.5:1` in light theme
  - `destructive-foreground` on `destructive` below `4.5:1` in dark theme

Observations from code:
- Transitional compatibility layer is still active and imported at runtime (`src/styles/globals.css`, `src/styles/untitled-compat.css`).
- Canonical components still accept some legacy compatibility props/classes (`src/components/base/buttons/button.tsx`, `src/components/base/badges/badges.tsx`).
- Mobile ergonomics checks are codified and enforced in Playwright at `320/375/390/428` widths (`playwright/community.mobile.spec.ts`).
- There is no Storybook/stories catalog in-repo (search over `storybook`/`*.stories.*` returned no matches).
- Current CI workflow excludes the contrast test from `test:unit` (`.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`).

## Prioritized Action Checklist

| Priority | Item | Status | Owner | Evidence | Definition of done | Verification |
|---|---|---|---|---|---|---|
| P0 | Resolve token contrast failures in light/dark semantic pairs | Open | Design + Frontend | `src/index.css`, `src/test/design-token-contrast.test.ts` | All required foreground/background token pairs satisfy test threshold | `npx vitest run src/test/design-token-contrast.test.ts` |
| P0 | Treat design-token contrast test as release-blocking in routine pre-merge flow (local + CI) | Open | Frontend Platform | `src/test/design-token-contrast.test.ts`, `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml` | `check:prod` and CI both execute contrast coverage (no workflow exclusions) | `npm run check:prod && ! rg -n "exclude 'src/test/design-token-contrast.test.ts'" .github/workflows` |
| P1 | Decommission `untitled-compat` dependency by migrating canonical components off legacy class namespace (`text-md`, `bg-brand-solid`, `utility-*`, `fg-*`, `error_*`) | Open | Frontend Platform | `src/styles/untitled-compat.css`, `src/components/base/buttons/button.tsx`, `src/components/base/input/input.tsx`, `src/components/base/badges/badges.tsx`, `src/components/base/select/select.tsx` | No canonical base components require compatibility alias tokens; runtime import can be removed | `! rg -n 'text-md|bg-brand-solid|utility-|text-fg-|text-error-|outline-error|ring-error_subtle|ring-bg-brand-solid|bg-disabled_subtle|text-tertiary' src/components/base && ! rg -n 'untitled-compat.css' src` |
| P1 | Remove remaining legacy compatibility props from canonical APIs (`Button.variant`, `Button.asChild`, `Badge.variant`) after migration window closes | Open | Frontend Platform | `src/components/base/buttons/button.tsx`, `src/components/base/badges/badges.tsx`, `scripts/check-no-legacy-ds-props.mjs` | Canonical APIs expose only target contract; no legacy prop scanner violations outside allowed fixtures | `! rg -n 'variant\\?: LegacyButtonVariant|asChild\\?: boolean|variant\\?: LegacyBadgeVariant|useLegacyContract|if \\(variant\\)' src/components/base/buttons/button.tsx src/components/base/badges/badges.tsx && npm run -s check:no-legacy-ds-props` |
| P1 | Expand accessibility automation from semantic unit checks to rule-based audits (axe or equivalent) for critical routes | Open | Frontend + QA | Accessibility tests exist, but no axe/tooling integration found in test suite | Automated rule checks run in CI for at least core routes/components | `npm test` (with new a11y suite included) |
| P1 | Clean up React test warnings in `community-mobile-ux` (`act(...)` and missing Dialog description warnings) | Open | Frontend + QA | `src/test/community-mobile-ux.test.tsx` emits warnings in current run | Test output is warning-free for community mobile unit suite | `npx vitest run src/test/community-mobile-ux.test.tsx` |
| P2 | Introduce a dedicated component state catalog (Storybook or equivalent) beyond route-level showcase | Open | Design System | `src/pages/ComponentsShowcase.tsx` exists, but no Storybook/stories index | Component catalog includes variants + states + usage guidance and is part of DS workflow | `rg --files | rg -i '(storybook|\.stories\.(ts|tsx|mdx)$|\.storybook/)'` |
| P2 | Add dark-mode and reduced-motion assertions to visual/e2e DS coverage | Open | QA | Token/motion primitives exist in `src/index.css`; current mobile Playwright coverage emphasizes layout/tap targets | E2E suite verifies theme and reduced-motion behavior on critical flows | `npm run test:mobile` |

## Execution Status Update (Current Branch)

Status snapshot after implementation and verification runs on February 23, 2026:

| Priority | Item | Current status | Evidence | Verification status |
|---|---|---|---|---|
| P0 | Resolve token contrast failures in light/dark semantic pairs | Completed | `src/index.css` token updates for `primary-foreground` and `destructive-foreground` | `npx vitest run src/test/design-token-contrast.test.ts` passes |
| P0 | Treat contrast test as release-blocking in pre-merge (local + CI) | Completed | `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml` build command no longer excludes contrast test | `npm run check:prod` passes |
| P1 | Decommission runtime `untitled-compat` dependency for canonical components | Completed (canonical scope) | `src/styles/globals.css` now imports `theme.css`; canonical `button/input/badges/select` no longer rely on listed legacy aliases | `rg -n 'untitled-compat\\.css' src` returns no matches; canonical file grep returns no matches |
| P1 | Remove legacy canonical API props (`Button.variant`, `Button.asChild`, `Badge.variant`) | Completed | `src/components/base/buttons/button.tsx`, `src/components/base/badges/badges.tsx` | `npm run -s check:no-legacy-ds-props` passes |
| P1 | Add rule-based accessibility automation (axe) | Completed | `src/test/accessibility-axe.test.tsx`, `package.json`/`package-lock.json` (`vitest-axe`, `axe-core`) | `npx vitest run src/test/accessibility-axe.test.tsx` passes |
| P1 | Clean up `community-mobile-ux` warnings (`act(...)`, missing descriptions) | Completed for target suites | Community + header mobile test wrappers updated with `act(...)` and router future flags; dialog/drawer descriptions added in components | `npx vitest run src/test/community-mobile-ux.test.tsx` passes without suite-specific warnings |
| P2 | Introduce component state catalog (Storybook) | Completed (initial scaffold) | `.storybook/main.ts`, `.storybook/preview.ts`, `*.stories.tsx` for button/input/badges | Story/storybook files present in repo |
| P2 | Add dark-mode and reduced-motion e2e assertions | Completed | `playwright/community.mobile.spec.ts` includes new dark mode + reduced motion tests | `npm run test:mobile` passes |

## Remaining Follow-up Plan (Repo-Wide Hygiene)

1. Eliminate remaining React Router future-flag warnings across the full unit test suite by adopting a shared test-router helper (or setting `future` props consistently in MemoryRouter-based tests).
2. Remove remaining `act(...)` warnings in non-community suites (`community-search-focus`, `output-panel-phase2`, `accessibility-axe` auth updates) by wrapping async state updates and harmonizing test hydration patterns.
3. Decide whether to fully retire `src/styles/untitled-compat.css` file content (currently no runtime import) or keep it as a short-term migration artifact with explicit deprecation date.

## Already in Place (Keep)
- Strict deprecated import policy enforcement is active and passing.
- Legacy design-system prop scanner for route/community surfaces is active and passing.
- Token/runtime drift scanner exists and is passing.
- Mobile UX baseline checks cover control size, overflow, safe-area spacing, and comments drawer behavior.

## Recommended Execution Order
1. Fix token contrast failures first.
2. Remove compatibility-layer dependence from canonical components.
3. Remove legacy compatibility props from canonical exports.
4. Add automated accessibility rule checks.
5. Add component state catalog and visual-mode coverage improvements.
