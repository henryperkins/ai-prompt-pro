# PromptForge Verified Remediation Plan (2026-03-09)

## Scope

This plan supersedes the earlier draft remediation list and only covers issues still present after verifying `plans/audit-combined-6f12621-through-head.md` against current `HEAD`.

### Remaining issues in scope

1. Ambiguity heuristics still under-detect missing information.
2. Save/share dialog still closes before async save success is known.
3. `parseDetectedContext()` still drops payloads that only contain `primary_intent`.
4. Variant-aware enhancement telemetry still records the original prompt length instead of the selected variant length.
5. Enhancement rollout controls were only partially wired:
   - `enhancementIntentConfirmation` is wired.
   - `enhancementPersonalization` is wired.
   - `enhancementStructuredInspector` is not fully wired.
   - `enhancementAmbiguityPolicy` is not fully wired.
6. Apply-to-builder format syncing still leaves `lengthPreference` out of sync with inspector-applied format text.
7. Local telemetry storage still has a cross-tab read/modify/write race.
8. Generated audit and output artifacts are still tracked in git.

## Priorities

### P0 - fix first

1. Save/share dialog async behavior.
2. Ambiguity heuristic false negatives.

### P1 - fix in the next pass

3. `primary_intent` metadata guard.
4. Variant telemetry sizing.
5. Partial rollout-control wiring.
6. Apply-to-builder format/length sync.

### P2 - cleanup and hardening

7. Cross-tab telemetry storage race.
8. Generated artifact cleanup and ignore rules.

## Recommended Delivery Order

1. Ship the user-facing correctness fixes first: save/share dialog, ambiguity heuristics, metadata guard, and variant telemetry sizing.
2. Then close the rollout-contract gaps: rollout-control cleanup and apply-to-builder format/length synchronization.
3. Finish with infrastructure hygiene: telemetry storage hardening and generated artifact cleanup.

## Issue 1: Make save/share dialog transactional

Files:

- `src/components/OutputPanelSaveDialog.tsx`
- `src/components/OutputPanel.tsx`
- `src/pages/Index.tsx`
- `src/test/output-panel-phase2.test.tsx`
- optionally new `src/test/output-panel-save-dialog-async.test.tsx`

### Goal

Do not close or clear the dialog until a save/share operation actually succeeds.

### Step-by-step

1. Change the callback contract from synchronous fire-and-forget to an awaited result:
   - `onSavePrompt: (input) => Promise<boolean>`
   - `onSaveAndSharePrompt: (input) => Promise<boolean>`
2. In `OutputPanel.tsx`, update prop types to match the async contract and pass the async handlers through unchanged.
3. In `OutputPanelSaveDialog.tsx`, make `handleSubmit()` async.
4. Add local `isSubmitting` state so the dialog can:
   - disable the submit button while a request is in flight,
   - prevent double-submits,
   - optionally disable close toggles while awaiting the result.
5. Keep validation exactly where it is today, but return early before starting async work when validation fails.
6. Await the selected callback result.
7. Close the dialog and reset local form state only when the callback resolves `true`.
8. Leave the dialog open, with all user-entered values intact, when the callback resolves `false`.
9. In `Index.tsx`, update `handleSavePrompt()` to return:
   - `true` only after `savePrompt(...)` succeeds,
   - `false` when the save fails after showing a toast.
10. In `Index.tsx`, update `handleSaveAndSharePrompt()` to return:
    - `true` only after `saveAndSharePrompt(...)` succeeds,
    - `false` when the user is not signed in,
    - `false` when the save/share call fails after showing a toast.
11. Preserve the current success and error toast behavior so users still get feedback without relying on dialog state.
12. Add regression tests that prove:
    - success closes the dialog,
    - rejected/failed save keeps the dialog open,
    - failed save preserves title/use case/remix note,
    - repeated clicks during pending state do not invoke duplicate requests.

### Verification

1. `npx vitest run src/test/output-panel-phase2.test.tsx`
2. `npx vitest run src/test/output-panel-save-dialog-async.test.tsx` (if created)
3. Manual smoke: open Save Prompt, trigger a forced failure, confirm the dialog stays open with all values preserved.

### Exit criteria

Users never lose entered save/share data because of a transient async failure.

## Issue 2: Tighten ambiguity heuristics so mirrored builder fields do not hide missing slots

Files:

- `agent_service/enhancement-pipeline.mjs`
- `src/pages/Index.tsx` (only if payload shaping needs adjustment)
- `src/test/enhancement-pipeline-ambiguity.test.ts`

### Goal

Keep missing-slot detection accurate when builder fields echo the raw prompt, and make audience detection case-insensitive and more robust.

### Step-by-step

