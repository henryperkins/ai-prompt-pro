# PromptForge Builder Workflow Reference

Last updated: 2026-03-13

> Status: Active source-of-truth reference for the shipped builder route. Use this before relying on older launch screenshots or archived UX review snapshots.

## Purpose

Keep builder-facing docs, reviews, and launch artifacts aligned to the current
`/` route after the 2026-03-13 UX remediation pass.

## Current visual baselines

Use these artifacts as the current builder evidence set:

- `output/playwright/current-builder-desktop-2026-03-13.png`
- `output/playwright/current-builder-mobile-390-2026-03-13.png`
- `output/playwright/builder-mobile-settings.png`

## Historical builder screenshots

Do not treat these as the current builder baseline unless you are explicitly
doing a before/after comparison against older collateral:

- `screenshots/desktop/home.png`
- `screenshots/launch-sprint/builder-desktop.png`
- `screenshots/launch-sprint/builder-mobile-390.png`

## Canonical user-facing vocabulary

- Primary AI action: `Enhance prompt`
- AI settings surface: `Enhancement settings`
- Pre-run draft score surface: `Builder readiness`
- Left-column draft-shaping groups: `Prompt details`, `Context and sources`
- Draft recovery menu: `Draft actions`
- Suggestion surface: `Smart suggestions`

## Current desktop flow

1. Write the initial task in `What should the model do?`
2. Optionally expand `Prompt details` and `Context and sources`
3. Review `Builder readiness` and the current draft preview
4. Adjust `Enhancement settings` from the preview rail
5. Run `Enhance prompt`
6. Review, copy, save, or share the draft or enhanced output

## Current mobile flow

1. Write in the same hero field
2. Use the sticky bar for `Builder readiness`, `Enhance prompt`, the preview
   trigger (`No preview yet`, `Draft prompt`, or `Enhanced prompt`), and
   `Settings`
3. Open the `Enhancement settings` sheet for AI preferences and signed-in
   Codex session access
4. Open the preview drawer to review, copy, and save the current output

## Degraded inference behavior

When `infer-builder-fields` is unavailable:

- the route stays authorable;
- local suggestion chips remain available when they can be inferred locally;
- the hero shows `Using local suggestions while AI suggestions reconnect. We'll retry automatically.`;
- if a retry is already underway, the status reads
  `Refreshing AI suggestions. Local suggestions remain available.`;
- retry attempts are backed off instead of re-firing on every eligible edit.

## Primary source files

- `src/pages/Index.tsx`
- `src/components/BuilderHeroInput.tsx`
- `src/components/BuilderAdjustDetails.tsx`
- `src/components/BuilderSourcesAdvanced.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/MobileEnhancementSettingsSheet.tsx`
