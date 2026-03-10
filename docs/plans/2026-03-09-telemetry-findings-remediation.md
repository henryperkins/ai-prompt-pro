# Prompt Enhancement Telemetry Findings Remediation Plan

Last updated: 2026-03-09

**Date:** 2026-03-09
**Status:** Draft
**Source review:** Verification review of the telemetry work described in `docs/plans/2026-03-09-prompt-enhancement-improvements.md`.

## Goal

Close the three verified telemetry gaps so PromptForge’s enhancement usefulness metrics reflect actual user behavior instead of inferred behavior from reruns, partial UI state, or read-only inspector surfaces.

## Findings To Fix

1. `builder_enhance_accepted` fires on the next enhance click instead of at the moment the user actually accepts the output, and failed save/share attempts can still arm a false accept.
2. Returning an intent override to `Use auto-detect` is not tracked, so the override telemetry stream is incomplete.
3. `builder_enhance_assumption_edited` only covers structured-part apply actions; assumptions and open questions are still read-only and cannot emit real edit telemetry.

## Implementation Order

1. Fix acceptance/rerun semantics first. The launch metrics doc already depends on these events.
2. Fix intent override telemetry next. It is small, isolated, and should land with test coverage quickly.
3. Add editable assumption handling last. It touches inspector UX, local draft state, and event payload design.
4. Finish with doc sync and targeted validation so the new plan’s metrics remain queryable through the existing localStorage telemetry listener.

---

## Task 1: Emit Acceptance Telemetry At Actual Acceptance Time

**Finding addressed:** `builder_enhance_accepted` is delayed until rerun, and failed save/share attempts can still set the “used” flag.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `docs/launch-measurement-baseline.md`
- Test: `src/test/index-enhance-variant-persistence.test.tsx`
- Add or modify: `src/test/index-enhance-acceptance-telemetry.test.tsx`
- Add or modify: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Replace the overloaded “used” boolean with explicit run-level acceptance state

In `src/pages/Index.tsx`, stop using a single ref to mean all of these at once:

- the output was copied,
- the output was saved,
- the output was shared,
- an acceptance event should be emitted later,
- personalization should count the output as accepted.

Instead, introduce explicit run-level refs or state such as:

- `currentEnhancementRunId`
- `hasAcceptedCurrentEnhancement`
- `acceptedVariantForRun`
- `acceptedSourceForRun`

Reset this state whenever a new enhancement run starts, when the prompt is cleared, and when all enhance session state is reset.

### Step 2: Add one helper that records acceptance exactly once per enhancement run

Create a helper in `Index.tsx`, for example `markEnhancedPromptAccepted(source)`, that:

- no-ops if there is no enhanced output to accept;
- no-ops if acceptance for the current run was already recorded;
- computes telemetry from the currently selected output variant, not always from `enhancedPrompt`;
- emits `builder_enhance_accepted` immediately;
- records the same acceptance for personalization/profile state;
- stores the accepted source for debugging and future analysis.

Use a constrained `source` value such as:

- `copy`
- `save`
- `share`

### Step 3: Enrich the acceptance payload so the launch metrics doc is actually measurable

The current launch doc says “Acceptance rate for vague prompts” requires prompt length in payload, but the current acceptance event only carries output prompt length. Update the acceptance payload to include at least:

- `source`
- `promptChars` for the accepted enhanced output
- `inputPromptChars` for the original builder prompt
- `inputWordCount`
- `variant` (`original`, `shorter`, `more_detailed`)

This keeps the existing output-length signal while making the vague-prompt metric queryable from the same event log.

### Step 4: Fire acceptance on successful copy

In `src/components/OutputPanel.tsx`, change the `onPromptUsed` contract so it can tell `Index.tsx` which action actually succeeded. A minimal pattern is:

```ts
onPromptUsed?: (source: "copy" | "save" | "share") => void;
```

Then:

- call `onPromptUsed("copy")` only after clipboard copy succeeds;
- do not emit acceptance before the clipboard promise resolves;
- keep the existing pre-enhance copy telemetry untouched.

### Step 5: Fire acceptance only after save/save-and-share actually succeed

