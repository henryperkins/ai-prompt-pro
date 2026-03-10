# Prompt Enhancement Improvements — Implementation Plan

**Date:** 2026-03-09
**Status:** Draft
**Revised:** 2026-03-09 — incorporated feasibility assessment findings

## Goal

Improve PromptForge's prompt enhancement capability so it preserves user intent more reliably, handles underspecified input without over-inventing details, gives users more control over the rewrite, surfaces what changed and why, and measures real usefulness instead of only completion.

## Current-State Summary

The codebase already has a meaningful enhancement pipeline:

- `agent_service/enhancement-pipeline.mjs` detects intent/domain/complexity and builds a meta-prompt.
- `agent_service/codex_service.mjs` post-processes JSON output and emits `enhance.metadata`.
- `src/pages/Index.tsx` streams the enhanced prompt, reasoning summary, and web-search activity.
- `src/components/OutputPanel.tsx` shows the final prompt, diff, sources, and streaming status.
- `src/lib/builder-inference.ts` and `shared/builder-inference-heuristics.ts` infer builder details.

The main gap is productization: the backend generates more structure and metadata than the frontend exposes, and the current routing/ambiguity logic is still too heuristic and too hidden from the user.

## Implementation Strategy

Execute this work in five phases:

1. Add visibility and instrumentation first, so later changes are measurable.
2. Add user controls and override paths before making the enhancer more aggressive.
3. Improve routing and ambiguity handling.
4. Move from a monolithic rewrite toward a structured enhancement plan.
5. Add personalization and evaluation loops after the core UX is stable.

Do not try to ship every item at once. Each task below is independently testable and should be released behind a staged rollout where noted.

---

## Phase 0: Structural Prerequisites

### Task 0: Decompose OutputPanel and add a telemetry listener

**Finding addressed:** `OutputPanel.tsx` is 1,040 lines with 23 state variables, a 200-line inlined save dialog, and 130 lines of developer-tool export handlers. Tasks 1, 3, 5, and 8 all add new sections to this component. Without decomposition first, the file becomes unmanageable and review-resistant. Additionally, the telemetry system dispatches `CustomEvent` on `window` with no listener — events fire into the void, making the measurement goals in Task 2 unachievable.

**Files:**
- Modify: `src/components/OutputPanel.tsx`
- Add: `src/components/OutputPanelSaveDialog.tsx`
- Add: `src/components/OutputPanelDevTools.tsx`
- Modify: `src/lib/telemetry.ts`
- Test: `src/test/output-panel-enhance-metadata.test.tsx` (update imports if needed)
- Test: `src/test/telemetry.test.ts`

**Step 1: Extract the save dialog**

Move the save dialog form (~lines 709-902) into `src/components/OutputPanelSaveDialog.tsx`. The new component should accept the same props the dialog currently consumes (save handlers, remix context, phase2 flag, share gates). OutputPanel renders the extracted component in place of the inlined JSX.

**Step 2: Extract developer-tool export handlers**

Move the developer-tools dropdown and its ~130 lines of copy/download handlers into `src/components/OutputPanelDevTools.tsx`. OutputPanel renders it inside the existing "More" dropdown slot.

**Step 3: Verify OutputPanel is under 700 lines**

After extraction, OutputPanel should contain only: header bar, compare dialog, reasoning summary, web search activity, main prompt card, web search sources, and the enhance button area. This creates clean insertion points for Tasks 1, 3, and 5.

**Step 4: Add a minimal telemetry listener**

In `src/lib/telemetry.ts`, add a `startTelemetryListener()` function that:

- Attaches a `window` event listener for `"promptforge:builder-telemetry"`.
- Writes events to a localStorage ring buffer (key: `"promptforge-telemetry-log"`, max: 500 events).
- Exposes a `getTelemetryLog()` function for dev-tools inspection and future forwarding.

This does not require an analytics backend. It makes the metrics defined in Task 2 (accept rate, rerun rate) queryable from the browser console and extractable for manual review.

**Step 5: Initialize the listener**

Call `startTelemetryListener()` once during app initialization (e.g., in `main.tsx` or `App.tsx`).

**Step 6: Add tests**

Verify:

