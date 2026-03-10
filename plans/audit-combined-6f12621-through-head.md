# Consolidated Audit: `6f12621` Through `HEAD`

This document merges:

- `plans/audit-6f12621-through-head.md`
- the supplementary audit results provided in chat on 2026-03-09

Verification note: the cited code paths were re-checked against current `HEAD` while consolidating these reports.

## Scope Note

The two source audits used slightly different commit scopes:

- Strict post-merge range: `6f12621..HEAD`
  - `3ae0c61`
  - `a198cda`
- Inclusive merged-branch ancestry: `6f12621^..HEAD`
  - `7cee196`
  - `071da11`
  - `91e4e33`
  - `3321111`
  - `6f12621`
  - `3ae0c61`
  - `a198cda`

Findings below are deduplicated. Items marked **Inherited** are still present at `HEAD` but were introduced before the strict `6f12621..HEAD` range.

## Summary

- No critical issues found.
- 2 high issues
- 6 medium issues
- 5 low issues

## Findings

### High

1. Audit-only analysis prompts can resolve to `null` instead of `analysis`.
   - Commit: `3ae0c61`
   - Scope: strict range
   - Files: `agent_service/enhancement-pipeline.mjs`
   - Problem: `ANALYSIS_PATTERN` recognizes `audit`, but `classifyPrimaryIntent()` never injects `"analysis"` into `candidates` the way it does for rewrite, research, and planning. `classifyPrimaryIntent("audit customer interviews")` still returns `{ primaryIntent: null }` at `HEAD`.
   - Blast radius: wrong or missing intent routing, no analysis-specific addon, weaker metadata, and weaker telemetry for audit-style prompts.
   - Remediation:

     ```js
     if (isAnalysis && !candidates.includes("analysis")) {
       candidates.push("analysis");
     }
     ```

     Add a regression test in `src/test/enhancement-pipeline-intent-routing.test.ts`.

2. Enhancement rollout controls were plan-only and not wired into runtime behavior.
   - Commit: `7cee196`
   - Scope: inherited
   - Files: `src/pages/Index.tsx`, `src/components/OutputPanel.tsx`
   - Problem: planned enhancement toggles were never wired to meaningful runtime behavior. Enhancement controls and inspector behavior already rendered unconditionally.
   - Blast radius: rollback requires a code change or deploy.
   - Remediation: either wire real runtime controls or remove the unused frontend toggle layer. The latter was adopted.

### Medium

1. Ambiguity heuristics systematically under-detect missing information.
   - Commit: `7cee196`
   - Scope: inherited
   - Files: `agent_service/enhancement-pipeline.mjs`
   - Problem: `target_deliverable` is treated as present whenever `builderFields.task` is non-empty, and audience detection relies on a fragile string check. Because the raw prompt is already funneled into `task`, vague inputs like `"Help"` suppress the missing-deliverable signal while inputs like `"Audience: CFOs"` can still be missed.
   - Blast radius: lower ambiguity detection, fewer clarifying prompts or placeholders, and weaker enhancement plans for vague prompts.
   - Remediation: normalize builder-field text before inspection and require structured task detail before considering the deliverable present.

2. Save/share dialog closes and clears state before async save success is known.
   - Commit: `7cee196`
   - Scope: inherited
   - Files: `src/components/OutputPanelSaveDialog.tsx`, `src/pages/Index.tsx`
   - Problem: the dialog callbacks are treated synchronously, so the modal closes and local input state resets before `onSavePrompt` or `onSaveAndSharePrompt` resolves. Failures surface later only as toasts.
   - Blast radius: transient save/share failures force the user to re-enter title, use case, and remix note.
   - Remediation: make the callbacks return `Promise<void>`, await them before closing, and keep the dialog open on rejection.

3. Apply-to-builder format sync can create contradictory future prompts.
   - Commit: `91e4e33`
   - Scope: inherited
   - Files: `src/pages/Index.tsx`, `src/lib/prompt-builder.ts`
   - Problem: inspector `updates.format` is copied into `customFormat` without clearing existing `format` chips or reconciling `lengthPreference`. The next prompt build concatenates both sources into a single `Format:` instruction.
   - Blast radius: the builder state can diverge from what the user accepted in the inspector.
   - Remediation: either parse inspector format into structured builder fields or clear and normalize related format state before setting `customFormat`.

4. RAG slider limits are narrower than the validator and domain model allow.
   - Commit: `a198cda`
   - Scope: strict range
   - Files: `src/components/ContextIntegrations.tsx`, `src/lib/template-store.ts`
   - Problem: the UI caps `topK` at `20` and `chunkWindow` at `10`, while validation still allows `topK <= 100` and `chunkWindow <= 20`.
   - Blast radius: users lose tuning range, and persisted values above the slider max become inaccessible in the current UI path.
   - Remediation: align slider bounds with validator limits or deliberately change the backend and domain limits and document the migration.

