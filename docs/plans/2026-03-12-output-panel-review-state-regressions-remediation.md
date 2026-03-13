# Output Panel Review-State Regression Remediation Plan

**Date:** 2026-03-12
**Status:** Planned
**Source:** Uncommitted-change review of the current prompt-enhancement/output
panel refactor in `src/components/OutputPanel.tsx`, `src/pages/Index.tsx`,
their supporting helpers, and the updated test surface.

## Goal

Fix the regressions introduced by the current output-panel refactor without
backing out the useful March 12 improvements around preview-first hierarchy,
state-banner clarity, builder-readiness naming, or mobile status de-duplication.

This plan addresses the reviewed issues directly:

1. settled enhanced output regresses to draft semantics after the `done` ->
   `idle` timer fires;
2. stale-state archived detail surfaces are implemented in `OutputPanel` but are
   unreachable from `Index`;
3. automated coverage drift now misses the real post-settle lifecycle and stale
   archived-detail contract.

## Resolution Direction

Use these product decisions as the implementation contract:

- Keep the preview-first `OutputPanel` structure introduced in the current diff.
- Keep stale enhancement fallback behavior:
  the main preview must return to the live builder draft after the builder
  changes.
- Keep archived AI artifacts available in stale state, but only inside clearly
  labeled secondary disclosures.
- Do not treat `enhancePhase === "idle"` as equivalent to `draft` when the
  visible preview is still the current enhanced output.

## Guardrails

Do not regress the completed behavior documented in:

- `docs/plans/2026-03-12-prompt-builder-enhancer-workflow-remediation.md`
- `docs/plans/2026-03-12-prompt-enhancer-in-progress-ui-remediation.md`
- `docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md`

The implementation must preserve these behaviors:

- signed-in mobile users can still reach the Codex session drawer from the
  mobile settings sheet;
- stale builder edits still swap the primary preview back to the live draft;
- developer/operator telemetry exports remain nested under `More` ->
  `Developer tools`;
- builder-readiness wording remains distinct from enhancer self-check wording;
- the mobile drawer still renders only one live status announcement.

## Findings Covered

### Finding 1: Settled enhanced output falls back to draft semantics after the idle timer

`Index` intentionally changes `enhancePhase` from `done` to `idle` shortly
after a successful run. The new `OutputPanel` and review-state helper currently
interpret settled enhanced output only while `enhancePhase === "done"`.

Impact:

- the banner flips from success to draft even though the preview still shows the
  enhanced output;
- compare, feedback, and variant actions disappear after the timer fires;
- copy labeling drifts from `Copy current output` to `Copy draft`;
- save/share availability becomes tied to a transient phase marker instead of
  the visible artifact under review.

### Finding 2: Stale archived-detail UI exists in the panel but is unreachable from the page

The new `OutputPanel` includes stale-specific copy such as `Last enhancement
details` and `Archived AI notes`, but `Index` still strips metadata, workflow,
reasoning, and sources whenever the builder signature diverges from the last
successful enhancement.

Impact:

- the new archived-detail copy is dead code in normal page usage;
- stale runs cannot show archived workflow, reasoning, or sources even though
  the UI now claims they exist;
- if archived metadata is reintroduced later without a clear contract, stale
  clarification or apply-to-builder actions could appear in the wrong place and
  imply that old AI questions still describe the current draft.

### Finding 3: Coverage drift no longer exercises the real lifecycle that produced Finding 1

The updated unit and Playwright coverage mostly asserts pre-enhance draft layout
or a permanently forced `enhancePhase: "done"` enhanced state. It does not
exercise the production `done` -> `idle` timer path or the intended archived
stale-detail behavior.

Impact:

- the current regression passed green targeted tests;
- desktop/mobile verification does not prove the post-settle UX contract;
- future state-model edits can re-break the same path without detection.

## Recommended Implementation Order

Implement in this order:

1. freeze the lifecycle contract with focused tests;
2. fix the settled-output state model so it survives the idle timer;
3. reconcile the stale archived-detail contract between `Index` and
   `OutputPanel`;
4. expand runtime verification for settled and stale review states;
5. rerun focused gates, then refresh plan status and docs.

This keeps the highest-risk runtime regression on the critical path before
stale-detail polish or broader test refactors.

---

## Workstream 0: Freeze The Repro Paths With Focused Tests

**Findings covered:** Finding 1, Finding 2, Finding 3