- OutputPanel still renders correctly after extraction (save dialog and dev tools appear).
- Telemetry events written to localStorage can be read back via `getTelemetryLog()`.
- The ring buffer caps at 500 and drops oldest events.

**Step 7: Verify manually**

Run:

```bash
npx vitest run src/test/output-panel-enhance-metadata.test.tsx src/test/telemetry.test.ts
```

Then run the app and verify:

- save/share dialog still works end-to-end;
- developer-tools export actions still work;
- telemetry events appear in `localStorage` after clicking enhance.

---

## Phase 1: Visibility, Metadata, and Baseline Measurement

### Task 1: Surface enhancement metadata already returned by the backend

**Finding addressed:** The product behaves like a one-shot rewrite surface even though the backend already returns `parts_breakdown`, `enhancements_made`, `suggestions`, `alternative_versions`, `quality_score`, and `detected_context`.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Add: `src/lib/enhance-metadata.ts`
- Test: `src/test/output-panel-enhance-metadata.test.tsx`
- Test: `src/test/index-web-search-streaming.test.tsx`

**Step 1: Define a frontend metadata type**

Create `src/lib/enhance-metadata.ts` with a normalized TypeScript type for the `enhance.metadata` payload:

- `enhancedPrompt`
- `partsBreakdown`
- `enhancementsMade`
- `qualityScore`
- `suggestions`
- `alternativeVersions`
- `detectedContext`
- `missingParts`
- `improvementDelta`
- `sessionContextSummary`

Keep the type narrow and tolerant of missing fields so the UI can degrade gracefully when the backend falls back to raw text.

**Step 2: Capture metadata in `Index.tsx`**

In `src/pages/Index.tsx`:

- Add state for `enhanceMetadata`.
- When an `enhance/metadata` event arrives, parse and store the full payload instead of extracting only `enhanced_prompt`.
- Clear metadata at the start of each new enhancement run.
- Preserve the current prompt extraction behavior so existing streaming remains stable.

**Step 3: Pass metadata into `OutputPanel`**

Add a new prop to `OutputPanel` for `enhanceMetadata`. Keep it optional so the panel still works for pre-enhance preview mode and any legacy routes.

**Step 4: Render a lightweight “Enhancement summary” section**

In `src/components/OutputPanel.tsx`, add a compact section below the final prompt:

- “Detected” row: primary intent, domain, complexity, mode.
- “What changed” list: `enhancements_made`.
- “Watch-outs” list: `missing_parts` and any explicit assumptions once Task 4 lands.
- “Try next” list: `suggestions`.

Do not add a heavy inspector yet. Keep the first version short and scannable.

**Step 5: Render alternative versions**

If `alternative_versions.shorter` or `alternative_versions.more_detailed` is present:

- Show two buttons: `Use shorter` and `Use more detailed`.
- Applying one should replace the visible enhanced prompt in the output panel only for that session.
- Do not overwrite builder fields yet.

**Step 6: Add regression tests**

Add tests that verify:

- `Index.tsx` stores metadata from `enhance.metadata`.
- `OutputPanel` renders `enhancements_made`, `suggestions`, and alternative-version actions when metadata is present.
- Existing web-search source extraction still works.

**Step 7: Verify manually**

Run:

```bash
npx vitest run src/test/output-panel-enhance-metadata.test.tsx src/test/index-web-search-streaming.test.tsx
```

Then run the app and verify:

- a normal enhancement still streams;
- the final prompt still displays;
- metadata appears after completion without flicker.

---

### Task 2: Expand telemetry from “completion” to “usefulness”

**Finding addressed:** Current telemetry tracks load/click/completion but not whether the enhancement was actually useful.

**Prerequisite:** Task 0 must ship first. Without the telemetry listener from Task 0, these events have no consumer and the metrics defined in Step 5 cannot be measured — not even via dev-tools inspection.

