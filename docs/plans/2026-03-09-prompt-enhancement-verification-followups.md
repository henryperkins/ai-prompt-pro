# Prompt Enhancement Verification Follow-Up Plan

**Date:** 2026-03-09
**Status:** Draft
**Source:** Verification of `docs/plans/2026-03-09-prompt-enhancement-improvements.md`

## Goal

Close the remaining implementation gaps found during verification without regressing the slices that already work. This plan is intentionally narrower than the original roadmap: it addresses the specific findings that prevented the original plan from being considered fully implemented.

## Findings Covered

1. `builder_enhance_accepted` is emitted on rerun instead of on actual acceptance.
2. Ambiguity / clarification UX is incomplete.
3. Remote builder inference still lacks the richer context planned in Task 6b.
4. The structured inspector is only partially implemented.
5. Personalization/profile tracking is incomplete.
6. The evaluation loop and measurement docs are still under-scoped.

## Implementation Order

Implement in this order:

1. Fix telemetry semantics first.
2. Finish the ambiguity UX.
3. Expand remote inference request context.
4. Complete the structured inspector.
5. Finish personalization and add a reset surface.
6. Expand the eval set and missing measurement metrics.

This order keeps metrics trustworthy before adding more behavior that depends on them.

---

## Workstream 1: Correct Acceptance and Rerun Telemetry

