# Design System State Matrix

Last updated: 2026-03-12

This file is the live state-coverage artifact for PromptForge primitives and branded wrappers. It is derived from `docs/design-system-state-matrix-template.md` and should be updated alongside story, test, or wrapper-contract changes.

## Core State Matrix

| Component | Variant/Tone coverage | Size/Density coverage | Rest | Hover | Focus-visible | Active/Pressed | Disabled | Loading/Busy | Error/Invalid | Read-only | Reduced motion behavior | Mobile touch target >=44px | Evidence links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button | Complete: primary/secondary/tertiary/destructive/icon-only | Complete: `sm`, `icon`, utility icon buttons | Storybook + route runtime | Storybook | Route axe + Storybook | Components showcase toggles and table pagination | Partial: runtime + disabled link regression | Complete: loading story | Partial: destructive tone only | n/a | Partial: inherits global motion policy | Complete for primary shell/community actions | `src/components/base/buttons/button.stories.tsx`, `src/test/button-utility.test.tsx`, `src/test/accessibility-axe.test.tsx`, `src/pages/ComponentsShowcase.tsx` |
| Input | Partial: default product inputs | Partial: route/runtime only | Storybook + route runtime | Storybook | Route axe | n/a | Partial: runtime only | n/a | Partial: route/runtime only | Partial: runtime only | Partial: inherits global motion policy | Complete on mobile-sized route controls | `src/components/base/input/input.stories.tsx`, `src/test/accessibility-axe.test.tsx`, `src/pages/Community.tsx`, `src/pages/Presets.tsx` |
| Select | Partial: canonical select surface | Partial: runtime only | Storybook + route runtime | Storybook | Route axe | Runtime only | Partial: runtime only | n/a | Partial: runtime only | n/a | Partial: inherits global motion policy | Complete on filter surfaces | `src/components/base/select/select.stories.tsx`, `src/test/accessibility-axe.test.tsx`, `src/pages/Library.tsx` |
| Checkbox | Partial: canonical checkbox surface | Partial: runtime only | Storybook + route runtime | Storybook | Route axe | Components showcase table selection | Partial: runtime only | n/a | n/a | n/a | Partial: inherits global motion policy | Complete in table and library rows | `src/components/base/checkbox/checkbox.stories.tsx`, `src/test/components-showcase-blocks.test.tsx`, `src/test/accessibility-axe.test.tsx` |
| Textarea | Partial: canonical textarea surface | Partial: runtime only | Storybook | Storybook | Route/runtime only | n/a | Partial: runtime only | n/a | Partial: runtime only | Partial: runtime only | Partial: inherits global motion policy | Complete on mobile builder forms | `src/components/base/textarea/textarea.stories.tsx`, `src/pages/Index.tsx`, `src/pages/Library.tsx` |
| Dialog/Drawer triggers | Partial: dialog + drawer trigger patterns | Partial: mobile drawer density in stories/runtime | Storybook + runtime | Storybook | Route axe | Runtime only | Partial: runtime only | n/a | n/a | n/a | Partial: inherits global motion policy | Complete: mobile drawer trigger targets meet shell standard | `src/components/base/dialog.stories.tsx`, `src/components/base/drawer.stories.tsx`, `src/test/accessibility-axe.test.tsx`, `playwright/community.mobile.spec.ts` |
| Tabs | Partial: canonical tab trigger pattern | Partial: runtime only | Storybook | Storybook | Route/runtime only | Runtime only | Partial: runtime only | n/a | n/a | n/a | Partial: inherits global motion policy | Complete on route/tab bars | `src/components/base/tabs.stories.tsx`, `src/pages/Library.tsx`, `src/pages/Presets.tsx` |
| Table actions (header/cell controls) | Complete for showcase action table | Partial: compact action cells + pagination | Components showcase runtime | Runtime only | Route axe | Regression test for select/pagination | Partial: previous/next disabled coverage | n/a | n/a | n/a | Partial: inherits global motion policy | Complete in showcase/table controls | `src/test/components-showcase-blocks.test.tsx`, `src/test/accessibility-axe.test.tsx`, `src/components/application/tables/team-members-table.tsx` |
| PageShell / PageHero | Complete: default + midnight shell wrappers | Complete: product shell + community shell variants | Storybook + showcase route | Runtime only | Route axe | Runtime only | n/a | n/a | n/a | n/a | Partial: inherits global motion policy | Complete: mobile footer/nav shell chrome | `src/components/PageShell.stories.tsx`, `src/pages/ComponentsShowcase.tsx`, `src/test/accessibility-axe.test.tsx` |
| ProfileHero | Complete: viewer/following/own-profile wrapper states | Complete: hero surface + stat-strip density | Storybook + showcase route | Runtime only | Route axe via showcase profile checkpoint | Follow button runtime | Partial: follow pending runtime | n/a | n/a | n/a | Partial: inherits global motion policy | Complete on community route shell spacing | `src/components/community/ProfileHero.stories.tsx`, `src/pages/ComponentsShowcase.tsx`, `src/pages/Profile.tsx`, `src/test/accessibility-axe.test.tsx` |

## Content and Accessibility Checks

| Checkpoint | Pass/Fail | Notes |
| --- | --- | --- |
| Non-color cues exist for error/success/warning states (iconography/text/shape). | Pass | `StateCard`, destructive buttons, and rarity badges pair color with iconography/text. |
| Focus indicator meets contrast and is not visually clipped. | Pass | Covered by route axe and shared focus-ring classes across buttons, shell links, and utility controls. |
| Disabled state communicates reason where user action is blocked. | Partial | Disabled controls are visually styled and semantically disabled, but reason copy is still route-specific rather than standardized. |
| Keyboard order and semantics are valid for all interactive states. | Pass | Route axe is green for builder, community, feed, library, presets, history, privacy, terms, contact, support inbox, showcase, and not-found routes. |
| Screen-reader labels and descriptions remain stable across state transitions. | Pass | Utility buttons now fall back to tooltip labels, progress indicators require accessible names, and route-level axe checks cover the showcase and community dynamic routes. |
| Visual state changes avoid layout shift for primary controls. | Pass | Button sizes, stat cards, and showcase controls preserve layout while toggling states. |

## Required Verification Artifacts

| Artifact | Location | Complete |
| --- | --- | --- |
| Storybook stories covering each row in the Core State Matrix | `src/components/base/*.stories.tsx`, `src/components/PageShell.stories.tsx`, `src/components/community/ProfileHero.stories.tsx` | Yes |
| Unit/integration tests for focus, invalid, and disabled behavior | `src/test/button-utility.test.tsx`, `src/test/components-showcase-blocks.test.tsx`, `src/test/accessibility-axe.test.tsx`, `src/test/community-routes-accessibility-axe.test.tsx`, `src/test/progress-indicators.test.tsx` | Yes |
| Mobile Playwright evidence for touch target and overflow behavior | `playwright/community.mobile.spec.ts` | Yes |
| Dark + standard theme screenshots for critical components | Storybook stories for `PageShell` and `ProfileHero`; showcase route for runtime comparison | Partial |

## Current Follow-ups

- Standardize a reusable “disabled reason” affordance when a blocked action needs explanatory copy instead of route-local helper text.
- Add explicit reduced-motion assertions for branded wrappers if motion is introduced beyond the current token-level policy.
- Capture committed screenshot artifacts only if design review begins requiring image-based diffs instead of route/story checkpoints.