**Files:**
- Add: `src/test/output-panel-review-state.test.ts`
- Modify: `src/test/output-panel-phase2.test.tsx`
- Modify: `src/test/index-enhancement-staleness.test.tsx`
- Modify: `src/test/index-mobile-layout.test.tsx`
- Modify: `src/test/phase2-accessibility-validation.test.tsx`
- Modify: `playwright/builder.desktop.spec.ts`
- Modify: `playwright/builder.mobile.spec.ts`

### Step 1: Add a pure helper matrix for review-state combinations

Create `src/test/output-panel-review-state.test.ts` and cover the exact helper
inputs that matter:

1. empty preview -> `empty`;
2. builder draft preview -> `draft`;
3. in-flight enhancement (`starting`, `streaming`, `settling`) -> `enhancing`;
4. visible enhanced output with `enhancePhase: "done"` -> `ready`;
5. visible enhanced output with `enhancePhase: "idle"` and no stale notice ->
   still `ready`;
6. stale notice present -> `stale` regardless of prior enhancement artifacts.

Assert:

- `stateKey`
- visible title/description copy
- assistive-status string
- next-action copy

This prevents future fixes from being trapped inside `OutputPanel` rendering
logic alone.

### Step 2: Add an OutputPanel regression test for post-settle idle

Extend `src/test/output-panel-phase2.test.tsx` with a case that renders:

- `enhancedPrompt` present
- `previewSource="enhanced"`
- `hasEnhancedOnce={true}`
- `enhancePhase="idle"`
- `isEnhancing={false}`

Assert that the panel still shows:

- `Enhanced output ready`
- `Copy current output`
- `Show changes`
- `Too much changed`
- `Save`
- `More`
- version switches when alternatives exist

This is the exact runtime case that regressed.

### Step 3: Add an Index integration test that advances the real timers

In `src/test/index-enhancement-staleness.test.tsx` or a new nearby
Index-enhancement lifecycle test:

1. run a successful enhance flow with the existing mocked stream;
2. wait for the initial settled output to appear;
3. advance fake timers past the short `done` delay and then past the longer
   `idle` delay;
4. assert that `OutputPanel` still treats the visible enhanced prompt as
   settled output rather than draft preview.

This test must go through `Index`, not just `OutputPanel`, because the bug is
caused by `Index` phase timing.

### Step 4: Add a stale archived-detail integration test

Extend `src/test/index-enhancement-staleness.test.tsx` so that after editing the
builder:

- the primary preview returns to the live draft;
- stale notice is visible;
- compare and variant controls are hidden;
- archived details remain reachable under labeled disclosures;
- archived quality score is hidden;
- preview-adjacent clarification actions are hidden in stale state.

This locks the intended stale-state contract before implementation.

### Step 5: Expand mobile status assertions

Extend `src/test/index-mobile-layout.test.tsx` and
`src/test/phase2-accessibility-validation.test.tsx` so they cover:

- mobile live-region text after enhancement completes and after the idle timer
  expires;
- no duplicate status announcements when the mobile drawer opens;
- stale state keeping a single warning announcement while the drawer stays
  status-silent.

### Step 6: Restore runtime coverage for post-enhance states

Update Playwright coverage so it is not limited to draft layout:

- keep the current desktop preview-order assertions;
- add one authenticated or deterministic mocked enhance flow that reaches a
  settled enhanced output;
- wait beyond the idle timer and confirm the panel still shows settled-output
  controls;
- add one stale-after-edit scenario that confirms the preview returns to draft
  while archived details remain secondary.

If the current simplified `builder.desktop.spec.ts` cannot support that flow,
extract the old mock routing into a reusable helper instead of duplicating ad
hoc route setup.

### Definition of done

- Finding 1 reproduces in tests before the fix.
- Finding 2 has a failing integration assertion that proves archived details are
  currently unreachable or missing.
- Post-settle idle semantics are covered in unit, component, and at least one
  runtime test.

---

## Workstream 1: Fix The Settled-Output State Model

**Finding addressed:** Finding 1

**Files:**
- Modify: `src/lib/output-panel-review-state.ts`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify: `src/pages/Index.tsx`

### Step 1: Separate run phase from visible review state

Do not let `enhancePhase` alone determine whether the visible output is a draft
or a settled enhancement.

Introduce explicit derived concepts:

- `isRunInFlight`
  true only for `starting`, `streaming`, `settling`, or `isEnhancing`;
- `isVisibleEnhancedOutput`
  true when the visible preview source is enhanced, the preview has content, and
  the output is not stale;