1. In `detectMissingSlots()`, normalize the raw prompt and all builder-field strings once at the top of the function.
2. Extract small helpers so the detection rules are explicit and testable:
   - `hasArtifactSignal(text)`
   - `hasAudienceSignal(text)`
   - `hasSuccessCriteriaSignal(text)`
   - `hasSourceMaterialSignal(text)`
3. Stop treating any non-empty `builderFields.task` as proof that `target_deliverable` is present.
4. Replace that rule with a stricter check:
   - if the raw prompt already contains an artifact noun, treat deliverable as present;
   - otherwise only treat the builder task as evidence when it adds structured detail beyond the raw prompt or contains an explicit artifact noun;
   - if the builder task is effectively the same short/vague text as the raw prompt, do not count it as extra evidence.
5. Normalize `builderFields.context` to lowercase before inspecting it.
6. Expand audience detection to handle label-style input reliably, for example:
   - `Audience: CFOs`
   - `Target audience - internal stakeholders`
   - `For executives`
7. Re-run the current ambiguity-level logic after the missing-slot list is corrected; do not change ambiguity thresholds unless tests show a real mismatch.
8. Add regression tests for:
   - `Help` with mirrored builder task still reporting `target_deliverable`,
   - `Audience: CFOs` in builder context suppressing the `audience` missing slot,
   - uppercase/labeled audience text being treated the same as lowercase text,
   - a clearly structured task still suppressing `target_deliverable` when appropriate.
9. If the backend fix alone proves too brittle, make a second-pass change in `Index.tsx` so `builder_fields.task` only carries explicit builder-task content instead of mirroring `originalPrompt`.
10. Only take that `Index.tsx` payload change if the backend-only fix cannot satisfy the regression cases without reducing enhancement quality elsewhere.

### Verification

1. `npx vitest run src/test/enhancement-pipeline-ambiguity.test.ts`
2. Optional node sanity check for reproduced cases:
   - `detectEnhancementContext("Help", { builderFields: { task: "Help" } })`
   - `detectEnhancementContext("Write a proposal", { builderFields: { context: "Audience: CFOs" } })`

### Exit criteria

Mirrored raw prompts no longer suppress missing-slot detection, and audience labels are detected regardless of casing.

## Issue 3: Preserve sparse detected-context payloads that only carry `primary_intent`

Files:

- `src/lib/enhance-metadata.ts`
- `src/test/enhance-metadata.test.ts`

### Goal

Do not drop detected-context metadata when `primary_intent` is the only populated field.

### Step-by-step

1. Update the empty-check in `parseDetectedContext()` to include `primaryIntent`.
2. Keep the return shape unchanged so existing UI call sites do not need to change.
3. Add a regression test where `detected_context` is only:
   - `{ primary_intent: "analysis" }`
4. Assert that `parseEnhanceMetadata(...)` returns `detectedContext.primaryIntent === "analysis"` instead of `undefined`.
5. Add a second assertion proving empty objects still return `undefined` so the guard does not regress in the other direction.

### Verification

1. `npx vitest run src/test/enhance-metadata.test.ts`

### Exit criteria

Sparse metadata still reaches the UI when `primary_intent` is the only useful detected-context field.

## Issue 4: Record telemetry against the selected enhancement variant

Files:

- `src/pages/Index.tsx`
- `src/test/index-enhance-variant-persistence.test.tsx`
- optionally new `src/test/index-enhance-telemetry.test.tsx`

### Goal

Make rerun/acceptance telemetry reflect the prompt the user actually chose, not always the original enhanced output.

### Step-by-step

1. In `Index.tsx`, derive a single `selectedPromptLength` from `selectedEnhancedPrompt.length`.
2. Update `builder_enhance_accepted` to emit `promptChars: selectedPromptLength`.
3. Update `builder_enhance_rerun` to emit `previousPromptChars: selectedPromptLength`.
4. Leave `builder_enhance_clicked` tied to the newly built prompt length; that event is still correct.
5. Verify the selected variant source stays stable when `activeEnhancementVariant` is `shorter` or `more_detailed`.
6. Add regression coverage for this exact flow:
   - enhance a prompt,
   - switch to `shorter`,
   - mark the output as used,
   - rerun enhancement,
   - assert telemetry uses the shorter variant length.
7. Add a second assertion for the original variant to prove default behavior still works.

### Verification

1. `npx vitest run src/test/index-enhance-variant-persistence.test.tsx`
2. `npx vitest run src/test/index-enhance-telemetry.test.tsx` (if created)

### Exit criteria

Acceptance and rerun telemetry match the active prompt variant the user worked from.

## Issue 5: Remove the unused frontend enhancement toggle layer

Files:

- `src/pages/Index.tsx`
- `src/components/OutputPanel.tsx`
- `src/test/output-panel-enhance-controls.test.tsx`
- `src/test/output-panel-enhance-metadata.test.tsx`

