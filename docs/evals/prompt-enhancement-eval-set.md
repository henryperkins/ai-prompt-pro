# Prompt Enhancement Eval Set

## Overview

A 23-case eval set for deterministic regression testing of the enhancement pipeline.
Cases are stored in `src/test/fixtures/prompt-enhancement-evals.json` and tested
by `src/test/prompt-enhancement-evals.test.ts`.

## Categories

| Category | Count | What it tests |
|---|---|---|
| Vague prompts | 5 | Ambiguity detection, no false specificity |
| Rewrite tasks | 3 | Transform intent routing |
| Analysis tasks | 3 | Analytical intent routing |
| Code tasks | 3 | Code intent routing |
| Brainstorming | 3 | Creative intent routing |
| Extraction | 2 | Extraction intent routing |
| Fact-sensitive | 2 | Factual verification slot detection |
| Planning | 1 | Planning intent routing |
| Research | 1 | Research intent routing |

## Deterministic checks (no model required)

1. **Correct route selected** — `classifyPrimaryIntent` returns expected `primaryIntent`
2. **Ambiguity level** — `detectEnhancementContext` returns expected `ambiguityLevel`
3. **Missing slots** — fact-sensitive cases flag `factual_verification`
4. **Structural fields present** — all contexts have `intent`, `domain`, `complexity`, `primaryIntent`, `ambiguityLevel`, `missingSlots`

## Weekly review cadence

- Inspect regressions after each release
- Inspect top failed vague prompts (accept rate < 30%)
- Inspect top override cases where detected intent was wrong
- Inspect changes in acceptance rate week-over-week
- Add new cases for any real-world routing failures discovered

## How to run

```bash
npx vitest run src/test/prompt-enhancement-evals.test.ts
```

## Live-product metrics

See `docs/launch-measurement-baseline.md` for:
- First-pass accept rate
- Rapid rerun rate
- Pre-vs-post edit distance
- Vague-prompt accept rate
- "Too much changed" trigger rate
- Alternative-version usage rate
