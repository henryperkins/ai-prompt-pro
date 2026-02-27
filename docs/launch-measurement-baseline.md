# Launch Measurement Baseline

Last updated: 2026-02-26

> Status: Active while launch-channel measurement is tracked; archive to `docs/reviews/` when replaced by a broader growth analytics spec.

## Goal
Track awareness, activation, and retention from day one of launch.

## UTM Convention
Use `src/lib/launch-utm.ts` to create tracked URLs consistently.

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

## Weekly Reporting Template
- Owner: Growth
- Cadence: weekly (every Monday)
- Required sections:
  - Traffic by channel and campaign
  - Activation funnel conversion
  - Retention trend
  - Experiment readout (hero + CTA)
  - Risks and next actions