**Finding addressed:** `builder_enhance_accepted` currently fires only when the user starts another enhancement run, not when they actually copy/save/share the result. That makes first-pass acceptance metrics inaccurate.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/lib/telemetry.ts`
- Modify: `src/lib/prompt-enhancement-profile.ts`
- Modify: `docs/launch-measurement-baseline.md`
- Test: `src/test/telemetry-usefulness-events.test.ts`
- Test: `src/test/index-enhance-variant-persistence.test.tsx`
- Test: `src/test/output-panel-enhance-metadata.test.tsx` if needed for callback wiring

### Step 1: Introduce run-scoped acceptance state

In `src/pages/Index.tsx`, add refs that track one enhancement attempt at a time:

- `activeEnhanceRunIdRef`
- `acceptedRunIdsRef`
- `lastEnhanceInputSnapshotRef`

The snapshot should capture:

- `inputPromptChars`
- `inputWordCount`
- `ambiguityLevel`
- `isVaguePrompt`
- `selectedVariant`

Define `isVaguePrompt` deterministically. Use one rule everywhere, for example:

- `inputWordCount < 20`, or
- `enhanceMetadata?.ambiguityLevel === "high"`

Prefer storing both so reporting can evolve later.

### Step 2: Create a shared acceptance helper

In `Index.tsx`, add a helper such as `trackEnhanceAccepted(source)` that:

- checks whether the current run has already been accepted;
- emits `builder_enhance_accepted` immediately;
- records personalization acceptance only once per run;
- stores the acceptance so later copy/save/share actions do not double-count.

The payload should include:

- `source`: `copy` | `save` | `save_share`
- `promptChars`
- `variant`
- `inputPromptChars`
- `inputWordCount`
- `isVaguePrompt`
- `ambiguityLevel`

### Step 3: Emit acceptance at the real user action

Wire the helper into the actual acceptance points:

- copy success in `OutputPanel.tsx`
- private save success in `handleSavePrompt`
- save-and-share success in `handleSaveAndSharePrompt`

Do not emit acceptance on failed save/share attempts.

Recommended wiring:

- replace the vague `onPromptUsed` behavior with a more explicit callback such as `onPromptAccepted(source)`, or
- keep `onPromptUsed` for generic UX state but add a second callback dedicated to telemetry semantics.

### Step 4: Remove acceptance emission from the rerun path

In `handleEnhance`, stop emitting `builder_enhance_accepted` before the rerun starts. That branch should do only rerun bookkeeping.

Keep `builder_enhance_rerun`, but make it independent from acceptance.

### Step 5: Record reruns in the local profile

`recordEnhancementAction({ type: "rerun" })` exists but is not used. Add it when a rerun starts.

Do this only when:

- an enhanced prompt already exists, and
- the user starts another enhancement run.

### Step 6: Make the “vague prompt accept rate” measurable

Update the acceptance event payload and `docs/launch-measurement-baseline.md` so the metric is based on emitted payload fields instead of a doc-only formula.

The metric should be computable from telemetry with no hidden assumptions.

### Step 7: Add regression tests

Add or update tests to verify:

- copy emits `builder_enhance_accepted` immediately;
- save emits `builder_enhance_accepted` immediately after success;
- save-and-share emits `builder_enhance_accepted` immediately after success;
- rerun emits only `builder_enhance_rerun`;
- only one acceptance event is emitted per enhancement run;
- variant payload uses the selected visible prompt, not always the original enhanced prompt.

### Step 8: Manual verification

Run:

```bash
npx vitest run src/test/telemetry-usefulness-events.test.ts src/test/index-enhance-variant-persistence.test.tsx
```

Then verify in the browser:

- copy once -> one acceptance event appears in the telemetry log;
- save once -> one acceptance event appears even if the user never reruns;
- rerun without accepting -> rerun event only;
- rerun after accepting -> one acceptance event and one rerun event, not two acceptances.

### Definition of done

- `builder_enhance_accepted` is emitted by actual acceptance actions.
- `builder_enhance_rerun` is emitted only by reruns.
- `getTelemetryLog()` is enough to compute first-pass acceptance and vague-prompt acceptance.

---

## Workstream 2: Finish the Ambiguity / Clarification UX

**Finding addressed:** assumptions and open questions are shown only as passive lists. The planned clarification card and one-click actions are missing.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Add: `src/components/EnhancementClarificationCard.tsx`
- Add: `src/lib/enhance-ambiguity.ts`
- Test: `src/test/output-panel-enhance-metadata.test.tsx`
- Test: `src/test/output-panel-phase2.test.tsx` if the new controls live near the output actions

### Step 1: Add a small ambiguity UI helper

Create `src/lib/enhance-ambiguity.ts` with helpers such as:

- `shouldShowClarificationCard(metadata, ambiguityMode)`
- `formatClarificationQuestions(openQuestions)`
- `buildClarificationBlock(openQuestions)`

Keep these helpers deterministic and frontend-only.

### Step 2: Render a dedicated clarification card above the final prompt

Create `src/components/EnhancementClarificationCard.tsx`.

Render it above the main output card when:

- `metadata.openQuestions` exists and is non-empty, and
- the ambiguity mode or metadata indicates the run was clarification-heavy.

The card should show:

- a short heading such as `Clarification needed`;
- the open questions as a numbered list;
- a short explanation that the prompt is provisional until those questions are answered.

### Step 3: Add one-click actions

Add three actions to the clarification card:

- `Add questions to prompt`
- `Add to session context`
- `Copy questions`

Implementation guidance:

- `Add questions to prompt` should append a structured block to `config.originalPrompt`.
- `Add to session context` should append the same block to the carry-forward session context used by the Codex session drawer.
- `Copy questions` should copy the numbered list directly to the clipboard.

If the session context is currently hidden, open the relevant drawer after appending the questions.

### Step 4: Reuse existing section-opening behavior

`Index.tsx` already has state for advanced sections and a helper that focuses sections. Reuse existing UI state rather than inventing a new navigation model.

If appending questions to prompt or session context should surface Zone 3, call the existing open/focus behavior after the write completes.

### Step 5: Avoid duplicated question rendering

Once the clarification card exists, decide which surface is canonical:

- keep the summary view short; or
- keep the summary row but replace the full open-question list with a link or count.

Do not render the exact same question list twice in the same viewport.

### Step 6: Add tests

Verify:

- the clarification card appears when `openQuestions` are present;
- `Add questions to prompt` appends the expected block;
- `Add to session context` updates the session context state;
- `Copy questions` uses the clipboard helper;
- no card renders when metadata has no questions.

### Step 7: Manual verification

Use a vague input with `Ask me` mode and verify:

- the clarification card renders above the prompt;
- the output still shows the provisional enhanced prompt;
- one click can move the questions into the prompt builder;
- one click can move the questions into the session carry-forward context.

### Definition of done

- users can act on clarification questions without manually copy/pasting;
- ambiguity-heavy runs have a dedicated surface above the prompt;
- the questions are no longer hidden in a generic metadata list.

---

## Workstream 3: Expand Remote Inference Request Context

**Finding addressed:** Task 6b planned richer context for `/infer-builder-fields`, but the request still sends only prompt text, current fields, and lock metadata.

**Files:**
- Modify: `src/lib/ai-client.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `agent_service/codex_service.mjs`
- Modify: `agent_service/README.md`
- Test: `src/test/builder-inference.test.ts`
- Add or update: client payload tests if a dedicated file exists for `inferBuilderFields()`

### Step 1: Extend the frontend request type

In `src/lib/ai-client.ts`, add an optional request-context object, for example:

```ts
requestContext?: {
  hasAttachedSources: boolean;
  attachedSourceCount: number;
  hasPresetOrRemix: boolean;
  hasSessionContext: boolean;
  selectedOutputFormats: string[];
  hasPastedSourceMaterial: boolean;
}
```

Keep all fields optional in the wire payload for backward compatibility.

### Step 2: Build the richer context in `Index.tsx`

When calling `inferBuilderFields`, populate the request context from current UI state:

- `hasAttachedSources` / `attachedSourceCount` from `config.contextConfig.sources`
- `hasPresetOrRemix` from preset/remix state
- `hasSessionContext` from the current Codex session carry-forward context
- `selectedOutputFormats` from builder format selections plus `customFormat`
- `hasPastedSourceMaterial` from prompt heuristics or context inputs that clearly contain source text

Do not guess. If a signal cannot be known reliably, omit it.

### Step 3: Serialize the new context in the client payload

In `inferBuilderFields()`, include the new `request_context` block only when at least one field is present.

Keep `current_fields` and `lock_metadata` unchanged so the endpoint remains backward-compatible.

### Step 4: Include the new context in the server-side inference prompt

In `agent_service/codex_service.mjs`, update `buildInferUserMessage()` so the remote inference model sees the new signals in a compact, structured way.

Recommended format:

- prompt
- already-set fields
- locked fields
- request context block

Example items to surface:

- attached source count
- preset/remix active
- session context present
- selected output formats
- pasted source material present

### Step 5: Use the new context to improve suggestion relevance

Adjust the route-oriented suggestion logic so the model and frontend do not recommend details that are already present.

Examples:

- if sources are already attached, do not prioritize “Add source material”;
- if output format is already selected, reduce or remove “Specify output format”;
- if session context exists, avoid redundant context-sourcing suggestions.

### Step 6: Update docs

Expand the `/infer-builder-fields` body example in `agent_service/README.md` to include the new request context.

### Step 7: Add tests

Verify:

- the client sends `request_context` when those signals are present;
- the client omits the block when empty;
- server-side prompt construction includes the context fields;
- suggestion chips change when sources/formats are already present.

### Step 8: Manual verification

Run:

```bash
npx vitest run src/test/builder-inference.test.ts
```

Then verify in the app:

- attach sources and confirm “Add source material” stops dominating suggestions;
- choose an output format and confirm format suggestions become less redundant;
- enable remix/preset/session context and confirm the inferred guidance becomes more context-aware.

### Definition of done

- `/infer-builder-fields` receives the planned richer context;
- the extra context changes suggestion relevance in observable ways;
- the README matches the real endpoint contract.

---

## Workstream 4: Complete the Structured Inspector

**Finding addressed:** the inspector shows only part of the structured response and does not fully support the planned apply/edit workflow.

**Files:**
- Modify: `src/components/EnhancementInspector.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/hooks/usePromptBuilder.ts` only if builder updates are easier to centralize there
- Add: `src/test/output-panel-enhancement-inspector.test.tsx`

### Step 1: Expand the inspector to cover the full structured payload

Render all six parts of `partsBreakdown`:

- `role`
- `context`
- `task`
- `output_format`
- `examples`
- `guardrails`

Also render the missing plan fields from `enhancementPlan`:

- `primary_intent`
- `source_task_type`
- `target_deliverable`
- `audience`
- `required_inputs`
- `constraints`
- `success_criteria`
- `assumptions`
- `open_questions`
- `verification_needs`

### Step 2: Split builder-mappable fields from plan-only fields

Use two sub-sections:

- `Apply to builder`
- `Plan details`

This keeps deterministic writes separate from read-only or copy-first fields.

### Step 3: Expand the apply payload contract

Extend `ApplyToBuilderUpdate` so it can represent all deterministic mappings:

- `role`
- `context`
- `task`
- `format`
- `examples`
- `constraints`
- optional metadata such as `openSections`

Do not force irreversible prose parsing for fields that do not map cleanly.

### Step 4: Define deterministic mapping rules

Use these mappings:

- `role` -> `customRole`
- `context` -> `context`
- `task` -> append or merge into the builder prompt/task source, not a lossy overwrite
- `output_format` -> `customFormat` plus length reconciliation
- `examples` -> builder examples field
- `guardrails` and plan `constraints` -> `customConstraint`

For `required_inputs`, `verification_needs`, `assumptions`, and `open_questions`, prefer copy/apply-to-context actions rather than pretending they are native builder fields.