In `src/pages/Index.tsx`, move acceptance handling out of the “attempt” path and into the success path:

- remove the eager `enhanceOutputUsed.current = true` assignment before the async save/save-share calls;
- call `markEnhancedPromptAccepted("save")` only after `savePrompt(...)` returns success;
- call `markEnhancedPromptAccepted("share")` only after `saveAndSharePrompt(...)` returns success;
- keep failed save, failed share, and sign-in-blocked share flows from recording acceptance.

This prevents false positives from failed persistence attempts.

### Step 6: Make rerun telemetry independent from acceptance telemetry

In `handleEnhance`, keep `builder_enhance_rerun` on the next enhance click when there is already an enhanced output, but remove the delayed `builder_enhance_accepted` emission from that path.

The rerun branch should now do exactly two things:

- emit `builder_enhance_rerun` with the previous selected prompt length;
- optionally record a profile rerun action if personalization logic still needs it.

Do not couple rerun to acceptance anymore.

### Step 7: Align personalization bookkeeping with the real acceptance moment

If PromptForge’s enhancement profile is still supposed to learn from accepted outputs:

- call `recordEnhancementAction({ type: "accepted" })` inside `markEnhancedPromptAccepted(...)`;
- call `recordEnhancementAction({ type: "rerun" })` inside the rerun branch if reruns should contribute to the profile;
- remove any remaining profile updates that depend on the old delayed-acceptance pattern.

This keeps telemetry and personalization sourced from the same user action.

### Step 8: Update the measurement doc to match the new contract

In `docs/launch-measurement-baseline.md`:

- keep the first-pass accept rate formula;
- clarify that acceptance is emitted on successful copy/save/share, not on rerun;
- replace the vague-prompt note with the actual payload fields required (`inputPromptChars` and `inputWordCount`);
- note that `builder_enhance_rerun` is now independent of acceptance.

### Step 9: Add regression tests for the corrected timing

Update or add tests that prove the new semantics:

- copy emits `builder_enhance_accepted` immediately and exactly once;
- successful save emits `builder_enhance_accepted`;
- successful save-and-share emits `builder_enhance_accepted`;
- failed save does not emit `builder_enhance_accepted`;
- blocked/failed share does not emit `builder_enhance_accepted`;
- rerun after an unused enhancement emits only `builder_enhance_rerun`;
- rerun after an accepted enhancement still emits only one acceptance total for that run;
- acceptance payload uses the selected variant’s prompt length and reports the accepted source.

Update `src/test/index-enhance-variant-persistence.test.tsx` so it no longer expects acceptance to be emitted from the rerun branch.

### Step 10: Verify manually

Run:

```bash
npx vitest run src/test/index-enhance-variant-persistence.test.tsx src/test/index-enhance-acceptance-telemetry.test.tsx src/test/telemetry-usefulness-events.test.ts
```

Then run the app and verify:

- enhance -> copy logs acceptance immediately in `getTelemetryLog()`;
- enhance -> failed save logs no acceptance;
- enhance -> save logs acceptance once;
- enhance -> rerun logs `builder_enhance_rerun` even if no acceptance happened first.

---

## Task 2: Track Return To Auto-Detect In Intent Override Telemetry

**Finding addressed:** `Use auto-detect` clears the override in UI state but emits no telemetry.

**Files:**
- Modify: `src/pages/Index.tsx`
- Test: `src/test/index-enhance-controls.test.tsx`
- Test: `src/test/index-enhance-overrides-reset.test.tsx`
- Modify if needed: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Define the telemetry contract for clearing an override

Keep the existing event name `builder_enhance_intent_overridden`, but make its payload represent transitions between effective intent states.

Use:

- `fromIntent`: previous effective state
- `toIntent`: next effective state

Represent a cleared override as `toIntent: "auto"` rather than `null` so the event log stays easy to query from localStorage.

### Step 2: Compare effective state, not raw nullable override state

In `handleIntentOverrideChange` inside `src/pages/Index.tsx`, compute:

- `previousEffectiveIntent = intentOverride ?? detectedIntent ?? "auto"`
- `nextEffectiveIntent = intent ?? "auto"`