### Goal

Make the remaining enhancement flags control real runtime behavior instead of existing only as definitions.

### Scope decision

Do not remove `enhancementIntentConfirmation` or `enhancementPersonalization`; they are already wired. This plan only closes the remaining gaps for:

- `enhancementStructuredInspector`
- `enhancementAmbiguityPolicy`

### Step-by-step

1. Document the intended runtime contract in code comments or a short block comment near `enhancementFeatureFlags` usage:
   - `enhancementStructuredInspector` controls inspector visibility and apply-to-builder affordances.
   - `enhancementAmbiguityPolicy` controls ambiguity selector visibility and whether custom ambiguity mode is sent with the request.
2. In `Index.tsx`, gate ambiguity-policy behavior at the source:
   - when the flag is on, pass `ambiguityMode` and `onAmbiguityModeChange` to `OutputPanel` and send `ambiguity_mode` in `streamEnhance(...)`;
   - when the flag is off, omit `onAmbiguityModeChange` and omit `ambiguityMode` from the enhance request so the backend falls back to its default.
3. In `OutputPanel.tsx`, keep the existing control-rendering pattern based on handler presence so `Index.tsx` can remain the single source of flag gating.
4. Add an explicit structured-inspector gate:
   - either add a `showStructuredInspector` prop from `Index.tsx`, or
   - gate the `EnhancementInspector` block directly in `OutputPanel.tsx` using a new boolean prop.
5. When `enhancementStructuredInspector` is off:
   - do not render `EnhancementInspector`,
   - do not expose apply-to-builder actions.
6. When `enhancementStructuredInspector` is on, keep the current inspector behavior unchanged.
7. Leave `enhancementIntentConfirmation` and `enhancementPersonalization` behavior intact, but add regression tests so their existing wiring is explicitly covered.
8. Add tests that prove:
   - ambiguity controls disappear when `enhancementAmbiguityPolicy` is off,
   - `streamEnhance(...)` payload omits `ambiguity_mode` when the flag is off,
   - the structured inspector does not render when `enhancementStructuredInspector` is off,
   - the intent-confirmation UI still follows `enhancementIntentConfirmation`,
   - personalization recording still follows `enhancementPersonalization`.

### Verification

1. `npx vitest run src/test/output-panel-enhance-controls.test.tsx`
2. `npx vitest run src/test/output-panel-enhance-metadata.test.tsx`
3. Add a targeted Index regression slice only if new rollout-control coverage is introduced.

### Exit criteria

Each remaining enhancement flag changes real UI/request behavior, and already-wired flags are covered by regression tests.

## Issue 6: Reconcile inspector-applied format text with builder `lengthPreference`

Files:

- `src/pages/Index.tsx`
- `src/lib/prompt-builder.ts`
- `src/test/index-apply-to-builder.test.tsx`

### Goal

Prevent `Format:` instructions from combining inspector-applied length text with stale builder length settings.

### Step-by-step

1. Define a single reconciliation rule for inspector-applied format text:
   - if the inspector format contains a recognizable `Length:` token, parse it and sync `lengthPreference` to the parsed value;
   - strip the parsed `Length:` fragment out of `customFormat` so it does not appear twice.
2. Add a small helper near `handleApplyToBuilder()` or in a dedicated utility, for example:
   - input: `"Table | Length: standard"`
   - output: `{ customFormat: "Table", lengthPreference: "standard" }`
3. Support the length values the builder already knows about:
   - `brief`
   - `standard`
   - `detailed`
4. Keep format array replacement behavior exactly as it is today:
   - clear `config.format`
   - write the normalized inspector format into `config.customFormat`
5. When no recognizable `Length:` token is present, keep the current `lengthPreference` unchanged.
6. When the inspector format contains only a length token and no remaining format text, set `customFormat` to an empty string and rely on `lengthPreference` alone.
7. Add regression tests that cover:
   - existing `lengthPreference = detailed` + inspector format `Table | Length: standard` -> built prompt uses only `standard`,
   - inspector format without a `Length:` token leaves `lengthPreference` unchanged,
   - format chips are still cleared when a custom inspector format is applied.
8. Re-run the built-prompt assertions so the final prompt never contains both a parsed inspector length token and a stale length label.

### Verification

1. `npx vitest run src/test/index-apply-to-builder.test.tsx`
2. `npx vitest run src/test/usePromptBuilder.test.ts`

### Exit criteria

Applying inspector format text produces a single coherent `Format:` instruction with no contradictory length guidance.

## Issue 7: Remove the local telemetry cross-tab race by switching to tab-scoped logs

Files:

- `src/lib/telemetry.ts`
- `src/test/telemetry-listener.test.ts`
- optionally `src/test/telemetry.test.ts`