### Step 5: Implement “Apply all structured parts” fully

When the user clicks `Apply all to builder`:

- write all deterministic fields;
- mark ownership correctly;
- open Zone 2 and Zone 3 using the existing section-opening behavior;
- scroll the user to the updated areas if appropriate.

Do not leave “apply all” as a silent config mutation.

### Step 6: Clean up telemetry naming and payloads

The current `builder_enhance_assumption_edited` event is being reused for generic apply actions. Make the payload explicit enough to distinguish:

- `field`
- `action`
- `source`

If needed, add a second event rather than overloading one name ambiguously.

### Step 7: Add tests

Create `src/test/output-panel-enhancement-inspector.test.tsx` and cover:

- full inspector rendering;
- per-field apply buttons;
- `Apply all structured parts`;
- no-op behavior when metadata is absent;
- assumptions/open questions plan data rendering.

### Step 8: Manual verification

Verify a real flow:

1. enhance a vague prompt;
2. inspect the structured parts;
3. apply role, format, and guardrails individually;
4. apply all structured parts;
5. confirm the corresponding advanced sections open and show the changes.

### Definition of done

- the inspector surfaces the full structured payload returned by the backend;
- deterministic fields can be reused without rerunning enhancement;
- apply-all visibly opens the right builder surfaces.

---

## Workstream 5: Finish Personalization and Add a Reset Surface

**Finding addressed:** the profile remembers only a subset of user behavior and has no reset control in the UI.

**Files:**
- Modify: `src/lib/prompt-enhancement-profile.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/EnhancementInspector.tsx`
- Modify: `src/lib/user-preferences.ts` only if the reset UI should clear both profile and preference defaults
- Test: `src/test/prompt-enhancement-profile.test.ts`
- Add or update: UI tests for the reset control

### Step 1: Expand the profile schema

Add storage for the missing behavior that the verification found absent:

- `intentOverrideCounts`
- `assumptionEditCounts`
- `formatCounts`
- optional `structuredApplyCounts`

Keep the schema additive and tolerant of missing keys so old localStorage entries still load.

### Step 2: Add explicit action types

Extend `recordEnhancementAction()` with new cases such as:

- `intent_overridden`
- `assumption_edited`
- `format_accepted`
- `structured_apply_all`

Use small integer increments. Do not add probabilistic weighting yet.

### Step 3: Wire the new actions from real user behavior

Emit profile updates from:

- `handleIntentOverrideChange`
- assumption / field apply actions in `EnhancementInspector`
- successful acceptance actions after the telemetry fix
- successful `Apply all structured parts`

Keep the profile and telemetry in sync conceptually, but do not require them to share the exact same event names.

### Step 4: Use the richer profile carefully

Extend the existing default-selection logic so it can:

- keep preselecting depth, strictness, and ambiguity only after enough usage;
- suggest the most common accepted output structure;
- avoid silently overwriting explicit current-session choices.

Do not auto-apply output-format changes based only on profile counts.

### Step 5: Add a visible reset action

Add a `Reset enhancement preferences` action near existing session/preferences controls in `Index.tsx`.

The reset should:

- clear the enhancement profile;
- optionally reset enhancement-specific user preferences back to defaults;
- leave unrelated product preferences untouched unless explicitly intended.

Show a toast confirming what was reset.

### Step 6: Add tests

Verify:

- profile migration still works with missing older keys;
- new action types update the expected counters;
- reset clears the expanded schema;
- the reset UI invokes the clear path and restores defaults.

### Step 7: Manual verification

Verify:

1. override intent a few times and confirm the profile changes;
2. apply assumptions / structured fields and confirm those counters change;
3. reset preferences and confirm both the profile and enhancement defaults return to baseline.

### Definition of done

- the profile tracks the missing explicit user actions;
- personalization uses those signals conservatively;
- the user can reset enhancement-specific learned behavior from the UI.

---

## Workstream 6: Expand the Eval Loop and Missing Metrics

**Finding addressed:** the eval set is still much smaller than planned, and the measurement docs do not yet cover edit distance or “too much changed” tracking.