- `isSettledEnhancedOutput`
  true when enhanced output is visible and the run is no longer in flight,
  regardless of whether the phase has already returned to `idle`.

### Step 2: Update the helper contract first

Refactor `getOutputPanelReviewState` so it can return `ready` for idle enhanced
output.

Options:

1. pass `isEnhancing` into the helper and derive `isRunInFlight` there; or
2. pass a precomputed `isSettledEnhancedOutput` boolean from `OutputPanel` and
   `Index`.

Prefer one helper contract used consistently by desktop and mobile so the banner
copy, assistive announcements, and status logic cannot drift apart.

### Step 3: Recompute panel gating from visible artifact + in-flight status

In `src/components/OutputPanel.tsx`, update these branches to use the new
settled-output semantics:

- `canShowCompare`
- `canShowTooMuchChanged`
- `copyLabel`
- `canUseSaveMenu`
- `canUseMoreMenu`
- `showVariantSwitches`
- state-banner `statusLabel`
- compare-dialog open/close behavior

Expected behavior:

- while the run is in flight, keep transient gating;
- once the run has settled, retain enhanced-output semantics even after the
  phase timer returns to `idle`;
- stale output still hides compare, feedback, and variants.

### Step 4: Keep copy and telemetry semantics aligned

Verify that `handleCopy`, `onPromptAccepted`, and `builder_copy_pre_enhance`
tracking still align with the visible artifact:

- copying idle enhanced output must not be tracked as pre-enhance draft copy;
- stale draft copy must remain draft-scoped;
- accepted-prompt tracking must still depend on current enhanced output, not
  merely on the last run phase.

### Step 5: Mirror the fix in the mobile status path

`Index` uses the same review-state helper for the mobile live region.

After the helper change:

- idle enhanced output should still announce settled success semantics, not
  draft semantics;
- stale state should remain warning-scoped;
- empty state should still suppress unnecessary announcement noise.

### Definition of done

- Settled enhanced output remains `ready` after the `done` -> `idle` timer.
- Compare, feedback, save/share, and variant controls remain available for the
  visible enhanced output after the timer expires.
- Mobile assistive state matches desktop review state for the same artifact.

---

## Workstream 2: Reconcile The Stale Archived-Detail Contract

**Finding addressed:** Finding 2

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: `src/components/EnhancementClarificationCard.tsx`
- Modify if needed: `src/components/OutputPanelEnhancementSummary.tsx`
- Modify if needed: `src/components/EnhancementInspector.tsx`

### Step 1: Make the stale-state contract explicit

Implement this exact stale-state rule:

- primary preview shows the live builder draft;
- state banner warns that the builder changed after enhancement;
- archived artifacts from the last settled enhancement remain available only in
  secondary disclosures;
- archived artifacts must never masquerade as the current draft.

Document that rule inline in code comments where the artifact selection logic
would otherwise be hard to infer.

### Step 2: Create a single archived-artifact bundle

Instead of scattering stale behavior across multiple loose values, introduce a
coherent bundle in `Index` for the last settled enhancement, for example:

- enhanced prompt
- metadata
- reasoning summary
- workflow
- web-search sources
- active variant or available variants
- builder signature for the run

Populate it from the successful enhancement path and keep it available after the
builder diverges.

This reduces the current drift where `OutputPanel` has stale archived UI but
`Index` only passes live-current artifacts.

### Step 3: Continue filtering the primary preview separately

Do not change the main stale-preview rule:

- `currentPreviewPrompt` still falls back to the live draft after builder edits;
- `previewSource` still reflects builder input while stale;
- `hasCurrentEnhancedOutput` remains false when the builder signature diverges.

The archived bundle must be supplemental, not primary.

### Step 4: Pass archived artifacts to OutputPanel deliberately

Add explicit props for archived stale-state content rather than overloading the
current live props.

Good shape:

- `archivedEnhanceMetadata`
- `archivedReasoningSummary`
- `archivedEnhanceWorkflow`
- `archivedWebSearchSources`

or a single structured prop if that is cleaner.

Do not reuse the current `enhanceMetadata` / `reasoningSummary` props for stale
archived data without renaming or clear semantics, because that invites future
action-gating mistakes.

### Step 5: Keep archived stale details secondary and non-actionable at the top level

When stale:

- keep `Last enhancement details` / `Archived ...` labels;
- keep archived workflow, reasoning, inspector content, and sources behind
  disclosures;
- hide archived quality score;
- hide variant switches;
- hide compare and `Too much changed`;
- suppress the preview-adjacent clarification card and any prompt/session
  mutation buttons derived from archived open questions.

