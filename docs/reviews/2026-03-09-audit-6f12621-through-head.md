# Code Audit: `6f12621` Through HEAD

Last updated: 2026-03-09

> Historical snapshot.
> Do not treat this file as current operational guidance; use `docs/README.md` to find active docs.

No critical or high-severity range-introduced defects stood up under review. The range does introduce several medium and low issues.

## Medium

1. `7cee196` makes the new ambiguity heuristics systematically under-detect missing information. In [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L251), `target_deliverable` is considered present whenever `builderFields.task` is non-empty, and in [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L260) audience detection is reduced to a case-sensitive `.includes("audience")` check. In the existing caller context, the raw prompt text is already fed into `builderFields.task`, so vague inputs like `"Help"` suppress the missing-deliverable signal, and contexts like `"Audience: CFOs"` still get marked as missing audience. Blast radius: wrong `ambiguity_level`, fewer clarifying prompts/placeholders, and lower-quality enhancement plans for exactly the vague prompts this feature is supposed to help. Remediation: normalize builder-field text before inspection and only treat `task` as a filled slot when it contains structured task detail, not just the raw prompt.

2. `7cee196` closes and resets the save/share dialog before the async save result is known. The new dialog API is sync-only in [OutputPanelSaveDialog.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelSaveDialog.tsx#L39), and [OutputPanelSaveDialog.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelSaveDialog.tsx#L150) calls `onSavePrompt` / `onSaveAndSharePrompt` and then immediately closes and clears state at [OutputPanelSaveDialog.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelSaveDialog.tsx#L190). The actual handlers are async and only surface failures later in [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx#L1455) and [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx#L1503). Blast radius: any transient network or backend failure drops the user’s title/use-case/remix note and forces re-entry. Remediation: change the callbacks to return `Promise<void>`, await them, keep the dialog open on rejection, and add a rejection-path test; e.g. `onSavePrompt: (...) => Promise<void>` plus `await onSavePrompt(...)` before `onOpenChange(false)`.

3. `91e4e33` wires inspector `output_format` back into builder state in a way that can create contradictory future prompts. [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx#L1617) now copies `updates.format` into `customFormat` at [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx#L1621), but it does not clear existing `format` chips or reconcile `lengthPreference`. [prompt-builder.ts](/home/azureuser/ai-prompt-pro/src/lib/prompt-builder.ts#L219) later concatenates `format[]` and `customFormat` into a single `Format:` instruction. Blast radius: after “Apply to builder,” the next preview/save/enhance pass can combine stale user format chips with the AI-applied format, so the builder state no longer matches what the user accepted. Remediation: when applying inspector format, either parse it into structured builder fields or explicitly clear `format` and normalize length before setting `customFormat`.

4. `3ae0c61` adds `audit` to `ANALYSIS_PATTERN` but never adds `analysis` into the candidate list, so the new pattern is dead for audit-only prompts. The added pattern is at [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L439), but candidate injection still only exists for rewrite/research/planning at [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L461). As a result, `classifyPrimaryIntent("Audit this onboarding copy for clarity")` still resolves to `null`. Blast radius: no analysis routing, no analysis-specific addon, no detected-intent chip, and weaker telemetry for audit-style prompts. Remediation: either add `if (isAnalysis && !candidates.includes("analysis")) candidates.unshift("analysis");` or fold `audit` into `INTENT_PATTERNS.analytical`, with a regression test for `audit`.

## Low

1. `3ae0c61` regresses transform-task suggestion coverage by removing `update` from [builder-inference-heuristics.ts](/home/azureuser/ai-prompt-pro/shared/builder-inference-heuristics.ts#L288). [builder-inference.ts](/home/azureuser/ai-prompt-pro/src/lib/builder-inference.ts#L259) uses that task-mode classifier to choose suggestion chips, so prompts like “Update this release note…” now return `null` instead of transform-oriented prompts such as “add source material.” Blast radius: weaker suggestion quality for a common verb family. Remediation: re-add `update` or cover it with an equivalent transform token and add a regression test.

2. `7cee196` introduces a personalization subsystem that never runs in production. The whole feature lives in [prompt-enhancement-profile.ts](/home/azureuser/ai-prompt-pro/src/lib/prompt-enhancement-profile.ts#L1), but there are no production imports or call sites; repo-wide usage is tests only. Blast radius: the shipped app does not actually learn from accepted/rerun/variant behavior despite the feature and tests implying otherwise. Remediation: either wire `recordEnhancementAction(...)` into enhance-complete / variant-apply / rerun flows or remove the dead module until the product uses it.

3. `91e4e33` documents unsupported `intent_override` values. [agent_service/README.md](/agent_service/README.md) advertises `critique` and `explanation`, but the implementation only accepts the routes in [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L382) and silently drops anything else in [enhancement-pipeline.mjs](/home/azureuser/ai-prompt-pro/agent_service/enhancement-pipeline.mjs#L1053). Blast radius: external callers following the README get silent fallback to auto-detect instead of the requested route. Remediation: align the docs to the real enum or reject unsupported overrides with a 400.

4. `a198cda` checks transient audit artifacts into source control. New tracked files such as [git-diff-full.txt](/home/azureuser/ai-prompt-pro/output/git-diff-full.txt#L1), [git-log-patch.txt](/home/azureuser/ai-prompt-pro/output/git-log-patch.txt#L1), and `audit-3ae0c61-post-enhance-phase0.md` (later moved to `docs/reviews/2026-03-09-audit-3ae0c61-post-enhance-phase0.md`) are generated review outputs, not product source. Blast radius: noisier history, avoidable repo growth, and precedent for checking in ephemeral investigation artifacts. Remediation: drop them from git and ignore that class of file if it is meant to stay local.

## Commit Notes

- `071da11` has no code changes.
- `3321111` is merge-only; its tree is identical to `91e4e33`, so I found no merge-only defects.
- `6f12621` is also merge-only; its tree is identical to `3321111`, so there are no merge-conflict-only issues to attribute there.
- `a198cda` mostly improves the frontend metadata handling; the only range-local issue I found there is the checked-in audit/output debris.

## Patterns

1. The main systemic weakness is negative-path coverage. The new tests are extensive, but they concentrate on happy paths; the missed regressions are almost all failure-path or edge-classifier bugs.
2. Several new heuristics were added without end-to-end caller-shape validation. The ambiguity logic and intent-routing changes both assume cleaner inputs than the app actually provides.
3. There is some contract drift between implementation and surrounding assets: docs claim unsupported API values, and a “personalization” feature exists as tested code without runtime integration.

## Reversion / Action Plan

1. Patch, not revert, `7cee196`: fix ambiguity heuristics and the async save dialog first.
2. Patch `3ae0c61` next: restore correct `audit`/`update` classification and add tests for those verbs.
3. Patch `91e4e33` apply-to-builder format sync so accepted inspector output round-trips cleanly into the builder.
4. Clean up `a198cda` by removing the generated audit/output files from version control.
5. Either wire up or delete the profile subsystem so the codebase stops carrying a tested-but-unshipped feature.

Validation-wise, `npm test` passed for the tracked tree. `npm run lint` only surfaced a hook-dependency warning inside a local `.worktrees` checkout, not in the files on `main` under review.
