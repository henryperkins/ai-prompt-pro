# Launch Experiments

Last updated: 2026-03-13

> Status: Active by default.

## Scope
One launch-window experiment is configured:
- Hero copy A/B

## Runtime Behavior
Launch assignments always run for the hero copy experiment.

Assignments are session-sticky and can be overridden with URL params:
- `exp_hero=a|b|control|speed`

## Variants
Hero copy:
- A (`control`): Turn rough ideas into quality prompts with context
- B (`speed`): Ship quality prompts faster with grounded context

Primary CTA copy is now fixed to `Enhance prompt`. There is no active CTA
experiment assignment.

## Success Metrics
Primary metric:
- `builder_enhance_clicked` rate per `builder_loaded`

Guardrails:
- `builder_enhance_completed` success rate
- No drop in save/share actions

## Decision Rules
- Promote variant B only if:
  - >= 5% relative lift in primary metric
  - No guardrail regression greater than 2%
  - Minimum sample: 1,000 builder sessions per variant
- Roll back experiment if:
  - Guardrail drops > 3% for 2 consecutive days
  - Any critical UX/accessibility issue appears in launch QA
