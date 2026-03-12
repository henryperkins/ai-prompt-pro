# Prompt Builder / Enhancer Workflow Remediation Plan

**Date:** 2026-03-12
**Status:** Completed
**Completed:** 2026-03-12
**Source:** 2026-03-12 workflow review of the current builder / enhancer user flow

## Goal

Close the current builder / enhancer workflow gaps that still create broken or
misleading user states:

1. Signed-in mobile users cannot open the Codex session surface.
2. Builder edits leave the last enhanced result active, so the visible preview
   drifts away from the current draft.
3. Signed-out users can still trigger session-context mutations through review
   surfaces even though the management UI is auth-gated.
4. Structured inspector constraints round-trip poorly into the builder and can
   render malformed prompt output.
5. Builder scoring drifts from the actual prompt state when custom format or
   custom constraints are populated.

## Outcome

This remediation pass is complete.

- Signed-in-only Codex session management is enforced consistently, and mobile
  users now reach the existing session drawer from the enhancement settings
  sheet.
- Builder edits now invalidate the active enhancement preview without discarding
  rerun history; stale previews fall back to the live draft and suppress stale
  metadata, sources, reasoning, and enhancement-acceptance telemetry.
- Promptless current-run artifacts stay visible only while they still belong to
  the current builder signature, which fixes reasoning-summary regressions
  without reintroducing stale output drift.
- Structured apply-to-builder constraint updates now normalize cleanly into
  preset/custom fields, render line-by-line in the built prompt, and contribute
  to scoring/quality tips correctly.

## Implementation Order

Implement in this order:

1. Freeze the failures with focused tests first.
2. Resolve session-policy drift before touching mobile entry points.
3. Add stale-enhancement state tracking so preview behavior is trustworthy.
4. Fix structured constraint round-tripping and the related scoring drift.
5. Re-run the targeted regression matrix, then update docs and plan status.

This order avoids solving the same session workflow twice and keeps the highest
trust issue on the critical path.

---

## Workstream 0: Freeze The Regressions With Tests

**Findings covered:** All findings

**Files:**
- Modify: `src/test/index-mobile-layout.test.tsx`
- Modify: `src/test/index-web-search-streaming.test.tsx`
- Modify: `src/test/index-apply-to-builder.test.tsx`
- Modify: `src/test/prompt-builder-build.test.ts`
- Modify: `src/test/score-tips-ownership.test.ts`
- Modify: `playwright/builder.mobile.spec.ts`
- Add if needed: `src/test/index-enhancement-staleness.test.tsx`

### Step 1: Add a signed-in mobile session access test

Before changing UI, add a failing test that proves the missing mobile entry:

- render `Index` in mobile mode with `isSignedIn: true`;
- open the mobile settings sheet;
- assert that a visible `Codex session` entry or button exists;
- assert that activating it opens `CodexSessionDrawer`.

Put the narrow RTL coverage in `src/test/index-mobile-layout.test.tsx`.

### Step 2: Add a guest hidden-state test

Capture the current signed-out inconsistency in
`src/test/index-web-search-streaming.test.tsx`:

- render the page signed out;
- surface an inspector or clarification action that would normally append to
  session context;
- assert that the action is absent or disabled;
- assert that no local session context is mutated.

This should fail against the current behavior if the action is still reachable.

### Step 3: Add a stale-enhancement preview test

Add a focused regression test that exercises the exact trust gap:

1. start with a successful enhancement;
2. confirm the preview source is `enhanced`;
3. edit builder input (`originalPrompt`, role, or structured apply-to-builder);
4. assert that the active preview falls back to the current builder draft;
5. assert that stale enhancement UI is hidden or replaced with a rerun notice.

If the assertions become too broad for an existing file, add a dedicated
`src/test/index-enhancement-staleness.test.tsx`.

### Step 4: Add a multiline constraint round-trip test

Extend `src/test/index-apply-to-builder.test.tsx` and
`src/test/prompt-builder-build.test.ts` to cover:

- inspector-applied multi-line constraints;
- prompt rendering with multiple custom constraint lines;
- no raw newline leakage inside a single bullet.

