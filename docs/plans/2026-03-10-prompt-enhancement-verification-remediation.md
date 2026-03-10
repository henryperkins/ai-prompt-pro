# Prompt Enhancement Verification Remediation Plan

**Date:** 2026-03-10
**Status:** Completed
**Source:** Verification of `docs/plans/2026-03-09-prompt-enhancement-improvements.md`

## Goal

Close the remaining gaps that prevented the 2026-03-09 prompt-enhancement plan
from being considered fully implemented:

1. Returning an intent override to `Use auto-detect` is not tracked.
2. Assumptions and open questions still do not have a real edit path, so
   `builder_enhance_assumption_edited` never fires from real user edits.
3. `OutputPanel.tsx` was partially decomposed, but it still exceeds the
   maintainability target defined in Task 0.

## Implementation Order

Implement in this order:

1. Finish `OutputPanel` decomposition first so the remaining UX work does not
   add more complexity to a file that is already too large.
2. Fix intent-override telemetry next because it is small, isolated, and
   should land quickly with focused tests.
3. Add editable assumptions/open questions and emit real assumption telemetry.
4. Re-run the prompt-enhancement verification slice and update docs status if
   all findings are resolved.

This order keeps the structural prerequisite in place before adding more UI.

## Post-remediation note

This follow-up resolved the implementation gaps identified in the original
verification pass, but UI-surface completeness still depended on the separate
scope split and mobile-parity work tracked in
`docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md`.

That additional work closes the remaining ambiguity around which capabilities
must appear in product UI, which belong in developer/operator tooling, and
which are intentionally validated as non-UI infrastructure.

---

## Workstream 1: Finish OutputPanel Decomposition

**Finding addressed:** `src/components/OutputPanel.tsx` is still above the
Task 0 size target. The save dialog and dev tools were extracted, but the file
still carries too many unrelated responsibilities.

**Files:**
- Modify: `src/components/OutputPanel.tsx`
- Add: `src/components/OutputPanelHeader.tsx`
- Add: `src/components/OutputPanelEnhancementSummary.tsx`
- Add: `src/components/OutputPanelEnhanceControls.tsx`
- Add: `src/components/OutputPanelCompareDialog.tsx`
- Test: `src/test/output-panel-enhance-metadata.test.tsx`
- Test: `src/test/output-panel-enhance-controls.test.tsx`
- Test: `src/test/output-panel-phase2.test.tsx`

### Step 1: Freeze the parent component contract

Before extracting anything else, treat `OutputPanel.tsx` as the orchestration
layer only. After this refactor it should keep:

- shared derived state (`displayPrompt`, active variant resolution, diff
  metrics);
- clipboard/save callbacks;
- wiring between extracted child components;
- top-level conditional rendering.

Do not keep large JSX sections or helper components inline once the new child
components exist.

### Step 2: Extract the header and compare controls

Create `src/components/OutputPanelHeader.tsx` for the top toolbar area:

- title and source badge;
- status badge;
- copy button;
- save dropdown;
- more dropdown;
- compare / `Too much changed` actions.

The new component should receive only the already-derived values and callbacks
it needs. Keep clipboard success state in `OutputPanel.tsx` unless it becomes
simpler to move it entirely into the header component.

### Step 3: Extract the compare dialog

Create `src/components/OutputPanelCompareDialog.tsx` and move:

- compare dialog shell;
- diff summary text;
- `DiffRow` rendering.

`OutputPanel.tsx` should pass:

- `open`
- `onOpenChange`
- `diff`
- `hasCompare`

This removes dialog-specific rendering and diff-row presentation from the main
component.

### Step 4: Extract the enhancement summary

Create `src/components/OutputPanelEnhancementSummary.tsx` and move the current
summary block out of `OutputPanel.tsx`:

- detected context chips;
- `What changed`;
- `Watch-outs`;
- `Try next`;
- assumptions list;
- open-question summary row;
- variant buttons.

