# Prompt Enhancement Eval Set

## Overview

A 60-case deterministic regression set for the enhancement pipeline. Cases live
in `src/test/fixtures/prompt-enhancement-evals.json` and are exercised by
`src/test/prompt-enhancement-evals.test.ts`.

The suite covers three layers:

1. `classifyPrimaryIntent()` routing
2. `detectEnhancementContext()` ambiguity and missing-slot heuristics
3. `postProcessEnhancementResponse()` normalization for placeholder-heavy,
   clarification-heavy, and structured-plan payloads

## Category Coverage

| Category | Count | What it tests |
|---|---:|---|
| Vague prompts | 8 | High-ambiguity routing and missing-slot coverage |
| Rewrite tasks | 7 | Transform intent routing without objective drift |
| Analysis tasks | 7 | Analytical routing and structured reasoning fields |
| Code tasks | 7 | Code routing, implementation constraints, required inputs |
| Brainstorming | 7 | Creative routing, optional null-intent edge cases |
| Extraction | 6 | Extraction routing and source-bound outputs |
| Research | 6 | Research routing plus verification-oriented structure |
| Planning | 6 | Planning routing, milestones, and constraint framing |
| Fact-sensitive | 6 | Verification-sensitive ambiguity and open-question flows |

## Fixture Schema

Each case stores:

- `input`
- `expectedPrimaryIntent`
- `expectedAmbiguityLevel`
- `expectedMissingSlots`
- `requiresPlaceholders`
- `requiresOpenQuestions`
- `expectedStructuredFields`
  `expectedStructuredFields` refers to the minimum `enhancement_plan` fields a
  normalized response must retain for that case.
- `forbiddenAssumptions`

## What Fails The Build

Blockers:

- Primary-intent mismatches
- Ambiguity-level mismatches
- Missing-slot mismatches
- Placeholder-mode normalization failures for cases marked
  `requiresPlaceholders`
- Clarification-mode normalization failures for cases marked
  `requiresOpenQuestions`
- Missing `enhancement_plan` fields listed in `expectedStructuredFields`
- Forbidden assumptions leaking into normalized metadata

Advisory review items:

- Category balance drifting below the 50-case floor
- Real-product prompts that expose a new route or ambiguity pattern not yet in
  the fixture
- Spikes in live telemetry for `builder_enhance_too_much_changed`

## Adding New Cases

When adding a case:

1. Add the raw prompt to the fixture candidate list.
2. Populate `expectedPrimaryIntent`, `expectedAmbiguityLevel`, and
   `expectedMissingSlots` from the current deterministic pipeline output.
   Do not guess these fields by hand.
3. Add `requiresPlaceholders` and `requiresOpenQuestions` only when the case
   should participate in the canned post-processing assertions.
4. Set `expectedStructuredFields` to the minimum `enhancement_plan` fields that
   must survive normalization for that case.
5. Add at least one `forbiddenAssumptions` phrase that would indicate
   over-invention for that prompt type.
6. If the category mix changes, update the counts in this doc.

Keep the set at 50+ cases. The current target is 60 so trimming a few prompts
later does not drop coverage below the original floor.

## Weekly Review Cadence

- Inspect deterministic regressions after each release or routing change.
- Review failures by bucket: routing, ambiguity, placeholder/clarification
  normalization, structured-plan retention.
- Review the highest-volume vague prompts with low acceptance.
- Review prompts with `builder_enhance_too_much_changed` spikes alongside their
  edit-distance ratios.
- Add new cases for any real product prompt that exposes a routing or ambiguity
  miss.

## How To Run

```bash
npx vitest run src/test/prompt-enhancement-evals.test.ts
```

## Live-Product Metrics

See `docs/launch-measurement-baseline.md` for:

- First-pass accept rate
- Rapid rerun rate
- Median pre-vs-post edit distance
- Vague-prompt accept rate
- Too-much-changed trigger rate
- Alternative-version usage rate