Only emit telemetry when those effective values differ. This avoids noise from no-op clicks while still capturing:

- auto -> explicit override
- explicit override -> different explicit override
- explicit override -> auto

### Step 3: Preserve current UI behavior

Do not change the visible UX in `BuilderHeroInput.tsx` unless needed for clarity. The existing interaction model is sufficient:

- clicking an intent chip sets an explicit override;
- clicking `Use auto-detect` clears it.

The change should be behavioral only: telemetry becomes complete.

### Step 4: Add focused tests for override transitions

Add or update tests to cover:

- selecting an explicit override from auto emits `fromIntent: "auto"` and `toIntent: "<route>"`;
- switching from one override to another emits the two explicit values;
- clicking `Use auto-detect` emits `toIntent: "auto"`;
- clicking a no-op state does not emit a duplicate event.

### Step 5: Verify manually

Run:

```bash
npx vitest run src/test/index-enhance-controls.test.tsx src/test/index-enhance-overrides-reset.test.tsx src/test/telemetry-usefulness-events.test.ts
```

Then verify in the app:

- choose an override;
- choose a different override;
- click `Use auto-detect`;
- confirm all three transitions appear in `getTelemetryLog()`.

---

## Task 3: Expose Real Assumption Edits And Emit Real Assumption Telemetry

**Finding addressed:** assumptions/open questions are visible but not editable, so `builder_enhance_assumption_edited` currently reflects only structured-part apply actions.

**Files:**
- Modify: `src/components/EnhancementInspector.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/pages/Index.tsx`
- Modify if needed: `src/lib/enhance-metadata.ts`
- Test: `src/test/output-panel-enhancement-inspector.test.tsx`
- Test: `src/test/index-apply-to-builder.test.tsx`
- Add or modify: `src/test/index-assumption-edit-telemetry.test.tsx`

### Step 1: Decide on the minimal editable assumption UX

Keep this first pass intentionally narrow. The goal is not a full structured editor; it is to make assumptions and open questions editable enough to produce meaningful telemetry and let the user correct bad inference without rerunning.

Use one of these simple patterns:

- inline text inputs for each assumption/open question with save/remove actions; or
- a compact textarea editor that opens per row.

Do not hide assumptions only in the summary card anymore. Make the editable surface live in `EnhancementInspector.tsx`.

### Step 2: Introduce local draft state for inspector assumptions/questions

Do not mutate raw metadata objects in place. In `Index.tsx`, create a session-local draft state seeded from the latest `enhanceMetadata`, for example:

- `assumptionDrafts`
- `openQuestionDrafts`

Reset these drafts whenever a new enhancement metadata payload replaces the current run.

Pass the drafts and edit callbacks into `EnhancementInspector.tsx`.

### Step 3: Move assumption/open-question rendering into the inspector’s editable surface

In `EnhancementInspector.tsx`:

- render assumptions in a dedicated section;
- render open questions in a dedicated section;
- provide edit/save/remove controls for each row;
- keep the existing structured parts section intact.

In `OutputPanel.tsx`, keep the high-level summary compact. If assumptions/open questions remain in the summary at all, they should mirror the current draft state instead of staying disconnected from the editable inspector.

### Step 4: Emit richer `builder_enhance_assumption_edited` payloads

Keep the existing event name for backward compatibility, but make payloads distinguish what the user actually changed. Include fields such as:

- `section`: `assumption`, `open_question`, `role`, `context`, `format`, `guardrails`
- `action`: `edit`, `remove`, `apply`, `apply_all`
- `index`
- `fromLength`
- `toLength`

This preserves current structured-part telemetry while making real assumption editing visible in the event log.

### Step 5: Add one “apply corrected assumptions” path back into the builder

To make the new assumption editing useful and not just observable, add one deterministic apply path:

- append corrected assumptions/clarifications into builder context or project notes; or
- map them into a dedicated builder-side note field if one already exists.

Do not try to reverse-map assumptions into every builder field. The first pass only needs one clear, reusable destination.

### Step 6: Keep structured-part telemetry, but stop pretending it is assumption telemetry

