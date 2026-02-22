# Design System Phase 3 Implementation Plan (Final Primitive Decommission)

## Implementation Status (Completed February 22, 2026)
- Deprecated primitive imports for `button`, `input`, `badge`, and `select` were fully removed from runtime and tests.
- `scripts/check-no-primitive-ds-imports.mjs` was hardened to AST-based scanning and now also detects `vi.mock`/`jest.mock` module path usage.
- Strict primitive import enforcement is active in release gates (`check:design-system`, `check:prod`) and CI build command runs `check:prod`.
- Validation gates completed successfully:
  - `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`
  - `npm run check:design-system`
  - `npm run check:prod`
  - `npm run test:mobile`

## Objective
Finish the design-system cutover by removing all remaining usage of deprecated primitive contracts for `button`, `input`, `badge`, and `select`, then enforce that policy in CI with a hardened checker.

Phase 3 is the final migration/stabilization phase after the Phase 2 call-site cutover workstream.

## Phase 3 Exit Criteria
1. Zero runtime imports from:
   - `@/components/base/primitives/button`
   - `@/components/base/primitives/input`
   - `@/components/base/primitives/badge`
   - `@/components/base/primitives/select`
2. Zero test-time module mocks/resolution paths pointing to those same deprecated modules.
3. `check:no-primitive-ds-imports` catches multiline imports and mock-path usage.
4. CI runs with strict mode enabled and fails on violations.
5. `npm run check:prod`, `npm run check:design-system`, and `npm run test:mobile` pass.
6. `docs/design-system.md` reflects final, non-transitional policy.

## Current State Snapshot (Captured February 22, 2026)
Source-of-truth checks at planning time:

- Checker-reported violations (`npm run check:no-primitive-ds-imports`): **51**.
- Direct import statement references found by grep: **51**.
  - `button`: 32
  - `input`: 8
  - `badge`: 10
  - `select`: 1
- Total raw string references (`rg` over `src`): **80** (includes tests, deprecation warning strings, and helper text).

Current distribution:
- App/pages/components outside `src/components/base/primitives/*`: 43 imports.
- Primitive-internal cross-dependencies (`src/components/base/primitives/*`): 7 imports.
- Test imports: 1 import.
- Additional test references via `vi.mock(...)` and string literals exist and are not fully enforced by current checker logic.

## Scope
In scope:
- Remaining call-site migrations in app routes/components.
- Community surface migration with mobile behavior parity.
- Test migration (imports and mock module paths).
- Primitive-internal dependency cleanup for the targeted components.
- Checker hardening and strict CI enforcement.
- Final design-system docs cleanup.

Out of scope:
- Replatforming unrelated primitive families (accordion, drawer, card, etc.).
- Visual redesign beyond parity-preserving API migration.
- New token architecture beyond required alias cleanup.

## Canonical Contracts (Final Target)
All code should use these canonical paths:
- `@/components/base/buttons/button`
- `@/components/base/input/input`
- `@/components/base/badges/badges`
- `@/components/base/select/select`

Deprecated paths to fully remove from app and tests:
- `@/components/base/primitives/button`
- `@/components/base/primitives/input`
- `@/components/base/primitives/badge`
- `@/components/base/primitives/select`

## Migration Rules
### Button
- Use canonical `Button` with Untitled contract (`color`, `size`, `iconLeading`/`iconTrailing`, `href` as needed).
- Remove primitive-only variant assumptions.
- Preserve UX parity with local `className` adjustments where necessary.

### Input
- Use canonical `Input` and preserve validation/disabled semantics.
- Keep responsive sizing behavior currently used in mobile/community forms.

### Badge
- Use canonical `Badge` contract (`type`, `color`, `size`) and preserve status semantics.
- Avoid introducing one-off badge variants during migration.

### Select
- Move to canonical select composition from `@/components/base/select/select`.
- Preserve placeholder, selected label behavior, keyboard/focus handling, and disabled semantics.

## Workstreams
## 1) Checker Hardening (Gate Before Strict CI)
Current script misses at least one multiline import (`src/components/community/CommunityReportDialog.tsx` select import). Harden before turning strict mode into a release gate.

Deliverables:
1. Replace regex-only extraction with AST-based scanning (TypeScript parser) for:
   - `ImportDeclaration`
   - `ExportDeclaration`
   - dynamic `import("...")`
