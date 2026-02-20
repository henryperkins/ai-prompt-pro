# Launch Experiments

## Scope
Two launch-window experiments are configured:
- Hero copy A/B
- Primary CTA text A/B

## Runtime Configuration
Feature flags in `.env`:
- `VITE_LAUNCH_EXPERIMENT_HERO_COPY`
- `VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA`

Assignments are session-sticky and can be overridden with URL params:
- `exp_hero=a|b|control|speed`
- `exp_cta=a|b|control|quality_pass`

## Variants
Hero copy:
- A (`control`): Turn rough ideas into quality prompts with context
- B (`speed`): Ship quality prompts faster with grounded context

Primary CTA:
- A (`control`): Enhance prompt
- B (`quality_pass`): Run quality pass

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
