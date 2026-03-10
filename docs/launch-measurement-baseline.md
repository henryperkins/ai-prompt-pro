# Launch Measurement Baseline

Last updated: 2026-03-10

> Status: Active while launch-channel measurement is tracked; archive to `docs/reviews/` when replaced by a broader growth analytics spec.

## Goal
Track awareness, activation, and retention from day one of launch.

## UTM Convention
Create tracked URLs consistently using the convention below.

Required params:
- `utm_source`
- `utm_medium`
- `utm_campaign`

Optional params:
- `utm_content`
- `utm_term`

Channel defaults:
- `organic_social` -> `source=social`, `medium=organic`
- `paid_social` -> `source=social`, `medium=paid`
- `email` -> `source=email`, `medium=owned`
- `community` -> `source=community`, `medium=referral`
- `partner` -> `source=partner`, `medium=referral`

## Dashboard Definition
Awareness:
- Sessions by `utm_source` and `utm_campaign`
- New visitors

Activation:
- `builder_loaded`
- `builder_first_input`
- `builder_enhance_clicked`
- `builder_enhance_completed` (success rate)

Retention:
- Returning sessions (7-day and 28-day)
- Repeat enhance users per week
- Save/share conversion (`builder_save_clicked` and share-enabled ratio)

## Enhancement Usefulness Metrics

Added 2026-03-09. Tracked via client-side telemetry events persisted to a
localStorage ring buffer (`src/lib/telemetry.ts`). Queryable from the browser
console via `getTelemetryLog()`.
This telemetry is an operator/developer inspection surface, not an end-user
feature, and is available from the in-product `More` -> `Developer tools`
surface.

Acceptance is emitted on successful copy, save, or save-and-share. Rerun is
independent and no longer implies acceptance.

`inputPromptChars` and `inputWordCount` refer to the exact text sent into the
enhancement run: `originalPrompt` when present, otherwise the built preview.

| Metric | Event(s) | Formula | Required payload fields |
|---|---|---|---|
| First-pass accept rate | `builder_enhance_accepted`, `builder_enhance_completed` | `count(accepted) / count(completed where success = true)` | `builder_enhance_completed.success` |
| Rapid rerun rate | `builder_enhance_rerun`, `builder_enhance_completed` | `count(rerun) / count(completed where success = true)` | `builder_enhance_completed.success` |
| Variant application rate | `builder_enhance_variant_applied`, `builder_enhance_metadata_received` | `count(variant_applied) / count(metadata_received where hasAlternatives = true)` | `builder_enhance_metadata_received.hasAlternatives` |
| Acceptance rate for vague prompts | `builder_enhance_accepted`, `builder_enhance_completed` | `count(accepted where isVaguePrompt = true) / count(completed where success = true and isVaguePrompt = true)` | `builder_enhance_accepted.isVaguePrompt`, `builder_enhance_completed.success`, `builder_enhance_completed.isVaguePrompt` |
| Median pre-vs-post edit distance | `builder_enhance_completed` | `median(editDistanceRatio)` over `completed where success = true` | `builder_enhance_completed.editDistance`, `builder_enhance_completed.editDistanceRatio`, `builder_enhance_completed.editDistanceBaseline = "enhance_input"` |
| Too-much-changed trigger rate | `builder_enhance_too_much_changed`, `builder_enhance_completed` | `count(too_much_changed) / count(completed where success = true)` | `builder_enhance_too_much_changed.editDistanceRatio`, `builder_enhance_too_much_changed.editDistanceBaseline = "builder_preview"` |

Implementation notes:
- `builder_enhance_completed` measures the original enhanced output against the run input snapshot.
- `builder_enhance_accepted` and `builder_enhance_rerun` reuse the same input snapshot fields, but compare against the currently visible accepted/rerun variant.
- `builder_enhance_too_much_changed` compares the current builder preview to the displayed enhanced prompt.

## Weekly Reporting Template
- Owner: Growth
- Cadence: weekly (every Monday)
- Required sections:
  - Traffic by channel and campaign
  - Activation funnel conversion
  - Retention trend
  - Enhancement usefulness (accept rate, rerun rate, edit-distance distribution, too-much-changed rate, variant usage)
  - Experiment readout (hero + CTA)
  - Risks and next actions