The prompt test should assert that each guardrail line becomes its own
`- ...` item under `**Constraints:**`.

### Step 5: Add a scoring-drift test

Extend `src/test/score-tips-ownership.test.ts` with a case proving that:

- `customFormat` contributes to specificity / structure;
- multi-line `customConstraint` contributes to specificity / structure;
- the score and tips do not regress just because the values landed in custom
  fields instead of preset arrays.

### Step 6: Add a signed-in mobile Playwright flow

Extend `playwright/builder.mobile.spec.ts` with a signed-in builder flow.

Recommended approach:

- reuse the authenticated mobile mocking pattern already used in
  `playwright/community.mobile.spec.ts`;
- seed authenticated state before `page.goto("/")`;
- open the mobile settings sheet;
- open the session surface;
- edit outside context and carry-forward prompt;
- close the drawer and confirm state persists.

If the repo does not already have a builder-specific auth mock helper, add one
instead of coupling this test to live auth.

### Definition of done

- Each finding has at least one failing regression assertion before the fix.
- The planned code changes can be validated without relying on manual-only QA.

---

## Workstream 1: Align Session Policy And Restore Mobile Session Access

**Findings covered:**
- Mobile users have no session entry point.
- Signed-out users can trigger hidden session-context mutations.

**Policy decision for this pass:** keep Codex session management signed-in only.

That matches the current desktop copy and avoids introducing a second,
guest-only carry-forward model in the same remediation pass.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: `src/components/EnhancementClarificationCard.tsx`
- Modify if needed: `src/components/EnhancementInspector.tsx`
- Test: `src/test/index-mobile-layout.test.tsx`
- Test: `src/test/index-web-search-streaming.test.tsx`
- Test: `playwright/builder.mobile.spec.ts`

### Step 1: Introduce one canonical session capability flag

In `src/pages/Index.tsx`, derive a single flag such as:

- `const canManageCodexSession = isSignedIn;`

Use that flag everywhere session behavior is wired, instead of scattering
`isSignedIn` checks across mobile, desktop, and inspector actions.

### Step 2: Stop passing session append handlers to guests

Change the `OutputPanel` props wiring so signed-out users do not receive
session-context mutation handlers:

- only pass `onAppendToSessionContext` when `canManageCodexSession` is true;
- keep `onApplyToBuilder` available to everyone;
- do not mutate local `enhanceSession` from guest-only review actions.

This removes the hidden-state path without changing the builder flow itself.

### Step 3: Verify child surfaces really hide session actions when no handler exists

Audit the downstream components and confirm they already obey the optional
handler contract:

- `EnhancementClarificationCard`
- `EnhancementInspector`
- `EnhancementEditableList`

If any still render `Add to session context` UI without a handler, update them
to hide the control entirely instead of leaving a dead button.

### Step 4: Add a mobile session entry without growing the sticky bar

Do not add another persistent button to the sticky bar.

Instead, extend `MobileEnhancementSettingsSheet` so it can render a compact
`Codex session` section below the enhancement controls:

- summary text from `sessionDrawerSummary`;
- a button such as `Open session` or `Manage session`;
- disabled / sign-in copy only if the product later chooses to surface this to
  guests.

This keeps the sticky chrome compact while making the session surface reachable
from every mobile state.

### Step 5: Wire the mobile sheet to the existing drawer

From `Index.tsx`:

- pass `sessionDrawerSummary`;
- pass a callback that closes the settings sheet and opens
  `CodexSessionDrawer`;
- reuse the existing `handleOpenSessionDrawer` behavior for auth-protected
  entry.

Do not create a second mobile-only session editor. Keep `CodexSessionDrawer` as
the single editing surface on both desktop and mobile.

### Step 6: Keep copy aligned across desktop and mobile

Update copy that currently drifts across surfaces:

- desktop summary card;
- mobile settings sheet;
- session drawer description.

Use the same nouns everywhere:

- `Codex session`
- `carry-forward context`
- `next enhancement turn`

Avoid mobile-only references to a drawer before the user has a visible way to
open it.

### Step 7: Update targeted tests

Required RTL coverage:

- `src/test/index-mobile-layout.test.tsx`
  - signed-in mobile users can reach `CodexSessionDrawer` through the settings
    sheet;
- `src/test/index-web-search-streaming.test.tsx`
  - signed-out users no longer get local session mutations from inspector /
    clarification actions.

Required Playwright coverage:

- `playwright/builder.mobile.spec.ts`
  - authenticated mobile flow opens settings -> session drawer -> edits fields
    -> closes successfully.

### Step 8: Manual verification

Validate these flows locally:

1. signed-in desktop: session card still opens the existing drawer;
2. signed-in mobile: settings sheet exposes a session entry and opens the same
   editor;
3. signed-out desktop/mobile: session review actions are absent, and the only
   remaining affordance is the explicit sign-in path.

### Definition of done

- Mobile has a real session entry point for signed-in users.
- Guests cannot create hidden session state.
- Desktop and mobile both route into the same session editor.

---

## Workstream 2: Separate Current Builder Draft From Last Enhancement Output

**Finding covered:** Builder edits leave stale enhancement output active.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify if useful: `src/lib/prompt-builder.ts`
- Modify: `src/components/OutputPanel.tsx`
- Test: `src/test/index-enhancement-staleness.test.tsx` or equivalent
- Test: `src/test/output-panel-phase2.test.tsx`
- Test: `src/test/index-ux-friction-improvements.test.tsx`

### Step 1: Introduce an explicit signature for the builder state

Add a helper that produces a stable signature for the current prompt-building
state.

Recommended location:

- `src/lib/prompt-builder.ts`

Recommended input scope for this pass:

- `originalPrompt`
- role fields
- context fields
- sources / advanced context state
- format fields
- constraints fields
- examples
- tone / complexity / length

Normalize arrays before hashing / serializing so order-only noise does not
create false stale states.

### Step 2: Capture the signature at successful enhancement time

In `src/pages/Index.tsx`, store the builder signature that produced the current
successful enhancement.

Recommended state shape:

- `lastEnhancedBuilderSignature`
- or a single `lastSuccessfulEnhancement` object that carries:
  - prompt text
  - metadata
  - sources
  - reasoning summary
  - input signature

Do not rely on `enhancedPrompt` alone as proof that the output is still
current.

### Step 3: Derive current-vs-stale enhancement state

Replace the current single concept of `hasEnhancedOnce` with two explicit
concepts:

- `hasEnhancedHistory`
- `hasCurrentEnhancedOutput`

Derive:

- `hasEnhancedHistory` from whether a successful enhancement exists;
- `hasCurrentEnhancedOutput` from whether the stored signature still matches
  the live builder signature.

This prevents the UI from treating any historical enhancement as the active
preview.

### Step 4: Switch the active preview back to the builder draft when stale

Update preview selection so:

- current enhancement -> show enhanced output;
- stale enhancement -> show the live `builtPrompt`;
- no enhancement -> show the live `builtPrompt` as today.

This change must affect both desktop and mobile, including:

- preview source label;
- mobile preview label;
- copy button labeling;
- save / accept telemetry semantics.

### Step 5: Hide or demote stale enhancement-only surfaces

Do not keep stale enhancement metadata looking active once the builder changed.

When the enhancement is stale:

- hide `OutputPanelEnhancementSummary`;
- hide `EnhancementInspector`;
- hide stale web sources / reasoning summary if they belong to the old run;
- reset the active variant to `original`.

Replace them with a compact notice such as:

`Builder changed since the last enhancement. Preview now shows the current draft. Re-run Enhance to refresh AI output.`

### Step 6: Preserve history for telemetry, but not as the active preview

Do not immediately throw away the last successful enhancement object if it is
still needed for:

- rerun telemetry;
- acceptance telemetry dedupe;
- future recovery tooling.

The important behavior change is that stale history stops driving the visible
preview.

### Step 7: Revisit `handleUseCurrentPromptForSession`

After the stale-state split lands, confirm that `handleUseCurrentPromptForSession`
still copies the visible current prompt:

- enhanced output when current;
- built draft when the last enhancement is stale.