2. Add detection for module path usage in test mocks:
   - `vi.mock("...")`
   - `jest.mock("...")`
3. Add regression fixtures/tests for checker behavior.
4. Keep allowlist scoped only to the four deprecated primitive modules.

Acceptance:
- Hardened checker reports the `select` import currently in `CommunityReportDialog`.
- Hardened checker detects deprecated module paths used in `vi.mock`/`jest.mock`.

## 2) App Surface Migration
Migrate remaining app files with highest concentration first.

Priority A (3 references each):
- `src/pages/Presets.tsx`
- `src/components/ContextSourceChips.tsx`
- `src/components/ContextInterview.tsx`

Priority B (2 references each):
- `src/pages/SupportInbox.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Index.tsx`
- `src/pages/Community.tsx`
- `src/components/StructuredContextForm.tsx`
- `src/components/Header.tsx`
- `src/components/community/CommunityReportDialog.tsx`
- `src/components/community/CommunityPostDetail.tsx`
- `src/components/community/CommunityPostCard.tsx`
- `src/components/community/CommunityComments.tsx`
- `src/components/BuilderSourcesAdvanced.tsx`
- `src/components/AuthDialog.tsx`

Priority C (1 reference each):
- `src/pages/Feed.tsx`
- `src/pages/CommunityPost.tsx`
- `src/components/VersionHistory.tsx`
- `src/components/ToneControls.tsx`
- `src/components/PromptInput.tsx`
- `src/components/NotificationPanel.tsx`
- `src/components/community/PromptPreviewPanel.tsx`
- `src/components/community/CommunityFeed.tsx`
- `src/components/BuilderHeroInput.tsx`
- `src/components/application/tables/team-members-table.tsx`

Acceptance:
- No deprecated targeted primitive imports remain in app surfaces.
- Route behavior parity validated for `/`, `/community`, `/community/:id`, `/feed`, `/presets`, `/profile`, `/support-inbox`.

## 3) Primitive-Internal Cleanup
Remove cross-dependencies on deprecated targeted primitives inside primitive internals:
- `src/components/base/primitives/alert-dialog.tsx`
- `src/components/base/primitives/calendar.tsx`
- `src/components/base/primitives/carousel.tsx`
- `src/components/base/primitives/pagination.tsx`
- `src/components/base/primitives/sidebar.tsx`
- `src/components/base/primitives/state-card.tsx`

Strategy:
1. Point internal consumers to canonical targeted components.
2. Keep wrapper files as compatibility shims only where still required.
3. Retain explicit deprecation warnings until complete removal phase.

Acceptance:
- Primitive internals no longer import deprecated targeted primitive modules.

## 4) Test and Mock Migration
Migrate remaining deprecated targeted primitive references in tests.

Known import location:
- `src/test/button-variants.test.ts`

Known mock/string-reference hotspots:
- `src/test/index-deferred-render-profiler.test.tsx`
- `src/test/index-inference-cancellation.test.tsx`
- `src/test/index-mobile-layout.test.tsx`
- `src/test/index-redesign-phase1.test.tsx`
- `src/test/index-remix-param.test.tsx`
- `src/test/index-web-search-streaming.test.tsx`

Strategy:
1. Update imports/mocks to canonical component modules.
2. Remove assertions that depend on deprecated module paths.
3. Keep behavior assertions unchanged.

Acceptance:
- No targeted deprecated primitive path references in `src/test/*`.

## 5) CI Lock and Documentation Finalization
Deliverables:
1. Enable strict mode in CI (`STRICT_PRIMITIVE_IMPORTS=1`).
2. Ensure release checks include strict primitive-import gating.
3. Update `docs/design-system.md` to remove transitional migration language.
4. Add Phase 3 completion note and deprecation policy status.

Acceptance:
- CI fails on any reintroduction of targeted deprecated imports or mocks.
- Docs describe canonical contracts as required, not transitional.

## Execution Waves
## Wave 0: Tooling Safety Net
1. Harden `scripts/check-no-primitive-ds-imports.mjs` (AST + mock-path checks).
2. Add checker test fixtures.
3. Validate on current branch that all known violations are detected.

Gate:
- `npm run check:no-primitive-ds-imports` reports full expected set.

