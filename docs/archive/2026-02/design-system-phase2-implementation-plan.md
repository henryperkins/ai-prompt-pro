# Design System Phase 2 Implementation Plan (Untitled UI React Cutover)

## Objective
Complete the hard cutover from deprecated primitive contracts to canonical Untitled UI React contracts, then enforce the new API surface in CI.

This plan assumes Phase 1 is already landed:
- `src/styles/untitled-compat.css` exists and is imported.
- Runtime drift checks are live (`check:token-runtime`).
- Primitive wrapper deprecation warnings exist in dev mode.
- Primitive import detection script exists in warn mode (`check:no-primitive-ds-imports`).

## Current State Snapshot
Current primitive import inventory (repo truth at plan time):
- `@/components/base/primitives/button`: 44 imports
- `@/components/base/primitives/input`: 15 imports
- `@/components/base/primitives/badge`: 22 imports
- `@/components/base/primitives/select`: 8 imports

High-concentration migration files:
- `src/pages/Library.tsx`
- `src/components/PromptLibrary.tsx`
- `src/components/ContextIntegrations.tsx`
- `src/components/BuilderAdjustDetails.tsx`
- `src/pages/Presets.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/ContextSourceChips.tsx`
- `src/components/ContextInterview.tsx`
- `src/components/BuilderTabs.tsx`

## Scope
In scope:
- Replace primitive imports for Button/Input/Badge/Select across app and tests.
- Complete API adaptation at all call sites.
- Move primitive-import check from warn mode to strict fail mode.
- Remove compatibility aliases that are no longer referenced.
- Keep accessibility behavior and mobile UX parity.

Out of scope:
- Re-architecting non-target component families.
- Full token-system redesign beyond what is required for cutover.
- Storybook adoption.

## Canonical Contracts (Target)
Use these imports after Phase 2:
- `@/components/base/buttons/button`
- `@/components/base/input/input`
- `@/components/base/badges/badges`
- `@/components/base/select/select`

Deprecated imports to remove from app code:
- `@/components/base/primitives/button`
- `@/components/base/primitives/input`
- `@/components/base/primitives/badge`
- `@/components/base/primitives/select`

## Public Interface Changes
Phase 2 changes to externally consumed contracts:
1. App code must use canonical Untitled UI React paths above.
2. Primitive APIs become internal-only compatibility shims or hard-fail wrappers.
3. `check:no-primitive-ds-imports` becomes CI-enforced error gate.
4. `STRICT_PRIMITIVE_IMPORTS=1` is enabled in CI and local release checks.

## Migration Mappings (Decision Complete)
Use these mappings for call-site migration.

### Button mapping
- Old primitive: `variant` + `size` + `asChild`
- Canonical: `color` + `size` + optional `href` for link behavior

Mapping table:
- `variant=default` -> `color=primary`
- `variant=destructive` -> `color=primary-destructive`
- `variant=secondary` -> `color=secondary`
- `variant=outline` -> `color=secondary`
- `variant=ghost` -> `color=tertiary`
- `variant=link` -> `color=link-color`
- `size=default` -> `size=md`
- `size=sm` -> `size=sm`
- `size=lg` -> `size=lg`
- `size=icon` -> `size=sm` + icon-only usage pattern

When legacy visual parity is required short-term:
- Allow local className additions at call sites.
- Do not add new primitive-only variants.

### Input mapping
- Old primitive: native-style input with `isInvalid`, `isDisabled`.
- Canonical: `Input` from `@/components/base/input/input` with `isInvalid`, `isDisabled`, `size`, `label`, `hint`.

Rule:
- Preserve current validation semantics (`aria-invalid`, disabled behavior).
- Keep mobile input sizing (`sm` default, `md` only where already used).

### Badge mapping
- Old primitive: `variant=default|secondary|destructive|outline`.
- Canonical: `Badge` with Untitled type/color contracts.

Mapping table:
- `default` -> `type="badge-color"` + `color="brand"`
- `secondary` -> `type="badge-modern"` + default color
- `destructive` -> `type="badge-color"` + `color="error"`
- `outline` -> `type="badge-modern"` + local outline style where needed

### Select mapping
- Old primitive is Radix composition.
- Canonical select is react-aria based composition.

Rule:
- Migrate each select surface directly to canonical select composition.
- Keep keyboard behavior, option labels, placeholder behavior, and disabled/invalid semantics.
- Use `SelectItemType` from canonical select module where typed item lists are used.

## Delivery Strategy
Execute in five waves. Each wave must pass `npm run check:prod` before moving on.

### Wave 1: Lock and Baseline
1. Freeze new primitive imports by enabling strict mode locally in migration branch:
   - `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`
2. Create migration tracking table in PR description:
   - file path
   - primitive component type
   - migration status
3. Run baseline checks:
   - `npm run check:design-system`
   - `npm run test:mobile` for community flows