The existing implementation is close, but it must be rechecked once the preview
selection rules change.

### Step 8: Update tests

Required test cases:

- after a successful enhancement, editing `originalPrompt` falls back to the
  builder draft preview;
- applying structured builder updates also invalidates the current enhancement;
- stale enhancement summary / inspector content is hidden;
- copy/save telemetry no longer records an enhancement acceptance when the
  visible prompt is only the rebuilt draft.

Suggested files:

- `src/test/index-enhancement-staleness.test.tsx`
- `src/test/output-panel-phase2.test.tsx`
- `src/test/index-ux-friction-improvements.test.tsx`

### Step 9: Manual verification

Verify these concrete flows:

1. enhance once, then edit the draft text -> preview flips back to built prompt;
2. enhance once, then click `Apply to builder` from structured output -> preview
   updates immediately to the builder draft instead of looking unchanged;
3. mobile preview drawer reflects the same stale/current distinction;
4. rerun enhance from the stale state and confirm the new enhanced output
   becomes current again.

### Definition of done

- Builder edits never leave stale enhanced output as the active preview.
- The user can always tell whether they are looking at the live draft or a
  current enhancement.

---

## Workstream 3: Fix Structured Constraint Round-Tripping

**Findings covered:**
- Structured constraints can render malformed prompt output.
- Custom-format / custom-constraint values drift away from builder scoring.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/EnhancementInspector.tsx`
- Modify: `src/components/BuilderAdjustDetails.tsx`
- Modify: `src/lib/prompt-builder.ts`
- Test: `src/test/index-apply-to-builder.test.tsx`
- Test: `src/test/prompt-builder-build.test.ts`
- Test: `src/test/score-tips-ownership.test.ts`

### Step 1: Normalize structured constraints before writing them into config

Do not push a raw multi-line block directly into `customConstraint`.

Add a normalization helper that:

- splits on newlines;
- strips bullets / numbering;
- trims and de-dupes lines;
- partitions recognized preset constraints into `constraints[]`;
- joins remaining freeform lines back into `customConstraint`.

Wire this helper into `handleApplyToBuilder` for the `constraints` field.

### Step 2: Stop storing multi-line content in a single-line input without intent

`BuilderAdjustDetails` currently uses a single-line `Input` for
`customConstraint`.

Choose one of these paths and implement it consistently:

1. Preferred: switch the custom constraint control to `TextArea` and make
   line-per-guardrail input first-class.
2. Acceptable fallback: keep `Input`, but ensure structured apply only stores a
   single normalized custom line there after partitioning other lines into
   preset constraint state.

Do not leave raw newline-heavy inspector content in a plain text input value.

### Step 3: Render custom constraints line-by-line in `buildPrompt`

Update `buildPrompt()` so custom constraints are treated as a list, not as one
opaque blob.

Recommended behavior:

- split `customConstraint` into trimmed lines;
- merge those lines with normalized preset constraints;
- render every final constraint as its own bullet item.

This is the direct fix for the malformed output reproduction.

### Step 4: Count custom values in `scorePrompt`

Fix the scoring drift so custom fields contribute the same way preset fields do.

At minimum:

- `customFormat` should count toward format-related specificity / structure;
- `customConstraint` should count toward specificity / structure;
- multi-line custom constraints should count by number of logical guardrails,
  not by a single boolean.

Re-check both score totals and tip messaging after this change.

### Step 5: Update summaries and counts in Zone 2

Any constraint-count and summary logic in `BuilderAdjustDetails` must match the
new normalization rules.

Examples:

- `constraintCount` should count multiple custom lines accurately;
- summary text should not imply there is only one custom constraint when the
  builder now stores several logical lines.

### Step 6: Keep inspector apply semantics additive only where intended

The structured inspector should still:

- replace role / format / constraints in a deterministic way when the user
  explicitly clicks `Apply`;
- append task clarifications or assumptions only through the prompt-append path.

Do not accidentally regress the reviewed `Apply to builder` semantics that were
already protected by `src/test/index-apply-to-builder.test.tsx`.

### Step 7: Update tests

Required assertions:

- applying multiline constraints yields normalized config state;
- rendered prompt contains one bullet per constraint line;
- custom-format / custom-constraint state improves scoring as expected;
- inspector apply still clears the parallel preset fields when replacement is
  intended.

### Step 8: Manual verification

Check these scenarios in the UI:

1. structured apply of multiple constraints produces readable bullets in the
   preview;
2. Zone 2 shows the same constraint information after apply;
3. builder quality score changes upward when custom format / constraints are
   added through the inspector.

### Definition of done

- No malformed constraint block is produced by inspector apply.
- Builder scoring reflects both preset and custom formatting / constraint state.

---

## Workstream 4: Regression Matrix, Docs Sync, And Rollout Discipline

**Findings covered:** Cross-cutting regression / docs drift

**Files:**
- Modify: `docs/README.md`
- Modify if needed: `prompt-build-and-enhancement.md`
- Modify this plan file as work completes

### Step 1: Keep implementation split into reviewable slices

Recommended PR order:

1. session policy + mobile session entry;
2. stale enhancement state split;
3. structured constraint + scoring fixes;
4. final docs / verification pass.

Do not bundle all four workstreams into one unreviewable diff if a safe split
is practical.

### Step 2: Run the targeted regression suite after each slice

Minimum slice-level checks:

```bash
npx vitest run \
  src/test/index-mobile-layout.test.tsx \
  src/test/index-web-search-streaming.test.tsx \
  src/test/index-apply-to-builder.test.tsx \
  src/test/prompt-builder-build.test.ts \
  src/test/score-tips-ownership.test.ts