**Files:**
- Modify: `src/lib/telemetry.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `docs/launch-measurement-baseline.md`
- Test: `src/test/telemetry.test.ts`

**Step 1: Add new telemetry event names**

Extend `src/lib/telemetry.ts` with:

- `builder_enhance_metadata_received`
- `builder_enhance_variant_applied`
- `builder_enhance_accepted`
- `builder_enhance_rerun`
- `builder_enhance_too_much_changed`
- `builder_enhance_assumption_edited`
- `builder_enhance_intent_overridden`

**Step 2: Define first-pass acceptance**

Implement a pragmatic acceptance heuristic in `Index.tsx`:

- If the user copies, saves, or shares the enhanced prompt before re-running enhancement, emit `builder_enhance_accepted`.
- If the user clicks enhance again within the same editing session, emit `builder_enhance_rerun`.

Do not wait for perfect analytics infrastructure. Start with deterministic in-app behavior.

**Step 3: Track alternative version usage**

When a user applies `shorter` or `more_detailed`, emit `builder_enhance_variant_applied` with:

- `variant`
- `originalPromptChars`
- `variantPromptChars`

**Step 4: Track intent overrides once Task 3 ships**

When the user changes the detected intent chip before enhancement, emit:

- `fromIntent`
- `toIntent`

**Step 5: Update the measurement doc**

In `docs/launch-measurement-baseline.md`, add:

- first-pass accept rate
- rapid rerun rate
- variant application rate
- acceptance rate for vague prompts

**Step 6: Add tests**

Update telemetry tests to verify the new event names and payloads.

**Step 7: Verify**

Run:

```bash
npx vitest run src/test/telemetry.test.ts
```

---

## Phase 2: User Controls Before Deeper Prompt Changes

### Task 3: Wire builder mode and rewrite strictness into the UI

**Finding addressed:** The backend already supports `builder_mode`, but the UI does not expose it. Users also cannot control how aggressively the prompt is rewritten.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/lib/user-preferences.ts`
- Modify: `src/lib/ai-client.ts`
- Modify: `agent_service/enhancement-pipeline.mjs`
- Modify: `agent_service/README.md`
- Test: `src/test/ai-client-auth.test.ts`
- Test: `src/test/output-panel-phase2.test.tsx`
- Test: `src/test/enhancement-pipeline.test.ts`

**Step 1: Add two new controls in the output area**

Add compact controls near the enhance button:

- `Enhancement depth`: `Light polish`, `Structured rewrite`, `Expert prompt`
- `Rewrite strictness`: `Preserve wording`, `Balanced`, `Optimize aggressively`

Map depth to existing backend modes:

- `Light polish` -> `quick`
- `Structured rewrite` -> `guided`
- `Expert prompt` -> `advanced`

Treat rewrite strictness as a new field.

**Step 2: Persist these as user preferences**

Extend `src/lib/user-preferences.ts` to store:

- `enhancementDepth`
- `rewriteStrictness`

Default to:

- `Structured rewrite`
- `Balanced`

**Step 3: Extend the enhance payload**

In `src/lib/ai-client.ts`:

- add a new optional enhancement controls object;
- include `builder_mode` from the selected depth;
- include `rewrite_strictness` in the request body.

**Step 4: Accept and normalize the new control in the backend**

In `agent_service/enhancement-pipeline.mjs`:

- add a normalizer for `rewrite_strictness`;
- include it in detected context;
- add rule blocks to the meta-prompt:
  - `Preserve wording`: minimize paraphrase, keep structure close to source;
  - `Balanced`: current behavior;
  - `Optimize aggressively`: rewrite for clarity and specificity even if wording changes substantially.

**Step 5: Update API documentation**

Add the new request field to `agent_service/README.md`.

**Step 6: Add tests**

Verify:

- the frontend sends the new fields;
- the backend normalizes them correctly;
- the meta-prompt changes when rewrite strictness changes.

**Step 7: Verify manually**

Run:

```bash
npx vitest run src/test/ai-client-auth.test.ts src/test/enhancement-pipeline.test.ts src/test/output-panel-phase2.test.tsx
```

Then compare the same prompt across all three modes and all three strictness levels to confirm the outputs materially differ in the intended direction.

---

### Task 4: Add explicit intent confirmation before enhancement

**Finding addressed:** Intent detection is currently hidden and brittle. Regex routing can silently choose the wrong prompt recipe.

