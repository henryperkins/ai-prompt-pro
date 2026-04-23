# Code Audit: Post-Merge Commit 3ae0c61 ("yp")

Last updated: 2026-03-09

> Historical snapshot.
> Do not treat this file as current operational guidance; use `docs/README.md` to find active docs.

**Audit scope:** All changes from `6f12621` (Merge PR #7: feature/enhance-phase0) to HEAD  
**Commits in range:** 1 — `3ae0c619e84a93e4f474e8c9dd9fedb55d459cd3` ("yp")  
**Files changed:** 14 (1,107 insertions, 45 deletions)  
**Date:** 2026-03-09

---

## Severity Legend

| Tier | Definition |
|------|-----------|
| **Critical** | Data loss, security breach, or crash in production paths |
| **High** | Incorrect behavior visible to users or silent logic errors affecting core features |
| **Medium** | Degraded correctness, maintainability, or incomplete implementation |
| **Low** | Style, convention, or minor robustness issues |

---

## Findings

### CRITICAL

#### C-1 · `parseDetectedContext` silently drops `primaryIntent` when other context fields are empty

**Commit:** `3ae0c61`  
**File:** [`src/lib/enhance-metadata.ts`](src/lib/enhance-metadata.ts:165)  
**Lines:** 165–167

**Problem:** The new early-return guard checks only `intent`, `domain`, `complexity`, `mode`, and `input_language` — but not `primaryIntent`:

```ts
if (intent.length === 0 && domain.length === 0 && complexity === 0 && !mode && !input_language) {
    return undefined;
}
```

If the backend returns a context object with `primary_intent: "analysis"` but all other fields are at their defaults (`intent: [], domain: [], complexity: 0, mode: "", input_language: ""`), the guard fires before `primaryIntent` is included in the return value. The entire `detectedContext` becomes `undefined`.

**Evidence:** In [`src/pages/Index.tsx`](src/pages/Index.tsx:1540), the `detectedIntent` memo reads `enhanceMetadata?.detectedContext?.primaryIntent`. When `detectedContext` is `undefined`, the detected-intent chip in [`BuilderHeroInput`](src/components/BuilderHeroInput.tsx:120) shows nothing, and the user loses the ability to see or override the detected route.

**Blast radius:**
- Intent override UI goes blank for any enhancement where the backend emits `primary_intent` but happens to have empty intent/domain arrays (possible for short or unusual prompts).
- Telemetry event `builder_enhance_intent_overridden` loses its `fromIntent` baseline.
- Silent — no error, no fallback, just missing data.

**Remediation:** Include `primaryIntent` in the guard:

```ts
if (
  intent.length === 0 && domain.length === 0 && complexity === 0 &&
  !mode && !input_language && !primaryIntent
) {
  return undefined;
}
```

---

### HIGH

#### H-1 · `ANALYSIS_PATTERN` fires but "analysis" may not be in candidates

**Commit:** `3ae0c61`  
**File:** [`agent_service/enhancement-pipeline.mjs`](agent_service/enhancement-pipeline.mjs:405)  
**Lines:** 405, 417, 461, 465

**Problem:** The new `ANALYSIS_PATTERN` includes `audit` which is absent from [`INTENT_PATTERNS.analytical`](agent_service/enhancement-pipeline.mjs:7) (`/\b(analyze|analyse|compare|evaluate|assess|review|benchmark)\b/i`). When a prompt like "audit the codebase" is entered:

1. `isAnalysis` = `true` (ANALYSIS_PATTERN matches "audit")
2. `classifyIntent("audit the codebase")` returns `["coding"]` (matches "code" in INTENT_PATTERNS.coding)
3. Candidates become `["code"]`; `unique` = `["code"]`
4. The signal-candidate check at line 465 tests `active && unique.includes("analysis")` → `false`
5. "analysis" is never selected despite `isAnalysis` being true

The `isAnalysis` flag only inflates `matchCount` (line 492) without actually affecting routing.

**Blast radius:** Prompts containing "audit" (and no other analysis-pattern words) route to the wrong intent. The eval fixture already expects "analysis" for such cases.

**Remediation:** Add an analysis candidate injection block, consistent with the existing pattern for rewrite/research/planning:

```js
if (isAnalysis && !candidates.includes("analysis")) {
    candidates.push("analysis");
}
```

This should be added after the planning injection block (around line 435).

---

#### H-2 · Removing "update" from `TRANSFORM_PATTERN` breaks task-mode classification

**Commit:** `3ae0c61`  
**File:** [`shared/builder-inference-heuristics.ts`](shared/builder-inference-heuristics.ts:288)  
**Line:** 288

**Problem:** The word "update" was removed from `TRANSFORM_PATTERN`. Prompts like "update this document" or "update the API spec" will no longer classify as `transform` task mode. They will either match `GENERATE_PATTERN` (unlikely — "update" isn't there either) or return `null` from [`chooseTaskMode()`](shared/builder-inference-heuristics.ts:297).

**Evidence:** The `REWRITE_PATTERN` in [`enhancement-pipeline.mjs`](agent_service/enhancement-pipeline.mjs:402) still includes "update", creating an inconsistency between the two systems — the backend considers "update" a rewrite signal but the shared heuristic no longer considers it a transform signal.

**Blast radius:**
- Incorrect task-mode inference for prompts using "update" — a very common verb.
- Downstream consumers of `chooseTaskMode()` (Tasks 4, 5, 6b per the plan doc) will get weaker signals.
- Inconsistency between backend and shared heuristic intent vocabulary.

**Remediation:** Either restore "update" to `TRANSFORM_PATTERN` or, if the removal was intentional (perhaps "update" is too ambiguous), document the rationale and add "update" to a disambiguation list.

---

#### H-3 · Confidence inflation from additional boolean signals

**Commit:** `3ae0c61`  
**File:** [`agent_service/enhancement-pipeline.mjs`](agent_service/enhancement-pipeline.mjs:492)  
**Line:** 492

**Problem:** The `matchCount` formula changed from:

```js
// Before
rawIntents.length + (isRewrite ? 1 : 0) + (isResearch ? 1 : 0)
// After
rawIntents.length + (isRewrite ? 1 : 0) + (isResearch ? 1 : 0) + (isPlanning ? 1 : 0) + (isAnalysis ? 1 : 0)
```

With `intentConfidence = Math.min(0.6 + 0.08 * matchCount, 0.95)`:

| Scenario | Old matchCount | Old confidence | New matchCount | New confidence |
|---|---|---|---|---|
| 2 raw + rewrite + research | 4 | 0.92 | 4 | 0.92 |
| 2 raw + all 4 booleans | — | — | 6 | 0.95 (capped) |
| 1 raw + planning + analysis | — | — | 3 | 0.84 |

The plan document (Task 6b) proposes a 0.70 confidence gate for auto-applying inferred fields. The inflated confidence means more prompts will cross this threshold, leading to over-aggressive auto-apply.

**Blast radius:** Confidence values shift upward globally, potentially affecting any downstream consumer that uses `intentConfidence` as a decision boundary.

**Remediation:** Either normalize the confidence formula to account for the larger signal count, or weight the boolean signals differently (e.g., 0.04 each instead of 0.08):

```js
const booleanSignalCount = [isRewrite, isResearch, isPlanning, isAnalysis].filter(Boolean).length;
const matchCount = rawIntents.length + booleanSignalCount;
const intentConfidence = Math.min(0.6 + 0.06 * matchCount, 0.95);
```

---

### MEDIUM

#### M-1 · Text-position tie-breaking is fragile for extraction vs. signal routes

**Commit:** `3ae0c61`  
**File:** [`agent_service/enhancement-pipeline.mjs`](agent_service/enhancement-pipeline.mjs:457-488)  
**Lines:** 457–488

**Problem:** The new tie-breaking logic resolves conflicts between research/planning/analysis and extraction by comparing which regex match appears first in the normalized text. This is fragile because:

1. `normalized.indexOf(m[0])` finds the first occurrence of the matched **substring**, not necessarily the position of the regex match itself. If the matched word appears multiple times, `indexOf` may return a different position than the regex hit.
2. The position-first heuristic assumes "primary action verb appears earliest" — but natural language frequently places the object before the action verb (e.g., "the retention numbers, analyze and extract them").
3. Only extraction is compared against the signal candidates; other routes (rewrite, code) bypass this logic entirely, creating asymmetric behavior.

**Blast radius:** Occasional misrouting for prompts that mix extraction and analysis/research/planning verbs. Correctness depends on verb ordering, which is user-controlled and unpredictable.

**Remediation:** Consider using `m.index` from the regex match result instead of `indexOf(m[0])` for positional accuracy:

```js
const m = normalized.match(pattern);
if (m && m.index !== undefined) {
  const pos = m.index;
  if (pos < bestPos) { bestPos = pos; best = route; }
}
```

Additionally, add comprehensive tests for various word orderings.

---

#### M-2 · Missing `setFieldOwnership` in `handleApplyToBuilder` dependency array is technically safe but violates exhaustive-deps

**Commit:** `3ae0c61`  
**File:** [`src/pages/Index.tsx`](src/pages/Index.tsx:1587-1598)  
**Lines:** 1587–1598

**Problem:** The `handleApplyToBuilder` callback uses `setFieldOwnership` (a state setter) and `markOwnershipFields` / `listInferenceFieldsFromUpdates` (imported functions). The dependency array is `[updateConfig]`. While React guarantees state setter stability and module imports are static, ESLint's `react-hooks/exhaustive-deps` rule may flag this.

**Blast radius:** No runtime impact, but it may trigger lint warnings and confuse future maintainers about which dependencies are intentionally omitted.

**Remediation:** Explicitly include `setFieldOwnership` in the dependency array for clarity:

```ts
}, [updateConfig, setFieldOwnership]);
```

---

#### M-3 · No test for text-position tie-breaking edge cases

**Commit:** `3ae0c61`  
**File:** [`src/test/enhancement-pipeline-intent-routing.test.ts`](src/test/enhancement-pipeline-intent-routing.test.ts) (not modified)

**Problem:** The new tie-breaking logic in [`classifyPrimaryIntent`](agent_service/enhancement-pipeline.mjs:407) has no dedicated tests for:
- Extraction vs. research when extraction verb appears first
- Extraction vs. analysis when analysis verb appears first
- Multiple signal candidates active simultaneously
- Prompts where the matched word appears more than once at different positions

The only eval-fixture change was correcting expected intents for `analysis-02` and `research-01`.

**Blast radius:** Regressions in tie-breaking will not be caught until they surface in production.

**Remediation:** Add test cases:
```js
it("prefers research over extraction when 'research' appears first", () => {
  const result = classifyPrimaryIntent("Research and summarize the key findings");
  expect(result.primaryIntent).toBe("research");
});

it("prefers extraction over research when 'summarize' appears first", () => {
  const result = classifyPrimaryIntent("Summarize the research paper findings");
  expect(result.primaryIntent).toBe("extraction");
});

it("prefers analysis over extraction when 'analyze' appears first", () => {
  const result = classifyPrimaryIntent("Analyze and extract the key trends");
  expect(result.primaryIntent).toBe("analysis");
});
```

---

#### M-4 · `handleApplyToBuilder` field ownership marking has no test coverage

**Commit:** `3ae0c61`  
**File:** [`src/pages/Index.tsx`](src/pages/Index.tsx:1594-1596)  
**Lines:** 1594–1596

**Problem:** The new field-ownership tracking in `handleApplyToBuilder` (marking applied fields as "ai" owned) has no dedicated test. If the mapping from `configUpdates` to inference field names breaks, fields could be silently unmarked or mis-owned.

**Blast radius:** Incorrect field ownership can cause the auto-apply safety gate (which skips user-owned fields) to overwrite user edits on subsequent inference runs.

**Remediation:** Add a test that verifies `setFieldOwnership` is called with the correct fields when `handleApplyToBuilder` applies structured metadata.

---

### LOW

#### L-1 · Commit message "yp" violates project conventions

**Commit:** `3ae0c61`

**Problem:** The commit message "yp" does not follow the project's convention of "clear imperative commits with optional scope" (e.g., `ui: improve community post card spacing`). This makes `git log`, `git bisect`, and changelog generation useless for this commit.

**Remediation:** Amend or squash with a descriptive message, e.g.:
```
feat(enhance): add analysis intent routing, text-position tie-breaking, and metadata hardening
```

---

#### L-2 · Accessibility additions are incomplete — missing `role="radiogroup"` or `role="toolbar"`

**Commit:** `3ae0c61`  
**Files:** [`src/components/BuilderHeroInput.tsx`](src/components/BuilderHeroInput.tsx:131), [`src/components/OutputPanel.tsx`](src/components/OutputPanel.tsx:647)

**Problem:** `aria-pressed` was added to toggle buttons, which is correct. However:
- The `EnhanceOptionGroup` uses `role="group"` with `aria-label`, which is fine for a group of related controls.
- The intent route buttons in `BuilderHeroInput` have `aria-pressed` but their parent container lacks a grouping role. Screen readers may not announce them as a cohesive control set.

**Blast radius:** Minor accessibility gap — not a regression, but an incomplete improvement.

**Remediation:** Wrap the intent route buttons in a container with `role="radiogroup"` or `role="toolbar"` and an appropriate `aria-label`.

---

#### L-3 · `safeCounter` silently floors fractional values

**Commit:** `3ae0c61`  
**File:** [`src/lib/prompt-enhancement-profile.ts`](src/lib/prompt-enhancement-profile.ts:103-105)

**Problem:** `Math.floor(value)` silently converts fractional counters (e.g., `2.7`) to integers. While counters should always be integers, if corrupted localStorage data contains fractions, this masks the corruption rather than flagging it.

**Blast radius:** Negligible — purely defensive. But `Math.round` would be more semantically honest for counters.

**Remediation:** Consider `Math.round` or adding a warning when non-integer values are encountered.

---

#### L-4 · Plan document at 977 lines is a maintenance burden

**Commit:** `3ae0c61`  
**File:** `2026-03-09-prompt-enhancement-improvements.md` (never created)

**Problem:** At 977 lines, this plan document includes detailed implementation steps, code snippets, and feasibility notes. While comprehensive, it will quickly become stale as implementation progresses and may create confusion about what's been implemented vs. planned.

**Remediation:** Add a "Status" column to each task section that tracks implementation state (e.g., `Not Started`, `In Progress`, `Shipped`), and reference it from the project's tracking system.

---

## Summary: Cross-Cutting Patterns

### 1. Pattern vocabulary drift between backend and shared heuristics

The `REWRITE_PATTERN` in [`enhancement-pipeline.mjs`](agent_service/enhancement-pipeline.mjs:402) includes "update" while `TRANSFORM_PATTERN` in [`builder-inference-heuristics.ts`](shared/builder-inference-heuristics.ts:288) no longer does. The `ANALYSIS_PATTERN` in the backend has "audit" but `INTENT_PATTERNS.analytical` does not. These vocabularies are evolving independently without a shared source of truth.

**Recommendation:** Create a canonical keyword-to-intent mapping (either as a shared module or a reference doc) and derive all patterns from it. The `shared/` directory was created for this purpose.

### 2. Regex patterns tested but not injected into routing candidates

The commit adds `ANALYSIS_PATTERN` and `isAnalysis` but forgets to add the candidate injection block. This mirrors a general pattern where new detection signals are "half-wired" — the detection is implemented but the routing integration is incomplete. This suggests the testing strategy is focused on individual functions rather than end-to-end routing.

**Recommendation:** Add end-to-end routing tests for every word in every pattern that could be the *only* trigger for a route.

### 3. Confidence model not recalibrated for expanded signals

Adding boolean signals to the confidence formula without recalibrating the coefficient inflates scores. As more signals are added (per the plan's Task 6a), this will get worse.

**Recommendation:** Switch to a normalized formula: `0.6 + 0.35 * (matchCount / maxPossibleMatches)`, capped at 0.95.

---

## Reversion Assessment

**Should commit `3ae0c61` be reverted?** No — the commit contains multiple independent improvements (accessibility, telemetry cleanup, profile hardening, test expansion) that are individually valuable. However, the **C-1** and **H-1** findings should be addressed as a hot-fix before the next production deployment.

**Recommended approach:** Apply targeted fixes rather than full reversion:

1. Fix [C-1] `parseDetectedContext` guard to include `primaryIntent`
2. Fix [H-1] Add "analysis" candidate injection for `isAnalysis`
3. Fix [H-2] Restore "update" in `TRANSFORM_PATTERN` or document removal
4. Fix [H-3] Recalibrate confidence formula
5. Add tests for [M-3] and [M-4]
6. Amend commit message [L-1]

---

## Prioritized Action Plan

| Priority | Finding | Action | Blocking? |
|----------|---------|--------|-----------|
| 1 | C-1 | Add `primaryIntent` to the empty-context guard | Yes — production data loss |
| 2 | H-1 | Add `isAnalysis` candidate injection block | Yes — routing correctness |
| 3 | H-3 | Recalibrate confidence formula | Yes — threshold gating |
| 4 | H-2 | Restore "update" in TRANSFORM_PATTERN | No — edge case |
| 5 | M-1 | Use `m.index` for position-based tie-breaking | No — robustness |
| 6 | M-3 | Add tie-breaking edge case tests | No — safety net |
| 7 | M-4 | Add handleApplyToBuilder ownership test | No — safety net |
| 8 | L-1 | Amend commit message | No — housekeeping |
| 9 | L-2 | Complete ARIA grouping for intent buttons | No — enhancement |

Items 1–3 should ship together as an immediate follow-up commit.