## Wave 1: Core Builder and Auth/Header Surfaces
Target files:
- `src/components/AuthDialog.tsx`
- `src/components/Header.tsx`
- `src/components/PromptInput.tsx`
- `src/components/BuilderHeroInput.tsx`
- `src/components/BuilderSourcesAdvanced.tsx`
- `src/components/ContextSourceChips.tsx`
- `src/components/ContextInterview.tsx`
- `src/components/StructuredContextForm.tsx`
- `src/components/ToneControls.tsx`
- `src/components/VersionHistory.tsx`
- `src/components/NotificationPanel.tsx`

Gate commands:
1. `npm run lint`
2. `npm test`
3. `npm run check:no-primitive-ds-imports`

## Wave 2: Community Surfaces + Mobile Parity
Target files:
- `src/pages/Community.tsx`
- `src/pages/CommunityPost.tsx`
- `src/pages/Feed.tsx`
- `src/components/community/CommunityFeed.tsx`
- `src/components/community/CommunityPostCard.tsx`
- `src/components/community/CommunityPostDetail.tsx`
- `src/components/community/CommunityComments.tsx`
- `src/components/community/CommunityReportDialog.tsx`
- `src/components/community/PromptPreviewPanel.tsx`

Additional checks:
1. `npm run test:mobile`
2. Validate 320/375/390/428 community flows.
3. Verify `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` on/off behavior parity.

## Wave 3: Remaining Pages + Table Surface
Target files:
- `src/pages/Index.tsx`
- `src/pages/Presets.tsx`
- `src/pages/Profile.tsx`
- `src/pages/SupportInbox.tsx`
- `src/components/application/tables/team-members-table.tsx`

Gate:
- `npm run check:design-system`

## Wave 4: Primitive-Internal and Test Cleanup
Target files:
- `src/components/base/primitives/alert-dialog.tsx`
- `src/components/base/primitives/calendar.tsx`
- `src/components/base/primitives/carousel.tsx`
- `src/components/base/primitives/pagination.tsx`
- `src/components/base/primitives/sidebar.tsx`
- `src/components/base/primitives/state-card.tsx`
- `src/test/button-variants.test.ts`
- `src/test/index-deferred-render-profiler.test.tsx`
- `src/test/index-inference-cancellation.test.tsx`
- `src/test/index-mobile-layout.test.tsx`
- `src/test/index-redesign-phase1.test.tsx`
- `src/test/index-remix-param.test.tsx`
- `src/test/index-web-search-streaming.test.tsx`

Gate:
- `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`

## Wave 5: CI Strict Lock + Docs
1. Enable strict env var in CI pipeline(s).
2. Confirm `npm run check:prod` in CI green.
3. Update:
   - `docs/design-system.md`
   - this plan file with completion status (optional post-implementation note)

Final release gate:
1. `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`
2. `npm run check:design-system`
3. `npm run check:prod`
4. `npm run test:mobile`

## PR and Rollout Strategy
Use three PRs minimum to reduce risk:
1. PR A: Checker hardening + fixtures (no UI behavior changes).
2. PR B: App/community/test migrations.
3. PR C: Primitive-internal cleanup + strict CI flip + docs finalization.

Deployment sequence:
1. Merge PR A, validate no false negatives.
2. Merge PR B, run mobile + route QA.
3. Merge PR C after stability window, then lock CI strict mode permanently.

## Risks and Mitigations
Risk: Checker regressions (false negatives/positives).
Mitigation: AST parser + fixtures + PR A isolation.

Risk: Community mobile interaction drift.
Mitigation: Explicit Wave 2 mobile viewport and drawer flow checks.

Risk: Variant/size visual drift in migrated buttons/badges.
Mitigation: Route-level QA and focused snapshot/assertion updates.

Risk: Hidden deprecated paths in test mocks.
Mitigation: Extend checker to `vi.mock`/`jest.mock` and clean all known test hotspots.

## Rollback Plan
If regressions appear before strict lock:
1. Revert only the affected migration commit range.
2. Keep checker in warn mode temporarily.
3. Re-land fixes file-by-file.

If regressions appear after strict lock:
1. Temporarily disable strict env var in CI only for emergency patch window.
2. Fix offending files immediately.
3. Re-enable strict mode in same release cycle.

## Tracking Checklist
1. Implement checker hardening and test fixtures.
2. Migrate Priority A files.
3. Migrate Priority B files.
4. Migrate Priority C files.
5. Migrate primitive-internal dependencies.
6. Migrate test imports/mocks.
7. Enable strict CI.
8. Finalize docs and close Phase 3.