5. `parseDetectedContext()` drops primary-intent-only payloads.
   - Commit: `3ae0c61`
   - Scope: strict range
   - Files: `src/lib/enhance-metadata.ts`
   - Problem: the empty-check ignores `primaryIntent`, so a payload like `{ primary_intent: "analysis" }` with otherwise empty or default fields returns `undefined`.
   - Blast radius: the detected-intent chip and override baseline can silently disappear for sparse metadata payloads.
   - Remediation:

     ```ts
     if (
       intent.length === 0 &&
       domain.length === 0 &&
       complexity === 0 &&
       !mode &&
       !input_language &&
       !primaryIntent
     ) {
       return undefined;
     }
     ```

     Add a regression test in `src/test/enhance-metadata.test.ts`.

6. Variant-aware UX did not update rerun and acceptance telemetry sizing.
   - Commit: `a198cda`
   - Scope: strict range
   - Files: `src/pages/Index.tsx`
   - Problem: after adding variant selection, rerun and acceptance events still emit `enhancedPrompt.length` instead of the currently selected prompt length.
   - Blast radius: analytics skew for acceptance and rerun behavior when users are working from `shorter` or `more_detailed` variants.
   - Remediation: use `selectedEnhancedPrompt.length` for `builder_enhance_accepted` and `builder_enhance_rerun`.

### Low

1. Transform-task suggestion coverage regressed by removing `update`.
   - Commit: `3ae0c61`
   - Scope: strict range
   - Files: `shared/builder-inference-heuristics.ts`
   - Problem: `update` was removed from `TRANSFORM_PATTERN`, so common prompts like `"Update this release note"` no longer infer transform mode.
   - Blast radius: weaker suggestion chips and builder inference for a common verb family.
   - Remediation: re-add `update` or replace it with an equivalent transform token and cover it with a regression test.

2. Personalization subsystem is still dead code in production.
   - Commit: `7cee196`
   - Scope: inherited
   - Files: `src/lib/prompt-enhancement-profile.ts`
   - Problem: the module has tests but no production call sites.
   - Blast radius: the app does not actually learn from accepted, rerun, or variant behavior despite carrying the feature.
   - Remediation: either wire `recordEnhancementAction(...)` into enhancement flows or remove the module until it ships.

3. README documents unsupported `intent_override` values.
   - Commit: `91e4e33`
   - Scope: inherited
   - Files: `agent_service/README.md`, `agent_service/enhancement-pipeline.mjs`
   - Problem: docs advertise overrides such as `critique` and `explanation`, but the implementation accepts only the current route enum and silently falls back otherwise.
   - Blast radius: external callers can think they requested a route when the service actually auto-detects one.
   - Remediation: align the README to the real enum or reject unsupported overrides with a `400`.

4. Telemetry ring buffer has a cross-tab read-modify-write race.
   - Commit: `7cee196` (still present after later refactors)
   - Scope: inherited
   - Files: `src/lib/telemetry.ts`
   - Problem: each event handler does `read -> push -> write` against `localStorage`, so concurrent tabs can overwrite each other's appended events.
   - Blast radius: incomplete local telemetry history.
   - Remediation: per-tab logs or single-writer coordination via `BroadcastChannel`, `navigator.locks`, or similar.

5. Generated audit artifacts were committed into the tree.
   - Commit: `a198cda`
   - Scope: strict range
   - Files: `output/git-diff-full.txt`, `output/git-log-patch.txt`, `plans/audit-3ae0c61-post-enhance-phase0.md`, and related generated outputs
   - Problem: generated investigative files were committed alongside product changes.
   - Blast radius: review noise, repo growth, and lower signal-to-noise in history.
   - Remediation: remove the generated artifacts and ignore the relevant local-output patterns.

## Commit Notes

- `071da11`: no code changes.
- `3321111`: merge-only; no unique conflict-resolution defect stood out.
- `6f12621`: merge-only; no unique conflict-resolution defect stood out.
- `91e4e33`: mostly cleanup and follow-up work; the main residual issue is format-sync and doc drift.
- `3ae0c61`: introduced the audit-intent routing bug, the primary-intent guard regression, and the `update` suggestion coverage regression.
- `a198cda`: introduced the RAG slider narrowing, variant-telemetry mismatch, and the committed audit debris.
- `7cee196`: introduced several still-live inherited issues, including unused rollout controls, ambiguity heuristics drift, async save dialog state loss, dead personalization, and the telemetry storage race.

## Cross-Cutting Patterns

- Several enhancement features are only partially wired: flags exist without gates, metadata exists without fully aligned UI behavior, and personalization exists without runtime integration.
- Test coverage is strongest on happy paths. Sparse metadata payloads, failure paths, and edge-route vocabulary are under-covered.
- Multiple issues come from contract drift between layers: UI vs validator limits, inspector output vs builder state, and docs vs accepted backend enums.

## Prioritized Fix Plan

1. Hotfix strict-range correctness issues first: analysis candidate injection, `primaryIntent` guard, RAG bounds, and variant telemetry sizing.
2. Keep rollout behavior explicit by wiring real controls or deleting unused toggle layers.
3. Fix async save dialog behavior and normalize apply-to-builder format state.
4. Clean out committed audit artifacts.
5. Either wire or delete the dormant personalization subsystem, then harden telemetry storage if local log fidelity matters.

## Validation Notes

- The source audits reported passing targeted Vitest and lint checks, and one source audit also reported `npm test` passing for the tracked tree.
- This consolidation pass re-verified the cited code paths at `HEAD` and reproduced the audit-only intent-routing failure, but did not rerun the full test suite.