### Goal

Stop multiple tabs from overwriting each other's telemetry events when they append to local storage concurrently.

### Step-by-step

1. Replace the single shared local-storage key with tab-scoped keys, for example:
   - `promptforge-telemetry-log:<tabId>`
2. Generate or retrieve a stable per-tab ID using `sessionStorage`.
3. Keep the in-tab ring buffer behavior the same, but only write the active tab's events to that tab's key.
4. Update `getTelemetryLog()` so it:
   - scans `localStorage` for keys with the telemetry prefix,
   - merges all per-tab arrays,
   - sorts merged entries by timestamp,
   - returns only the most recent `TELEMETRY_LOG_MAX` items so the public behavior stays bounded.
5. Update `clearTelemetryLog()` so it removes:
   - all tab-scoped telemetry keys,
   - the legacy single-key log if present.
6. Keep read compatibility for one release with the legacy key:
   - if `promptforge-telemetry-log` exists, include it in merged reads,
   - clear it alongside the new keys.
7. Add regression tests that simulate multiple tabs by pre-populating two scoped keys and asserting merged reads include both event streams.
8. Add a second test proving `clearTelemetryLog()` removes all scoped keys.
9. Keep the listener idempotency behavior already covered by tests.

### Verification

1. `npx vitest run src/test/telemetry-listener.test.ts`
2. `npx vitest run src/test/telemetry.test.ts`

### Exit criteria

Events written by separate tabs accumulate instead of overwriting one another.

## Issue 8: Remove generated artifacts from git and block them from reappearing

Files:

- `.gitignore`
- tracked files under `output/`
- `plans/audit-3ae0c61-post-enhance-phase0.md` if it is confirmed to be generated scratch output rather than durable project documentation

### Goal

Reduce repo noise and prevent generated investigative output from being committed again.

### Step-by-step

1. Inventory tracked files under `output/` and separate them into two buckets:
   - generated scratch output that should be removed,
   - any intentionally preserved reference assets that truly belong in version control.
2. Search the app, docs, and tests for references to `output/` assets before deleting anything.
3. If any tracked `output/` files are intentionally referenced, move them to a durable location such as:
   - `docs/`
   - `docs/archive/`
   - `public/`
4. Remove the generated git-dump artifacts first:
   - `output/git-diff-full.txt`
   - `output/git-log-patch.txt`
   - related `output/git-*.txt` files
5. Remove transient screenshot/log artifacts that are not part of product documentation.
6. Decide the fate of `plans/audit-3ae0c61-post-enhance-phase0.md` explicitly:
   - keep it only if it is an intentional historical audit document,
   - otherwise delete or archive it outside the active plans set.
7. Add ignore rules for generated output so future local investigations do not re-enter git.
8. Be careful not to blanket-ignore `plans/audit-*.md`; current audit and planning docs may be intentionally tracked.
9. Prefer ignoring the generated artifact directory/patterns directly, for example:
   - `output/`
   - or, if narrower scope is required, the specific generated subpaths used by local audits.
10. After the ignore rules are in place, remove the now-ignored tracked files from git in the same change so the cleanup is complete.

### Verification

1. `git ls-files -- "output" "plans/audit-3ae0c61-post-enhance-phase0.md"`
2. Confirm the command output is empty, or only includes files that were deliberately retained and documented.
3. `npm run check:prod` after cleanup if any docs or checked-in assets were moved.

### Exit criteria

Generated investigative artifacts are gone from version control and do not come back on the next local audit run.

## Consolidated Verification Pass

Run these after the implementation sequence completes:

1. `npx vitest run src/test/output-panel-phase2.test.tsx`
2. `npx vitest run src/test/enhancement-pipeline-ambiguity.test.ts`
3. `npx vitest run src/test/enhance-metadata.test.ts`
4. `npx vitest run src/test/index-apply-to-builder.test.tsx`
5. `npx vitest run src/test/index-enhance-variant-persistence.test.tsx`
6. `npx vitest run src/test/output-panel-enhance-controls.test.tsx`
7. `npx vitest run src/test/output-panel-enhance-metadata.test.tsx`
8. `npx vitest run src/test/telemetry-listener.test.ts`
9. `npm run check:prod`

## Recommended PR Slicing

1. PR-1: save/share dialog transactionality + `primary_intent` metadata guard + variant telemetry sizing.
2. PR-2: ambiguity heuristics + apply-to-builder format/length sync.
3. PR-3: rollout-control cleanup and regression coverage.
4. PR-4: telemetry storage hardening.
5. PR-5: generated artifact cleanup and ignore rules.

## Final Definition of Done

The verified remaining issues are closed, the enhancement rollout flags behave as documented, telemetry reflects real user behavior, and local audit output no longer pollutes the repository.
