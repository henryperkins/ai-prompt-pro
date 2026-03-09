# Launch Measurement Baseline

Last updated: 2026-02-26

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

| Metric | Event(s) | Formula |
|---|---|---|
| First-pass accept rate | `builder_enhance_accepted` / `builder_enhance_completed` (success) | Users who copy/save/share before re-running |
| Rapid rerun rate | `builder_enhance_rerun` / `builder_enhance_completed` (success) | Users who immediately re-enhance |
| Variant application rate | `builder_enhance_variant_applied` / `builder_enhance_metadata_received` | Users who switch to shorter/detailed |
| Acceptance rate for vague prompts | `builder_enhance_accepted` where input < 20 words / total vague | Requires prompt length in payload |

## Weekly Reporting Template
- Owner: Growth
- Cadence: weekly (every Monday)
- Required sections:
  - Traffic by channel and campaign
  - Activation funnel conversion
  - Retention trend
  - Enhancement usefulness (accept rate, rerun rate, variant usage)
  - Experiment readout (hero + CTA)
  - Risks and next actions