Keep the current behavior unchanged:

- render only when metadata exists and enhancement is not in progress;
- collapse duplicate open-question rendering when the clarification card is
  already visible;
- preserve the current `Original`, `Use shorter`, and `Use more detailed`
  actions.

### Step 5: Extract the enhance footer controls

Create `src/components/OutputPanelEnhanceControls.tsx` for the bottom area:

- web-lookup toggle;
- enhancement depth control;
- rewrite strictness control;
- ambiguity-mode control;
- enhance button.

Move `EnhanceOptionGroup` into this component unless another shared home is
more appropriate.

### Step 6: Keep clarification and inspector surfaces separate

Do not re-inline `EnhancementClarificationCard` or `EnhancementInspector`.
`OutputPanel.tsx` should compose them, not own their implementation details.

The parent should read more like:

1. header
2. save dialog
3. compare dialog
4. reasoning summary
5. web-search activity
6. clarification card
7. main prompt card
8. enhancement summary
9. structured inspector
10. sources
11. enhance controls

### Step 7: Enforce the size target

After extraction, verify that `src/components/OutputPanel.tsx` is below 700
lines. If it is still above the threshold, continue extracting the largest
remaining render block instead of accepting a partial refactor.

Run:

```bash
wc -l src/components/OutputPanel.tsx
```

### Step 8: Update regression tests

Keep the existing test coverage but repoint it at the new composition:

- `src/test/output-panel-enhance-metadata.test.tsx`
  Verify metadata summary still renders and variant buttons still work.
- `src/test/output-panel-enhance-controls.test.tsx`
  Verify the controls section still renders and dispatches callbacks.
- `src/test/output-panel-phase2.test.tsx`
  Verify save-dialog and share flows still work after the header extraction.

Do not weaken assertions just because the JSX moved to child components.

### Step 9: Manual verification

Run:

```bash
npx vitest run \
  src/test/output-panel-enhance-metadata.test.tsx \
  src/test/output-panel-enhance-controls.test.tsx \
  src/test/output-panel-phase2.test.tsx
```

Then verify in the app:

- copy still works;
- compare dialog still opens;
- save/share actions still open the same dialog;
- web-search toggle and enhance controls still work;
- variant buttons still change the visible prompt.

### Definition of done

- `src/components/OutputPanel.tsx` is under 700 lines.
- The parent component reads as composition, not as a multi-surface monolith.
- Existing OutputPanel UX remains behaviorally unchanged.

---

## Workstream 2: Track Return To Auto-Detect In Intent Override Telemetry

**Finding addressed:** Clearing an explicit intent override back to
`Use auto-detect` updates UI state but does not emit
`builder_enhance_intent_overridden`.

**Files:**
- Modify: `src/pages/Index.tsx`
- Test: `src/test/index-enhance-overrides-reset.test.tsx`
- Test: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Compare effective intent states, not nullable override state

In `handleIntentOverrideChange` inside `src/pages/Index.tsx`, compute:

- `previousEffectiveIntent = intentOverride ?? detectedIntent ?? "auto"`
- `nextEffectiveIntent = intent ?? "auto"`

This avoids losing transitions where the user clears an override.

### Step 2: Emit telemetry whenever the effective state changes

Change the telemetry guard so it fires when:

- auto -> explicit override
- explicit override -> different explicit override
- explicit override -> auto

Use the existing event name:

- `builder_enhance_intent_overridden`

Payload:

- `fromIntent`
- `toIntent`

Represent the cleared state as `"auto"`, not `null`, so the event log stays
easy to query from `getTelemetryLog()`.

### Step 3: Ignore no-op clicks

Only emit telemetry when `previousEffectiveIntent !== nextEffectiveIntent`.

This prevents noise from:

- re-selecting the same override;
- clicking a route that does not change the current effective state;
- clearing an override when the state is already auto.