**Files:**
- Modify: `agent_service/enhancement-pipeline.mjs`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/BuilderHeroInput.tsx`
- Modify: `src/lib/ai-client.ts`
- Add: `src/lib/enhance-intent.ts`
- Test: `src/test/enhancement-pipeline-intent-routing.test.ts`
- Test: `src/test/index-enhance-controls.test.tsx`

**Step 1: Introduce a primary-intent model**

In the backend, separate:

- `primaryIntent`
- `secondaryIntents`
- `intentConfidence`

from the current flat intent array.

Start with a small route set that matches PromptForge use cases:

- `brainstorm`
- `rewrite`
- `analysis`
- `code`
- `extraction`
- `planning`
- `research`

Keep the existing regex helpers as a fallback, but add tie-breaking logic based on:

- builder fields already filled;
- current format requests;
- source usage;
- presence of code terms;
- whether the prompt asks to critique existing content.

**Step 2: Expose the detected route in metadata**

Emit `primaryIntent` and `intentConfidence` in the metadata payload.

**Step 3: Add a visible intent chip in the UI**

In `BuilderHeroInput.tsx` or directly above the enhance button:

- show `Detected: Analysis` or similar;
- make it editable with a compact segmented control or dropdown;
- include a `Use auto-detect` option.

**Step 4: Send the override**

If the user changes the route, send `intent_override` in the enhance payload.

**Step 5: Respect the override in the backend**

If `intent_override` is present:

- use it as `primaryIntent`;
- retain detected intents in metadata for analysis;
- note in metadata whether the final route was user-selected or auto-detected.

**Step 6: Add tests**

Cover at least these cases:

- “Rewrite this email” should route to `rewrite`.
- “Analyze these retention numbers” should route to `analysis`.
- Mixed prompts should preserve secondary intents but choose one primary route.
- UI override should change the payload.

**Step 7: Verify manually**

Test real prompts that often get confused:

- brainstorming vs writing
- review vs rewrite
- code generation vs code explanation

---

## Phase 3: Ambiguity Handling and Better Routing

### Task 5: Replace silent over-inference with an explicit ambiguity policy

**Finding addressed:** For vague prompts, the system currently tends to infer missing context instead of letting the user choose how blanks should be handled.

**Files:**
- Modify: `agent_service/enhancement-pipeline.mjs`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/lib/ai-client.ts`
- Add: `src/lib/enhance-ambiguity.ts`
- Test: `src/test/enhancement-pipeline-ambiguity.test.ts`
- Test: `src/test/index-enhance-controls.test.tsx`

**Step 1: Define ambiguity modes**

Add a new enhancement control:

- `Ask me`
- `Use placeholders`
- `Infer conservatively`

Default to `Infer conservatively` for now.

**Step 2: Define critical missing-slot detection**

In `agent_service/enhancement-pipeline.mjs`, add a helper that flags whether these are missing:

- target artifact or deliverable
- audience
- success criteria
- source material or facts required
- time-sensitivity / factual verification need

Do not use word count alone as the primary vagueness signal.

**Step 3: Change the backend behavior by mode**

If ambiguity is high:

- `Ask me`: return a short clarification block plus a provisional prompt.
- `Use placeholders`: insert visible placeholders like `[target audience]`.
- `Infer conservatively`: keep assumptions minimal and list them explicitly.

**Step 4: Expose assumptions in metadata**

Add:

- `assumptions_made`
- `open_questions`
- `ambiguity_level`

to the metadata payload.

**Step 5: Render the result in the UI**

In `OutputPanel.tsx`:

- show assumptions as a short list;
- if `Ask me` produced clarification questions, render them in a card above the final prompt;
- add a one-click action to copy the clarification questions back into the builder prompt or session context.

**Step 6: Add tests**

Cover prompts like:

- “Write a proposal”
- “Make this better”
- “Help me with onboarding”

Verify that different ambiguity modes materially change the output.

**Step 7: Manual QA**

Use a batch of vague inputs and verify:

- the system no longer invents audience, deliverable, and constraints as if they were known facts;
- placeholders remain visible and easy to edit.

---

### Task 6a: Expand inference vocabulary and add new detection dimensions