### Wave 2: Highest-Volume App Surfaces
Migrate these first:
- `src/pages/Library.tsx`
- `src/components/PromptLibrary.tsx`
- `src/components/ContextIntegrations.tsx`
- `src/components/BuilderAdjustDetails.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/BuilderTabs.tsx`

Required per-file acceptance:
- No targeted primitive imports remain.
- TypeScript passes with canonical props.
- Existing tests touching file behavior pass.

### Wave 3: Remaining App + Community Surfaces
Migrate remaining pages/components:
- Community pages and cards/dialogs.
- Header, notifications, presets/profile/support/feed/index surfaces.
- Builder helper components (`ContextSourceChips`, `ContextInterview`, etc.).

Acceptance:
- No visual regressions in core routes:
  - `/`
  - `/community`
  - `/library`
  - `/components-showcase`

### Wave 4: Primitive Internal Cleanup
1. Update targeted primitive modules to one of two final states:
   - state A (recommended short tail): compatibility re-exports with deprecation comment.
   - state B (final): minimal wrapper that throws in dev/test with migration hint.
2. Remove unused compatibility aliases from `src/styles/untitled-compat.css`.
3. Keep `check:token-runtime` green after alias pruning.

### Wave 5: CI Enforcement and Docs Finalization
1. Flip primitive import checker to strict in CI:
   - set `STRICT_PRIMITIVE_IMPORTS=1`.
2. Update docs:
   - `docs/design-system.md` canonical imports only.
   - remove “temporary migration” language once strict mode is enabled.
3. Confirm release gate:
   - `npm run check:prod`
   - `npm run check:design-system`

## File-Level Task Matrix
1. Replace imports and props in application code:
   - `src/pages/*` and `src/components/*`.
2. Update tests that import or assert primitive component behavior:
   - `src/test/button-variants.test.ts` and other route/component tests.
3. Cleanup primitives:
   - `src/components/base/primitives/button.tsx`
   - `src/components/base/primitives/input.tsx`
   - `src/components/base/primitives/badge.tsx`
   - `src/components/base/primitives/select.tsx`
4. CI and script enforcement:
   - `scripts/check-no-primitive-ds-imports.mjs`
   - `package.json`
5. Token compatibility pruning:
   - `src/styles/untitled-compat.css`
   - `src/styles/globals.css`

## Test Plan
Run these for each wave:
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run check:token-runtime`
5. `npm run check:no-primitive-ds-imports`

Mandatory focused tests:
1. `src/test/community-mobile-ux.test.tsx`
2. `src/test/header-mobile-notifications.test.tsx`
3. `src/test/notification-panel.test.tsx`
4. `src/test/design-token-contrast.test.ts`
5. `src/test/components-showcase-blocks.test.tsx`

Mobile regression:
1. `npm run test:mobile`
2. Validate 320/375/390/428 viewports for community flows.

## Acceptance Criteria (Phase 2 Exit)
1. Zero imports from targeted primitive paths across app and tests.
2. `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports` passes.
3. `npm run check:prod` passes.
4. `npm run check:design-system` passes.
5. `check:token-runtime` passes after compatibility alias pruning.
6. No regression in critical route UX and mobile drawer interactions.

## Rollout Plan
1. Merge in two PRs minimum:
   - PR A: bulk call-site migration.
   - PR B: strict CI flip + primitive cleanup + alias pruning.
2. Deploy PR A, monitor error rate and visual QA.
3. Deploy PR B after 24 hours of stable monitoring.

## Rollback Plan
If regressions appear after PR A:
1. Revert migration commit(s) for affected surface only.
2. Keep Phase 1 compatibility layer intact.
3. Re-run `npm run check:prod`.

If regressions appear after PR B:
1. Temporarily disable strict mode (`STRICT_PRIMITIVE_IMPORTS=0`) in CI.
2. Re-enable deprecated primitive wrappers for the failing surface.
3. Re-introduce only required token aliases in `untitled-compat.css`.
4. Ship targeted fix, then re-enable strict mode.

## Risks and Mitigations
Risk: visual drift from prop-contract mismatch.
Mitigation: migrate highest-traffic surfaces first and run route-level QA snapshots.

Risk: select behavior regressions (keyboard/focus).
Mitigation: prioritize select migrations with focused tests per surface.

Risk: compatibility alias deletion too early.
Mitigation: prune aliases only after `check:token-runtime` proves non-usage.

Risk: CI noise from existing warnings.
Mitigation: keep lint warnings non-blocking, treat only strict primitive import and runtime drift as blockers.

## Execution Checklist
1. Enable strict primitive check in migration branch.
2. Migrate Wave 2 files.
3. Run test/build gates.
4. Migrate Wave 3 files.
5. Run test/build/mobile gates.
6. Cleanup primitives and compatibility aliases.
7. Flip CI strict mode.
8. Final docs update and release verification.