### Step 4: Keep personalization separate from telemetry semantics

Continue recording profile state only for explicit overrides unless product
requirements change. The verified gap is telemetry completeness, not profile
counting for the `"auto"` state.

That means:

- emit telemetry for override -> auto;
- do not necessarily increment `intentOverrideCounts` for `"auto"`.

### Step 5: Add focused regression tests

Update `src/test/index-enhance-overrides-reset.test.tsx` so it covers:

- selecting an explicit override from auto;
- switching from one explicit override to another;
- clearing an explicit override with `Use auto-detect`;
- no-op transitions emitting nothing.

Update `src/test/telemetry-usefulness-events.test.ts` with at least one sample
payload using:

```ts
{ fromIntent: "rewrite", toIntent: "auto" }
```

### Step 6: Manual verification

Run:

```bash
npx vitest run \
  src/test/index-enhance-overrides-reset.test.tsx \
  src/test/telemetry-usefulness-events.test.ts
```

Then verify in the app:

1. choose an override;
2. choose a different override;
3. click `Use auto-detect`;
4. inspect `getTelemetryLog()` and confirm all three transitions were written.

### Definition of done

- `Use auto-detect` produces a telemetry event.
- Telemetry reflects effective-state transitions, not raw nullable state.
- No-op clicks do not create duplicate override events.

---

## Workstream 3: Add Real Assumption/Open-Question Editing And Telemetry

**Finding addressed:** assumptions and open questions are still read-only, so
`builder_enhance_assumption_edited` is declared but never emitted by a real
edit flow.

**Files:**
- Modify: `src/components/EnhancementInspector.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/lib/enhance-metadata.ts` if helper types are needed
- Add: `src/components/EnhancementEditableList.tsx`
- Test: `src/test/output-panel-enhancement-inspector.test.tsx`
- Test: `src/test/index-apply-to-builder.test.tsx`
- Add: `src/test/index-assumption-edit-telemetry.test.tsx`
- Test: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Choose one canonical editing surface

Make the structured inspector the only place where assumptions and open
questions are editable.

Keep:

- the clarification card above the prompt for quick actions;
- the metadata summary short and scannable.

Do not add a second editable surface in the summary card.

### Step 2: Add an editable list component

Create `src/components/EnhancementEditableList.tsx` that can render:

- a list label;
- current items;
- per-item `Edit`, `Save`, and `Cancel` actions;
- list-level actions such as `Apply to prompt`, `Add to session context`, and
  `Copy`.

The component should be generic enough to power:

- `assumptions_made`
- `open_questions`
- `enhancement_plan.assumptions`
- `enhancement_plan.open_questions`

### Step 3: Keep edited drafts local to the current enhancement result

Do not mutate the raw metadata object. Instead, initialize draft state from the
current enhancement result and reset that draft state whenever a new
enhancement run completes or metadata is cleared.

Store draft values close to the inspector surface unless parent ownership is
needed for reuse in multiple child components.

### Step 4: Emit telemetry only on real edits

When the user saves a changed assumption or open question, emit
`builder_enhance_assumption_edited` immediately from `src/pages/Index.tsx`.

Recommended payload:

- `field`: `assumptions_made` | `open_questions` | `plan_assumptions` |
  `plan_open_questions`
- `index`
- `beforeChars`
- `afterChars`
- `source`: `structured_inspector`

Do not emit the event when:

- the user opens edit mode and cancels;
- the saved text is unchanged after trimming;
- the edit fails validation.

### Step 5: Align personalization with the real edit event

When a real edit is saved, update the local enhancement profile through
`recordEnhancementAction({ type: "assumption_edited", key })`.

Use stable keys that match the telemetry field values so telemetry review and
profile state stay comparable.

Remove any remaining logic that treats unrelated structured-part apply actions
as a proxy for an assumption edit.

### Step 6: Make edited content reusable without rerunning enhancement