**Finding addressed:** Local inference covers only 4 roles, 5 tones, and ~30 keywords. The vocabulary is too narrow for reliable intent routing (Task 4) and ambiguity handling (Task 5). This sub-task focuses on the heuristic layer only — no remote-inference or auto-apply changes.

**Ship before Task 5.** Tasks 4 and 5 depend on better detection to route and assess ambiguity correctly.

**Files:**
- Modify: `shared/builder-inference-heuristics.ts`
- Test: `src/test/builder-inference-heuristics.test.ts`

**Step 1: Expand the role vocabulary**

In `shared/builder-inference-heuristics.ts`, add role matches for at least:

- Support / Customer Success (`support`, `ticket`, `customer`, `helpdesk`, `escalation`, `SLA`)
- Product Strategist (`roadmap`, `prioritize`, `feature`, `PRD`, `product`, `strategy`)
- Research Analyst (`synthesis`, `literature`, `findings`, `systematic review`)
- Executive Communicator (`board`, `investor`, `stakeholder`, `executive summary`)
- Prompt Engineer / Evaluator (`evaluate`, `critique`, `review prompt`, `assess`, `grade`)

**Step 2: Add artifact-type detection**

Add a new `chooseArtifactType()` function that detects the output artifact the user wants:

- `email`, `report`, `PRD`, `proposal`, `presentation`, `code snippet`, `blog post`, `documentation`

Use keyword matching consistent with the existing pattern.

**Step 3: Add audience-hint detection**

Add a new `chooseAudience()` function that detects audience signals:

- `beginner`, `expert`, `executive`, `developer`, `customer`, `team`, `public`, `internal`

**Step 4: Add task-mode detection (transform vs generate)**

Add a new `chooseTaskMode()` function that distinguishes:

- `transform`: keywords like `rewrite`, `edit`, `revise`, `improve`, `fix`, `convert`, `translate`, `summarize`
- `generate`: keywords like `write`, `create`, `draft`, `build`, `design`, `brainstorm`, `plan`

This feeds directly into Task 4's intent routing.

**Step 5: Replace static confidence with per-match scoring**

Replace the current `INFERENCE_FIELD_CONFIDENCE` constants (static per-field values like 0.78, 0.72) with per-match confidence. When multiple keywords match for a single field, confidence should be higher than a single weak match. Start with a simple formula: `base_confidence + (0.04 * additional_match_count)`, capped at 0.95.

**Step 6: Add tests**

Add tests covering:

- each new role is detected from representative prompts;
- artifact-type detection across at least 8 artifact types;
- audience detection from explicit and implicit signals;
- task-mode detection correctly distinguishes rewrite vs generate prompts;
- per-match confidence increases with multiple keyword hits.

**Step 7: Verify**

Run:

```bash
npx vitest run src/test/builder-inference-heuristics.test.ts
```

---

### Task 6b: Feed richer context into remote inference and tighten auto-apply safety

**Finding addressed:** Remote inference receives only the prompt text and current field values. It does not know whether sources are attached, whether a preset is active, or what output format is selected. Auto-apply uses ownership checks but does not gate on confidence.