**Files:**
- Modify: `docs/evals/prompt-enhancement-eval-set.md`
- Modify: `src/test/fixtures/prompt-enhancement-evals.json`
- Modify: `src/test/prompt-enhancement-evals.test.ts`
- Modify: `docs/launch-measurement-baseline.md`
- Modify: `src/lib/telemetry.ts`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/pages/Index.tsx`
- Test: `src/test/prompt-enhancement-evals.test.ts`
- Test: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Expand the eval fixture set to at least 50 cases

Target 60 cases so there is room to trim later without dropping below the original 50-case floor.

Keep category coverage balanced across:

- vague prompts
- rewrite tasks
- analysis tasks
- code tasks
- brainstorming tasks
- extraction tasks
- research tasks
- planning tasks
- fact-sensitive tasks

### Step 2: Strengthen the fixture schema

Add fields that let deterministic tests cover more of the roadmap:

- `expectedPrimaryIntent`
- `expectedAmbiguityLevel`
- `expectedMissingSlots`
- `requiresPlaceholders`
- `requiresOpenQuestions`
- `expectedStructuredFields`
- `forbiddenAssumptions`

Do not rely on live model scoring for this layer.

### Step 3: Add deterministic checks for ambiguity behavior

Extend `src/test/prompt-enhancement-evals.test.ts` so it checks not just routing and missing slots, but also:

- placeholder mode behavior with canned post-processed payloads;
- clarification-question behavior with canned payloads;
- structured plan presence where expected;
- forbidden assumptions staying absent from normalized metadata.

If a needed normalization helper is not exported, export the smallest pure helper necessary rather than testing through the whole service.

### Step 4: Add the missing usefulness metrics

Implement the remaining live-product metrics that the docs already claim to care about:

- pre-vs-post edit distance
- `builder_enhance_too_much_changed`

Recommended implementation:

- compute edit distance or diff ratio from `builtPrompt` vs `selectedEnhancedPrompt`;
- include the ratio in acceptance / rerun payloads;
- add an explicit `Too much changed` action near the diff / variant controls and emit `builder_enhance_too_much_changed` when used.

### Step 5: Update the measurement baseline doc

In `docs/launch-measurement-baseline.md`, add:

- the edit-distance metric definition;
- the too-much-changed trigger-rate definition;
- the exact event payload fields needed to compute them.

Make the formulas match the implementation exactly.

### Step 6: Update the eval doc

In `docs/evals/prompt-enhancement-eval-set.md`, replace the outdated 23-case description with the real target and real category counts.

Also document:

- how new cases should be added;
- which failures are blockers vs advisory;
- the weekly review steps for routing failures, ambiguity failures, and too-much-changed spikes.

### Step 7: Add tests

Verify:

- the expanded fixture file loads correctly;
- new deterministic ambiguity assertions pass;
- edit-distance fields appear in telemetry payloads;
- `builder_enhance_too_much_changed` is emitted when the UI affordance is used.

### Step 8: Manual verification

Run:

```bash
npx vitest run src/test/prompt-enhancement-evals.test.ts src/test/telemetry-usefulness-events.test.ts
```

Then manually verify:

- the eval doc count matches the actual fixture count;
- the new metric formulas in the baseline doc match the telemetry payloads in localStorage;
- the “Too much changed” action is visible and emits the event.

### Definition of done

- the eval set is at least 50 cases;
- the docs and code agree on which usefulness metrics exist;
- routing, ambiguity, and “too much changed” regressions have deterministic coverage.

---

## Baseline Protection

Before merging any of these changes, keep the currently passing verification slice green:

```bash
npx vitest run \
  src/test/telemetry-usefulness-events.test.ts \
  src/test/telemetry-listener.test.ts \
  src/test/output-panel-enhance-metadata.test.tsx \
  src/test/output-panel-phase2.test.tsx \
  src/test/index-web-search-streaming.test.tsx \
  src/test/enhancement-pipeline.test.ts \
  src/test/enhancement-pipeline-intent-routing.test.ts \
  src/test/enhancement-pipeline-ambiguity.test.ts \
  src/test/enhancement-pipeline-plan-schema.test.ts \
  src/test/builder-inference-heuristics.test.ts \
  src/test/builder-inference.test.ts \
  src/test/index-enhance-variant-persistence.test.tsx \
  src/test/index-enhance-overrides-reset.test.tsx \
  src/test/prompt-enhancement-profile.test.ts \
  src/test/prompt-enhancement-evals.test.ts
```

## Completion Criteria

This follow-up plan is complete when:

- acceptance telemetry matches actual acceptance behavior;
- ambiguity-heavy runs have an actionable clarification UI;
- remote inference sees the richer context Task 6b intended;
- the structured inspector exposes and reuses the full structured payload;
- personalization tracks intent overrides and assumption edits and can be reset;
- the eval set and metrics coverage match the documented expectations.