If archived clarification or inspector content remains useful, keep it inside
the lower disclosures with explicitly archived copy.

### Step 6: Reconcile summary copy with the final data flow

Once archived details are real:

- ensure `Last enhancement details` is only shown when archived content exists;
- ensure source/provenance summaries mention archived or last-settled context;
- avoid stale copy that implies live AI output is still current.

If archived details are not available for a given stale state, omit the section
instead of rendering misleading empty labels.

### Definition of done

- `Index` and `OutputPanel` agree on what stale state means.
- Archived AI artifacts are reachable only when they exist.
- No stale archived control implies that old AI output is the current draft.

---

## Workstream 3: Restore Coverage Depth And Runtime Verification

**Finding addressed:** Finding 3

**Files:**
- Modify: `src/test/output-panel-phase2.test.tsx`
- Modify: `src/test/index-enhancement-staleness.test.tsx`
- Modify: `playwright/builder.desktop.spec.ts`
- Modify: `playwright/builder.mobile.spec.ts`
- Modify if needed: shared Playwright mock utilities under `playwright/`

### Step 1: Reintroduce a deterministic post-enhance browser path

The current desktop Playwright file only verifies draft layout. Restore one
deterministic post-enhance scenario by:

- reusing the prior authenticated/mock route harness; or
- extracting a new shared fixture that can simulate a successful enhancement
  response without depending on live backend behavior.

Do not rely solely on component tests for the post-settle UI contract.

### Step 2: Add a desktop settled-output runtime assertion

In `playwright/builder.desktop.spec.ts`:

1. create or load a built prompt;
2. trigger enhancement through the real UI;
3. wait for settled enhanced output;
4. wait past the idle timer;
5. assert that the banner, copy label, compare button, and save/share controls
   still reflect enhanced-output review state.

### Step 3: Add a stale-after-edit desktop assertion

In the same spec:

1. finish an enhancement;
2. edit the builder;
3. confirm the preview returns to the live draft;
4. confirm top-level compare/variant actions disappear;
5. open the archived details disclosure and confirm archived information is
   still available when expected.

### Step 4: Mirror the highest-risk path on mobile

In `playwright/builder.mobile.spec.ts`, add one mobile review-state smoke that
proves:

- the drawer still renders the same settled-output semantics after the idle
  timer;
- stale state keeps the primary preview draft-scoped;
- the drawer still avoids duplicate live-region announcements.

### Step 5: Keep runtime checks focused and durable

Avoid fragile layout-only assertions for this workstream.

Prefer checking:

- test ids
- visible headings
- button names
- disclosure copy
- action availability after explicit user flows

This keeps the runtime suite aligned with actual regression risk rather than
pixel drift alone.

### Definition of done

- Browser tests cover at least one real settled-output path and one stale path.
- The same lifecycle that caused Finding 1 is now exercised outside unit tests.

---

## Workstream 4: Verification, Cleanup, And Docs Closure

**Findings covered:** All findings

**Files:**
- Modify: `docs/plans/2026-03-12-output-panel-review-state-regressions-remediation.md`
- Modify if needed: `docs/README.md`

### Step 1: Run focused regression coverage first

Run:

- `npx vitest run src/test/output-panel-review-state.test.ts src/test/output-panel-phase2.test.tsx src/test/index-enhancement-staleness.test.tsx src/test/index-mobile-layout.test.tsx src/test/phase2-accessibility-validation.test.tsx`

Only move on once the lifecycle and stale-state slices are green.

### Step 2: Run browser verification

Run:

- `PLAYWRIGHT_PORT=4273 CI=1 npx playwright test playwright/builder.desktop.spec.ts playwright/builder.mobile.spec.ts`

Capture screenshots or traces for any failures before broadening the suite.

### Step 3: Run repository gates for touched surfaces

Run:

- `npm run lint`
- `npm run build`
- `npm run check:docs`

If the implementation touches broader enhancement behavior than expected,
escalate to `npm run test:unit` before merge.

### Step 4: Update plan status and verification notes

After implementation:

- change this plan from `Planned` to `Completed`;
- add the completion date;
- append the exact commands that passed;
- note any intentionally deferred follow-up items separately so they do not get
  lost inside the review conversation.

### Definition of done

- The runtime regressions are fixed.
- The archived stale-detail contract is implemented intentionally, not
  accidentally.
- Tests and docs now cover the real lifecycle that regressed.