Where `EnhancementInspector.tsx` currently emits `builder_enhance_assumption_edited` for role/context/format/guardrails apply actions, keep those events but set the new payload shape so downstream analysis can tell the difference:

- structured-part apply events should identify `section: "role"` or `section: "format"`, etc.;
- actual assumption edits should identify `section: "assumption"` or `section: "open_question"`.

This lets the existing event name survive while making the analytics interpretation correct.

### Step 7: Add regression tests

Add or update tests that verify:

- assumptions and open questions render in the inspector when metadata contains them;
- editing an assumption updates the local draft state;
- removing an assumption emits the correct telemetry payload;
- applying corrected assumptions to the builder uses the chosen destination field;
- role/format/guardrails apply events still emit telemetry, but now with explicit section/action payload fields;
- no assumption-edit telemetry fires when metadata is absent.

### Step 8: Verify manually

Run:

```bash
npx vitest run src/test/output-panel-enhancement-inspector.test.tsx src/test/index-apply-to-builder.test.tsx src/test/index-assumption-edit-telemetry.test.tsx
```

Then verify in the app:

- enhance a vague prompt that generates assumptions;
- edit one assumption;
- remove another assumption;
- apply the corrected assumptions back into the builder;
- confirm the telemetry log distinguishes `assumption` edits from `role`/`format` apply actions.

---

## Task 4: Final Validation And Doc Sync

**Goal:** prove the three fixes work together and keep the local telemetry workflow usable for future reviews.

**Files:**
- Modify if needed: `docs/launch-measurement-baseline.md`
- Modify if needed: `docs/prompt-build-and-enhancement.md`
- Test: `src/test/telemetry.test.ts`
- Test: `src/test/telemetry-listener.test.ts`
- Test: all targeted suites touched above

### Step 1: Re-run the listener and usefulness suites

Run:

```bash
npx vitest run src/test/telemetry.test.ts src/test/telemetry-listener.test.ts src/test/telemetry-usefulness-events.test.ts
```

Confirm:

- the listener still records events into localStorage;
- ring-buffer behavior still caps at 500;
- the expanded payloads do not break event typing.

### Step 2: Re-run all targeted enhancement telemetry suites together

Run:

```bash
npx vitest run src/test/index-enhance-variant-persistence.test.tsx src/test/index-enhance-acceptance-telemetry.test.tsx src/test/index-enhance-controls.test.tsx src/test/index-enhance-overrides-reset.test.tsx src/test/output-panel-enhancement-inspector.test.tsx src/test/index-apply-to-builder.test.tsx src/test/index-assumption-edit-telemetry.test.tsx
```

### Step 3: Perform one live browser telemetry smoke pass

In the running app:

1. Enhance a prompt.
2. Copy the result.
3. Switch to `Use shorter`.
4. Save the result.
5. Override intent.
6. Return to `Use auto-detect`.
7. Edit an assumption.
8. Re-run enhancement.

Use `getTelemetryLog()` in the console and confirm the event sequence is coherent.

### Step 4: Update the implementation plan if payload contracts changed

If any event payload contract changes meaningfully during implementation, update `docs/plans/2026-03-09-prompt-enhancement-improvements.md` so the roadmap reflects the shipped telemetry behavior rather than the obsolete draft semantics.

### Step 5: Gate the work with repo-standard docs and test checks

Before merging, run:

```bash
npm run check:docs
```

If application code changed, also run the targeted Vitest slices above before making any claim that the telemetry findings are fully closed.

---

## Acceptance Criteria

The remediation is complete when all of the following are true:

- `builder_enhance_accepted` fires on successful copy/save/share, not on rerun.
- failed save/share attempts do not produce acceptance telemetry.
- `builder_enhance_rerun` remains available as a separate signal.
- returning to `Use auto-detect` emits `builder_enhance_intent_overridden`.
- assumptions and open questions can be edited in a real UI surface.
- `builder_enhance_assumption_edited` distinguishes actual assumption edits from structured-part apply actions.
- the launch measurement doc describes the real event contract.
- targeted telemetry tests and `npm run check:docs` pass.
