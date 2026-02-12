# Uncommitted Changes Review Findings

## Scope
Reviewed staged changes in this workspace on 2026-02-11.

## Findings

### 1) Medium: Stale suggestion chips can reappear after prompt is shortened/cleared
- What changed: In the suggestion inference effect, when prompt length drops below threshold, the effect returns early without invalidating the active request token.
- Why this matters: A prior in-flight inference response can still resolve and overwrite UI state with stale chips after the prompt is cleared or shortened.
- Evidence:
  - `src/pages/Index.tsx:923`
  - `src/pages/Index.tsx:930`
  - `src/pages/Index.tsx:941`

### 2) Medium: Legacy saved prompt hydration now skips source normalization on load
- What changed: persistence load paths switched from `normalizeTemplateConfig(...)` to `hydrateConfigV1ToWorkingState(...)`.
- Why this matters: older records that do not already contain normalized source metadata may load without `source.reference` / `source.validation`. This can degrade warning quality and external reference derivation.
- Evidence:
  - `src/lib/persistence.ts:282`
  - `src/lib/persistence.ts:330`
  - `src/lib/persistence.ts:686`
  - `src/lib/prompt-config-adapters.ts:69`
  - `src/lib/template-store.ts:347`

### 3) Medium: Accessibility regression for custom detail inputs (missing accessible names)
- What changed: Custom role/format/constraint inputs render without associated labels or explicit `aria-label`.
- Why this matters: Screen readers announce unlabeled text fields, reducing usability and violating common a11y expectations.
- Evidence:
  - `src/components/BuilderAdjustDetails.tsx:97`
  - `src/components/BuilderAdjustDetails.tsx:140`
  - `src/components/BuilderAdjustDetails.tsx:186`

### 4) Low: Toggle-like buttons do not expose selected state to assistive tech
- What changed: Tone/format choice buttons behave as toggles but do not set `aria-pressed`.
- Why this matters: selection state is only visual; assistive technologies do not get state feedback.
- Evidence:
  - `src/components/BuilderAdjustDetails.tsx:108`
  - `src/components/BuilderAdjustDetails.tsx:127`

### 5) Low: Inference apply path can silently no-op if `inferredFields` is omitted
- What changed: Remote inference type allows `inferredFields?`, while apply logic iterates only `inference.inferredFields`.
- Why this matters: if backend/client payload shape drifts and `inferredUpdates` is present but `inferredFields` is absent, no updates are applied.
- Evidence:
  - `src/lib/ai-client.ts:685`
  - `src/lib/builder-inference.ts:101`
  - `src/pages/Index.tsx:154`

### 6) Low: Local and edge inference heuristics are duplicated (drift risk)
- What changed: field inference regex/rules exist in both frontend local inference and edge function.
- Why this matters: any future divergence causes inconsistent suggestions depending on fallback path.
- Evidence:
  - `src/lib/builder-inference.ts:212`
  - `supabase/functions/infer-builder-fields/index.ts:37`

## Test Gaps

1. Missing regression test for stale suggestion cancellation when prompt falls below inference threshold.
- Relevant area: `src/pages/Index.tsx:920`

2. Missing compatibility test for loading legacy saved configs with unnormalized sources.
- Relevant area: `src/lib/persistence.ts:282`

3. Missing accessibility tests for accessible names on custom role/format/constraint inputs.
- Relevant area: `src/components/BuilderAdjustDetails.tsx:97`

4. Missing accessibility tests for pressed state semantics on tone/format toggles.
- Relevant area: `src/components/BuilderAdjustDetails.tsx:108`

5. Missing robustness test for handling remote inference payloads without `inferredFields`.
- Relevant area: `src/lib/builder-inference.ts:101`