**Files:**
- Modify: `src/lib/builder-inference.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `agent_service/codex_service.mjs`
- Modify: `agent_service/README.md`
- Test: `src/test/builder-inference.test.ts`

**Step 1: Expand the remote inference request payload**

When calling remote inference in `Index.tsx`, include:

- whether the user already has sources attached;
- whether a preset/remix is active;
- whether session context exists;
- selected output formats;
- whether the prompt includes pasted source material.

**Step 2: Make auto-apply confidence-gated**

In `applyInferenceUpdates()` in `src/lib/builder-inference.ts`, add a confidence threshold check:

- Only auto-apply inferred fields when confidence exceeds 0.70 (using the per-match confidence from Task 6a).
- Below 0.70, keep the suggestion as a chip instead of writing it directly into config.
- Preserve the existing ownership check (never overwrite user-set fields).

**Step 3: Add route-oriented suggestion chips**

If the prompt looks like a `rewrite` task (using Task 6a's `chooseTaskMode()`), prefer suggestion chips that help define:

- source material
- target audience
- tone

If it looks like `analysis`, prefer:

- output format
- evidence requirements
- comparison framework

**Step 4: Update docs and tests**

Document the richer inference request payload in `agent_service/README.md`.

Add tests covering:

- the expanded request payload is sent correctly;
- confidence gating prevents low-confidence auto-apply;
- route-oriented chips change based on detected task mode;
- cases where the system should not auto-apply.

---

## Phase 4: Structured Prompt Architecture and Iteration UX

### Task 7: Introduce a canonical enhancement plan behind the final prompt

**Finding addressed:** The current output is still fundamentally a monolithic rewrite. Prompt quality will remain inconsistent until the enhancer first builds a structured plan.

**Files:**
- Modify: `agent_service/enhancement-pipeline.mjs`
- Modify: `agent_service/codex_service.mjs`
- Add: `src/lib/enhancement-plan.ts`
- Test: `src/test/enhancement-pipeline-plan-schema.test.ts`
- Test: `src/test/enhancement-pipeline.test.ts`

**Step 1: Add a new internal schema**

Extend the backend JSON schema to include an `enhancement_plan` object with:

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

Do not remove the current `enhanced_prompt` or `parts_breakdown`. Add the plan first and keep backward compatibility.

**Step 2: Change the meta-prompt**

Update the master meta-prompt so the model must:

1. infer a structured plan;
2. generate the final enhanced prompt from that plan;
3. return both in JSON.

**Step 3: Normalize the plan in post-processing**

In `postProcessEnhancementResponse`, normalize and validate `enhancement_plan` the same way you currently normalize `parts_breakdown` and `quality_score`.

**Step 4: Emit the plan in metadata**

Send the normalized plan through `enhance.metadata`.

**Step 5: Add regression tests**

Verify:

- JSON parsing still works if the plan is missing;
- fallback mode still emits a usable prompt;
- the plan is present and normalized when the model returns it.

**Step 6: Manual QA**

Compare several prompts before and after the plan change. The main check is not “is it longer,” but “is the final prompt easier to inspect, edit, and reason about.”

---

### Task 8: Turn the enhanced output into an editable parts-and-plan view

**Finding addressed:** The backend already returns structured components, but the user cannot directly edit or reuse them.

**Files:**
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/hooks/usePromptBuilder.ts`
- Add: `src/components/EnhancementInspector.tsx`
- Test: `src/test/output-panel-enhancement-inspector.test.tsx`

**Step 1: Add an inspector component**

Create `src/components/EnhancementInspector.tsx` that renders:

- 6-part breakdown fields;
- canonical plan fields from Task 7;
- assumptions;
- open questions.

Start with read-only cards plus `Edit in builder` actions.

**Step 2: Add “Apply to builder” actions**

For each major part:

- `Role` -> update role/customRole
- `Context` -> update context or session context summary
- `Output format` -> update format/length fields where possible
- `Guardrails` -> update constraints/custom constraint

Do not try to perfectly reverse-parse prose into every builder field on day one. Prefer partial, deterministic mapping.

**Step 3: Add “Apply all structured parts”**

Provide one action that maps the editable plan back into builder fields and opens Zone 2 / Zone 3 so the user can inspect the changes.

**Step 4: Track structured edits**

Emit telemetry when the user edits:

- assumptions,
- role,
- format,
- guardrails,
- applied alternative versions.

**Step 5: Add tests**

Cover:

- inspector rendering;
- apply-to-builder actions;
- no-op behavior when metadata is absent.

**Step 6: Manual QA**

Verify a user can:

- enhance a vague input,
- inspect the inferred parts,
- fix one bad assumption,
- reuse the improved structure without rerunning from scratch.

---

## Phase 5: Personalization and Evaluation Loop

### Task 9: Add lightweight personalization from accepted edits

**Finding addressed:** PromptForge remembers web-search preference and recent presets, but not what kind of enhanced prompt the user consistently accepts.

**Files:**
- Modify: `src/lib/user-preferences.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/lib/telemetry.ts`
- Add: `src/lib/prompt-enhancement-profile.ts`
- Test: `src/test/prompt-enhancement-profile.test.ts`

**Step 1: Define a local enhancement profile**

Create a local profile that stores soft preferences such as:

- preferred enhancement depth
- preferred rewrite strictness
- preferred ambiguity mode
- commonly accepted output format
- whether the user often chooses shorter or more detailed variants

Start with local storage only. Do not block on a server-side profile system.

**Step 2: Update the profile from accepted actions**

When a user:

- accepts an output,
- repeatedly selects a variant,
- overrides an intent,
- edits assumptions,

update the local profile with small weighted counts.

**Step 3: Use the profile carefully**

Apply personalization only as defaults or suggestions:

- preselect the user’s most common enhancement depth;
- bias ambiguity mode based on past usage;
- suggest the most common output structure.

Never silently override explicit user input.

**Step 4: Add a reset control**

In the UI, add a simple “Reset enhancement preferences” action near session/preferences controls.

**Step 5: Add tests**

Verify:

- profile creation,
- profile updates,
- reset behavior,
- no mutation when the user has made no explicit action.

---

### Task 10: Build a real evaluation loop for prompt enhancement quality

**Finding addressed:** There is no stable regression harness for intent preservation, assumption quality, or usefulness on vague prompts.

**Files:**
- Add: `docs/evals/prompt-enhancement-eval-set.md`
- Add: `src/test/fixtures/prompt-enhancement-evals.json`
- Add: `src/test/prompt-enhancement-evals.test.ts`
- Modify: `docs/launch-measurement-baseline.md`

**Step 1: Create a small eval set**

Build a 50-100 case eval set from real PromptForge scenarios, split across:

- vague prompts
- rewrite tasks
- analysis tasks
- code tasks
- brainstorming tasks
- fact-sensitive tasks

For each case, store:

- raw input
- expected primary intent
- expected ambiguity behavior
- minimum acceptable structure
- forbidden hallucinated assumptions

**Step 2: Add deterministic checks first**

In `src/test/prompt-enhancement-evals.test.ts`, start with checks that do not require model scoring:

- correct route selected,
- placeholders included when required,
- assumptions emitted when ambiguity is high,
- structured fields present.

**Step 3: Define live-product metrics**

Track at least:

- first-pass accept rate,
- rapid rerun rate,
- pre-vs-post edit distance,
- vague-prompt accept rate,
- “too much changed” trigger rate,
- alternative-version usage rate.

**Step 4: Add a simple review cadence**

Add a short weekly evaluation ritual to the doc:

- inspect regressions;
- inspect top failed vague prompts;
- inspect top override cases where detected intent was wrong;
- inspect changes in acceptance rate after releases.

**Step 5: Roll out behind staged releases**

Use staged release controls for:

- structured inspector,
- ambiguity policy,
- intent confirmation,
- personalization.

This lets you validate each change without coupling the whole roadmap together.

---

## Recommended Execution Order

Implement in this order:

1. **Task 0**: decompose OutputPanel + add telemetry listener *(prerequisite)*
2. **Task 1**: surface metadata
3. **Task 2**: expand telemetry
4. **Task 6a**: expand inference vocabulary *(moved earlier — Tasks 4 and 5 depend on better detection)*
5. **Task 3**: enhancement depth + rewrite strictness
6. **Task 4**: intent confirmation
7. **Task 5**: ambiguity policy
8. **Task 6b**: richer remote inference + auto-apply safety
9. **Task 7**: canonical enhancement plan
10. **Task 8**: editable inspector
11. **Task 9**: personalization
12. **Task 10**: eval loop

**Changes from original order:**

- **Task 0 added** as a structural prerequisite. OutputPanel decomposition prevents the file from growing past maintainability during Tasks 1, 3, and 5. The telemetry listener makes Task 2's metrics actually measurable.
- **Task 6 split into 6a and 6b.** Task 6a (vocabulary expansion) is moved before Tasks 4 and 5 because intent routing and ambiguity assessment both depend on richer detection. Task 6b (remote context and auto-apply safety) stays in its original position since it builds on the controls from Tasks 3-5.
- The rest of the order is unchanged. Early work remains low-risk and measurable, while later work changes the architecture only after the product has better visibility and control.

## Definition of Done

This initiative is complete when all of the following are true:

- the user can see detected intent, key changes, assumptions, and next-step suggestions;
- the user can choose enhancement depth, rewrite strictness, and ambiguity behavior;
- vague prompts no longer force hidden assumptions as the default behavior;
- the enhancer produces and exposes a structured plan behind the final prompt;
- users can reuse or edit structured output without fully rerunning enhancement;
- the product tracks first-pass acceptance and rerun rate;
- PromptForge has an eval set that catches routing and ambiguity regressions.

## Feasibility Notes (from codebase assessment, 2026-03-09)

These notes capture what the codebase assessment confirmed so that implementers do not need to re-investigate.

### What already works

| Capability | Location | Status |
|---|---|---|
| Backend produces `parts_breakdown`, `enhancements_made`, `suggestions`, `alternative_versions`, `quality_score`, `detected_context`, `missing_parts`, `improvement_delta` | `agent_service/enhancement-pipeline.mjs`, `agent_service/codex_service.mjs` | Fully working — emitted in every `enhance.metadata` SSE event |
| `builder_mode` parameter end-to-end | `ai-client.ts` accepts it; `enhancement-pipeline.mjs` normalizes it | Exists but `Index.tsx` never passes it — wiring only |
| Field ownership model (AI vs user vs empty) | `src/lib/builder-inference.ts` | Fully working |
| Rollout configuration | Builder and enhancement defaults | Always-on behavior with no frontend toggle layer |
| User preferences with localStorage | `src/lib/user-preferences.ts` | 5 fields, clean pattern, trivial to extend |
| Suggestion chips in BuilderHeroInput | `src/components/BuilderHeroInput.tsx` | 168 lines, good template for intent chips (Task 4) |

### What the frontend currently discards

`Index.tsx` line 330 (`extractEnhancedPromptFromMetadataEvent`) reads only `payload.payload.enhanced_prompt` from the `enhance.metadata` event. All other fields are silently dropped. Task 1 is primarily a frontend wiring task — the data is already there.

### What is completely missing

| Capability | Required by | Effort |
|---|---|---|
| `primaryIntent` / `intentConfidence` (ranked intent with confidence) | Task 4 | Medium — needs ranking logic in `classifyIntent`, confidence heuristic, new metadata fields |
| `rewrite_strictness` parameter end-to-end | Task 3 | Medium — new param in `ai-client.ts`, backend normalizer, meta-prompt rule blocks |
| `ambiguity_mode` parameter end-to-end | Task 5 | Medium-High — new param, new JSON schema fields (`assumptions_made`, `open_questions`), new meta-prompt behavior |
| `enhancement_plan` structured object | Task 7 | Medium — new JSON schema, two-step meta-prompt, new normalization |
| Artifact type, audience, and task-mode detection | Task 6a | High — new heuristic functions, expanded keyword lists, per-match confidence |
| Telemetry consumer/aggregation | Task 0 (new) | Low — localStorage ring buffer listener |
| Enhancement profile with behavioral counts | Task 9 | Medium — new file with localStorage persistence |

### Risk: telemetry has no consumer

Telemetry events dispatch as `CustomEvent` on `window` with no listener anywhere in the codebase. Task 0 addresses this with a minimal localStorage ring buffer. This is not a full analytics pipeline — metrics like "first-pass accept rate" will be measurable via dev-tools console and manual extraction, not via dashboards. A real analytics integration remains out of scope but should be considered once event volume and definitions stabilize.

### Risk: OutputPanel complexity ceiling

At 1,040 lines with 23 state variables, OutputPanel is at the edge of comfortable single-component complexity. Task 0 addresses this by extracting the save dialog and developer-tools handlers before any new sections are added.

### Risk: inference heuristics are narrow

The current heuristic vocabulary covers ~30 keywords across 4 roles and 5 tones. Confidence scoring is static per-field (not per-match). Task 6a addresses this as a focused vocabulary-expansion task, moved earlier in the execution order so Tasks 4 and 5 can depend on richer detection.

## Out of Scope

- Replacing Codex transport or streaming architecture
- Building a new analytics backend before instrumentation improvements ship (Task 0's localStorage listener is a stopgap, not a replacement)
- Full server-side personalization profiles
- Deep model fine-tuning or proprietary ranking systems