After an item has been edited, the edited value must be the value used by the
follow-up actions.

Implement these deterministic actions:

- `Apply to prompt`
  For open questions, append the edited clarification block to
  `config.originalPrompt` using the existing clarification helper path.
  For assumptions, append an `Assumptions / corrections:` block to the prompt
  rather than trying to reverse-map freeform prose into builder fields.
- `Add to session context`
  Append the edited list to the Codex carry-forward context.
- `Copy`
  Copy the edited list exactly as shown.

This gives users a concrete way to fix one bad assumption and reuse the edited
structure immediately.

### Step 7: Keep structured-field apply actions separate

Do not merge freeform assumption editing with deterministic field mapping.

Keep:

- `Role`, `Context`, `Task`, `Output format`, `Guardrails` ->
  deterministic `Apply to builder`

Keep separate:

- assumption/question editing ->
  prompt append, session-context append, or copy

This avoids pretending that freeform assumption text can always be safely
reverse-parsed into builder fields.

### Step 8: Update inspector rendering

In `src/components/EnhancementInspector.tsx`:

- replace read-only plan-list sections for assumptions/open questions with the
  editable list component;
- keep required inputs, constraints, success criteria, and verification needs
  read-only with copy/session-context actions unless there is a separate product
  need for editing them;
- show clearly when a list is in edited draft state.

### Step 9: Add regression tests

Update or add tests that verify:

- assumptions and open questions render edit controls;
- saving an edited assumption emits `builder_enhance_assumption_edited`;
- no event fires for a no-op edit;
- edited text is what gets copied;
- edited open questions are what gets appended to the prompt;
- edited assumptions/questions are what get added to session context.

At minimum, cover:

- `src/test/output-panel-enhancement-inspector.test.tsx`
- `src/test/index-apply-to-builder.test.tsx`
- `src/test/index-assumption-edit-telemetry.test.tsx`
- `src/test/telemetry-usefulness-events.test.ts`

### Step 10: Manual verification

Run:

```bash
npx vitest run \
  src/test/output-panel-enhancement-inspector.test.tsx \
  src/test/index-apply-to-builder.test.tsx \
  src/test/index-assumption-edit-telemetry.test.tsx \
  src/test/telemetry-usefulness-events.test.ts
```

Then verify in the app:

1. enhance a vague prompt that returns assumptions/open questions;
2. edit one assumption and save it;
3. confirm `builder_enhance_assumption_edited` appears in
   `getTelemetryLog()`;
4. append the edited item to the prompt;
5. append the edited item to session context;
6. confirm the copied/exported text uses the edited value, not the original.

### Definition of done

- assumptions and open questions are no longer read-only;
- `builder_enhance_assumption_edited` fires from an actual user edit path;
- users can reuse edited assumptions/questions without rerunning enhancement.

---

## Final Validation

After all three workstreams land, run:

```bash
npx vitest run \
  src/test/telemetry-listener.test.ts \
  src/test/telemetry.test.ts \
  src/test/telemetry-usefulness-events.test.ts \
  src/test/output-panel-enhance-metadata.test.tsx \
  src/test/output-panel-enhancement-inspector.test.tsx \
  src/test/output-panel-enhance-controls.test.tsx \
  src/test/output-panel-phase2.test.tsx \
  src/test/index-enhance-overrides-reset.test.tsx \
  src/test/index-apply-to-builder.test.tsx \
  src/test/index-web-search-streaming.test.tsx \
  src/test/index-enhance-variant-persistence.test.tsx
```

Then run:

```bash
npm run check:docs
```

## Exit Criteria

This remediation plan is complete when all of the following are true:

- `OutputPanel.tsx` is below the documented size threshold.
- override -> auto transitions are visible in telemetry.
- assumptions/open questions can be edited and reused.
- `builder_enhance_assumption_edited` is emitted by real user edits.
- the prompt-enhancement verification slice is green after the changes.
