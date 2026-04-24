# Design System Baseline Inventory

This file captures the pre-normalization baseline requested in the design-system refactor checklist (section 1.3).

## Core design-system components used by product screens

Product screens are `src/pages/*.tsx` route-level files.

| Component | Canonical import | Pages using canonical import | Page count |
| --- | --- | --- | --- |
| Button | `@/components/base/buttons/button` | `src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/History.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/Profile.tsx`, `src/pages/ResetPassword.tsx`, _+1 more_ | 9 |
| Input | `@/components/base/input/input` | `src/pages/Community.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/ResetPassword.tsx` | 4 |
| Textarea | `@/components/base/textarea` | _none_ | 0 |
| Label | `@/components/base/label` | _none_ | 0 |
| Select | `@/components/base/select/select` | `src/pages/Library.tsx` | 1 |
| Card | `@/components/base/card` | `src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/ComponentsShowcase.tsx`, `src/pages/History.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/Privacy.tsx`, _+2 more_ | 10 |
| Badge | `@/components/base/badges/badges` | `src/pages/ComponentsShowcase.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/SupportInbox.tsx` | 5 |
| Dialog | `@/components/base/dialog` | _none_ | 0 |
| Drawer | `@/components/base/drawer` | `src/pages/Community.tsx`, `src/pages/Index.tsx` | 2 |
| Table | `@/components/base/table` | _none_ | 0 |

### All `@/components/base/*` imports currently used in product screens

| Import specifier | Page count | Pages |
| --- | --- | --- |
| `@/components/base/card` | 10 | `src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/ComponentsShowcase.tsx`, `src/pages/History.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/Privacy.tsx`, _+2 more_ |
| `@/components/base/buttons/button` | 9 | `src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/History.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/Profile.tsx`, `src/pages/ResetPassword.tsx`, _+1 more_ |
| `@/components/base/badges/badges` | 5 | `src/pages/ComponentsShowcase.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/SupportInbox.tsx` |
| `@/components/base/input/input` | 4 | `src/pages/Community.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx`, `src/pages/ResetPassword.tsx` |
| `@/components/base/state-card` | 4 | `src/pages/CommunityPost.tsx`, `src/pages/Library.tsx`, `src/pages/NotFound.tsx`, `src/pages/Profile.tsx` |
| `@/components/base/drawer` | 2 | `src/pages/Community.tsx`, `src/pages/Index.tsx` |
| `@/components/base/skeleton` | 2 | `src/pages/CommunityPost.tsx`, `src/pages/Profile.tsx` |
| `@/components/base/toast` | 2 | `src/pages/Index.tsx`, `src/pages/Library.tsx` |
| `@/components/base/avatar` | 1 | `src/pages/Library.tsx` |
| `@/components/base/badges/badge-groups` | 1 | `src/pages/ComponentsShowcase.tsx` |
| `@/components/base/button-group/button-group` | 1 | `src/pages/ComponentsShowcase.tsx` |
| `@/components/base/buttons/button-utility` | 1 | `src/pages/ComponentsShowcase.tsx` |
| `@/components/base/checkbox` | 1 | `src/pages/Library.tsx` |
| `@/components/base/dropdown-menu` | 1 | `src/pages/Library.tsx` |
| `@/components/base/input/input-group` | 1 | `src/pages/ResetPassword.tsx` |
| `@/components/base/progress-indicators/progress-circles` | 1 | `src/pages/ComponentsShowcase.tsx` |
| `@/components/base/progress-indicators/progress-indicators` | 1 | `src/pages/ComponentsShowcase.tsx` |
| `@/components/base/scroll-area` | 1 | `src/pages/Community.tsx` |
| `@/components/base/select/select` | 1 | `src/pages/Library.tsx` |

## Style entrypoints imported globally

Runtime CSS import chain:

1. `src/main.tsx`
1. `./styles/globals.css`
1. `src/styles/globals.css` `@import` order
1. `tailwindcss`
1. `./typography.css`
1. `./tokens.css`
1. `./theme.css`
1. `./base.css`
1. `./components.css`
1. `./community.css`
1. `./promptforge-fantasy.css`