```

For the stale-preview slice, add the new staleness test file to the command.

### Step 3: Re-run the broader builder / enhancement suite before closing

Run:

```bash
npm test -- \
  src/test/index-web-search-streaming.test.tsx \
  src/test/index-mobile-layout.test.tsx \
  src/test/index-apply-to-builder.test.tsx \
  src/test/output-panel-enhancement-inspector.test.tsx \
  src/test/output-panel-phase2.test.tsx \
  src/test/index-enhance-overrides-reset.test.tsx
```

Then run:

```bash
npx playwright test playwright/builder.mobile.spec.ts
npm run lint
npm run build
```

If Playwright auth mocking for the builder route is not ready in the same
change, keep the RTL coverage mandatory and document the missing authenticated
mobile E2E as an explicit follow-up, not an implicit gap.

### Step 4: Update architecture / behavior docs

After code lands, update the docs that describe the workflow:

- `prompt-build-and-enhancement.md`
- `docs/README.md`
- this plan file status / notes

Specifically document:

- session access policy;
- mobile session entry location;
- stale enhancement behavior after builder edits;
- structured constraint normalization rules.

### Step 5: Close the plan with concrete validation notes

When the work is complete, update this plan to `Completed` and append:

- exact commands run;
- which Playwright coverage passed vs was deferred;
- any intentional follow-up work that remains out of scope.

### Definition of done

- The code changes are covered by targeted automated tests.
- Docs describe the new workflow truthfully.
- Mobile, desktop, and signed-out behavior no longer contradict one another.

## Completion Notes

### Exact commands run

```bash
npx vitest run src/test/index-web-search-streaming.test.tsx
npx vitest run \
  src/test/index-mobile-layout.test.tsx \
  src/test/index-apply-to-builder.test.tsx \
  src/test/index-assumption-edit-telemetry.test.tsx \
  src/test/index-enhancement-staleness.test.tsx \
  src/test/prompt-builder-build.test.ts \
  src/test/score-tips-ownership.test.ts \
  src/test/output-panel-phase2.test.tsx \
  src/test/index-web-search-streaming.test.tsx
npx playwright test playwright/builder.mobile.spec.ts
```

### Repo-level validation

The following commands were run after the remediation landed:

```bash
npm run check:docs
npm run lint
npm run build
```

### Playwright coverage status

- `playwright/builder.mobile.spec.ts` passed with the new authenticated mobile
  session flow plus the existing sticky-bar, settings, progressive disclosure,
  and developer-tools checks.

### Remaining follow-up

- None from this remediation pass.