## `pf-*` class usage map in code

Scope: `src/**/*.ts(x)` excluding `src/styles/**` and `src/test/**`.

| pf class | File count | Files |
| --- | --- | --- |
| `pf-card` | 14 | `src/components/PageShell.stories.tsx`, `src/components/community/CommunityFeed.tsx`, `src/components/community/CommunityPostCard.tsx`, `src/components/community/CommunityPostDetail.tsx`, `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/ComponentsShowcase.tsx`, _+6 more_ |
| `pf-community-page` | 6 | `src/components/PageShell.stories.tsx`, `src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`, `src/pages/Contact.tsx`, `src/pages/NotFound.tsx`, `src/pages/Profile.tsx` |
| `pf-gilded-frame` | 5 | `src/components/PageShell.tsx`, `src/components/community/ProfileHero.tsx`, `src/pages/Index.tsx`, `src/pages/Profile.tsx`, `src/pages/ResetPassword.tsx` |
| `pf-gold` | 4 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx` |
| `pf-hero-surface` | 4 | `src/components/PageShell.stories.tsx`, `src/components/PageShell.tsx`, `src/components/community/ProfileHero.tsx`, `src/pages/Index.tsx` |
| `pf-panel` | 4 | `src/pages/Community.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx` |
| `pf-parchment` | 4 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx` |
| `pf-text-display` | 4 | `src/components/PageShell.tsx`, `src/components/community/ProfileHero.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx` |
| `pf-divider` | 3 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx`, `src/pages/Index.tsx` |
| `pf-arcane` | 2 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx` |
| `pf-arcane-rgb` | 2 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-coal` | 2 | `src/components/fantasy/PFTemplateCard.tsx`, `src/pages/Index.tsx` |
| `pf-community-preview` | 2 | `src/components/community/CommunityPostCard.tsx`, `src/components/community/CommunityPostDetail.tsx` |
| `pf-dialog-surface` | 2 | `src/components/AuthDialog.tsx`, `src/pages/Community.tsx` |
| `pf-ember` | 2 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFTemplateCard.tsx` |
| `pf-ember-rgb` | 2 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-gold-rgb` | 2 | `src/components/community/ProfileHero.tsx`, `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-mobile-nav-occupied-height` | 2 | `src/components/PageShell.tsx`, `src/pages/Index.tsx` |
| `pf-nav-button` | 2 | `src/components/Header.tsx`, `src/components/PageShell.tsx` |
| `pf-rarity-legendary` | 2 | `src/components/fantasy/PFTemplateCard.tsx`, `src/lib/community-rarity.ts` |
| `pf-builder-mobile-sticky-reserved-height` | 1 | `src/pages/Index.tsx` |
| `pf-card--static` | 1 | `src/components/community/ProfileHero.tsx` |
| `pf-coal-rgb` | 1 | `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-community-popover` | 1 | `src/pages/Community.tsx` |
| `pf-community-toolbar` | 1 | `src/pages/Community.tsx` |
| `pf-hero-dismissed` | 1 | `src/pages/Index.tsx` |
| `pf-mobile-nav` | 1 | `src/components/BottomNav.tsx` |
| `pf-mobile-nav-link-min-height` | 1 | `src/components/BottomNav.tsx` |
| `pf-nav-header` | 1 | `src/components/Header.tsx` |
| `pf-parchment-rgb` | 1 | `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-rarity-common` | 1 | `src/components/fantasy/PFTemplateCard.tsx` |
| `pf-rarity-epic` | 1 | `src/components/fantasy/PFTemplateCard.tsx` |
| `pf-rarity-rare` | 1 | `src/components/fantasy/PFTemplateCard.tsx` |
| `pf-shell-backdrop` | 1 | `src/components/PageShell.tsx` |
| `pf-shell-footer` | 1 | `src/components/PageShell.tsx` |
| `pf-shell-footer-link` | 1 | `src/components/PageShell.tsx` |
| `pf-shell-main` | 1 | `src/components/PageShell.tsx` |
| `pf-slate` | 1 | `src/components/community/ProfileHero.tsx` |
| `pf-slate-rgb` | 1 | `src/components/fantasy/PFQualityGauge.tsx` |
| `pf-sticky-header-height` | 1 | `src/pages/Community.tsx` |

## Duplicate component/hook/utility pairs

| Pair | Canonical | Duplicate or legacy | Status | Canonical import callsites | Duplicate import callsites |
| --- | --- | --- | --- | --- | --- |
| Label entrypoint | `@/components/base/label` | `@/components/base/input/label` | frozen | `src/components/BuilderAdjustDetails.tsx`, `src/components/BuilderSourcesAdvanced.tsx`, `src/components/ContextIntegrations.tsx`, `src/components/Header.tsx`, `src/components/OutputPanelSaveDialog.tsx`, `src/components/base/input/input-group.tsx`, `src/components/base/input/input.tsx`, `src/components/base/input/label.tsx`, _+6 more_ | _none_ |
| Textarea entrypoint | `@/components/base/textarea` | `@/components/base/textarea/textarea` | bridge-only | `src/components/BuilderAdjustDetails.tsx`, `src/components/BuilderHeroInput.tsx`, `src/components/CodexSessionDrawer.tsx`, `src/components/ContextSourceChips.tsx`, `src/components/EnhancementEditableList.tsx`, `src/components/OutputPanelSaveDialog.tsx`, `src/components/ProjectNotes.tsx`, `src/components/base/textarea/textarea.stories.tsx`, _+4 more_ | `src/components/base/textarea.tsx` |
| Card facade | `@/components/base/card` | `@/components/base/primitives/card` | bridge-only | `src/components/BuilderAdjustDetails.tsx`, `src/components/BuilderHeroInput.tsx`, `src/components/BuilderSourcesAdvanced.tsx`, `src/components/CodexSessionDrawer.tsx`, `src/components/EnhancementClarificationCard.tsx`, `src/components/EnhancementInspector.tsx`, `src/components/OutputPanel.tsx`, `src/components/OutputPanelDetailsAccordion.tsx`, _+23 more_ | `src/components/base/card.tsx` |
| Drawer facade | `@/components/base/drawer` | `@/components/base/primitives/drawer` | bridge-only | `src/components/CodexSessionDrawer.tsx`, `src/components/Header.tsx`, `src/components/MobileEnhancementSettingsSheet.tsx`, `src/components/base/drawer.stories.tsx`, `src/components/community/CommunityPostCard.tsx`, `src/components/community/CommunityPostDetail.tsx`, `src/pages/Community.tsx`, `src/pages/Index.tsx`, _+1 more_ | `src/components/base/drawer.tsx` |
| Prompt-builder context hook | `@/hooks/useContextConfig` | `@/hooks/usePromptBuilderContext` | removed | `src/hooks/usePromptBuilder.ts`, `src/test/useContextConfig.test.ts` | _none_ |
| Class merge helper | `@/lib/utils/cx` | `@/lib/utils` | frozen | `src/components/BottomNav.tsx`, `src/components/BuilderAdjustDetails.tsx`, `src/components/ContextInterview.tsx`, `src/components/NotificationPanel.tsx`, `src/components/OutputPanel.tsx`, `src/components/OutputPanelDetailsAccordion.tsx`, `src/components/OutputPanelEnhanceControls.tsx`, `src/components/OutputPanelSaveDialog.tsx`, _+67 more_ | _none_ |

## Baseline screenshot/state capture

No screenshot artifacts are committed in this baseline file.
Use `src/pages/ComponentsShowcase.tsx` (including the branded-surface checkpoint for `PageShell`/`PageHero` and `ProfileHero`) and Storybook stories as visual checkpoints before API-normalization passes.

## Repro command

```bash
npm run report:design-system-baseline
```
