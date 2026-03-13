# PromptForge Builder Review Findings and Remediation

Last updated: 2026-03-13

## Scope

This review follows `docs/design-ux-review-prompt.md` and uses only the current
docs and assets listed there.

Phase 1 update:

- The stale `output/playwright/current-builder-*` desktop/mobile artifacts that
  originally showed older Builder terminology were refreshed on 2026-03-13 from
  the current passing Playwright captures. Drift findings below remain useful as
  kickoff context for why the artifact refresh was required.

Primary references:

- `docs/design-system.md`
- `docs/builder-workflow-reference.md`
- `docs/launch-assets-pack.md`
- `docs/reviews/ux-review-prioritized.md` as historical context only
- `output/playwright/current-builder-desktop-2026-03-13.png`
- `output/playwright/current-builder-mobile-390-2026-03-13.png`
- `output/playwright/builder-mobile-settings.png`
- `output/playwright/design-ux-review-2026-03-13/desktop/*.png`
- `output/playwright/design-ux-review-2026-03-13/mobile/*.png`
- `screenshots/launch-sprint/*` as historical collateral only

## 1. Executive Summary

- The current empty-state Builder is materially clearer than older launch
  collateral: one large prompt field, a three-step scaffold, and progressive
  disclosure make the first task legible.
- That clarity degrades on mobile once fixed chrome appears. The sticky builder
  bar plus bottom navigation consume too much vertical space and push follow-on
  controls into a crowded lower viewport.
- The review asset set is internally inconsistent. Current docs and the
  `design-ux-review-2026-03-13/*/home.png` captures use `Enhance prompt`, while
  `output/playwright/current-builder-*` still show `Run quality pass` and a much
  denser advanced state.
- Library empty states carry too much inactive management chrome before the
  first real action. Search, filter, sort, and selection controls appear before
  the user has any saved content to manage.
- Community discovery works visually on desktop but becomes cramped on mobile.
  Filter affordance, metadata density, and action placement compete inside a
  narrow feed card.
- History and not-found are the clearest supporting routes in the pack. Their
  page goal, recovery path, and button hierarchy are easier to understand than
  Library or populated Builder.
- Brand palette, glow treatment, and panel styling are mostly coherent, but
  hero lockups and in-hero wordmark usage vary enough across routes to feel
  template-specific rather than systemized.

## 2. Findings

### Critical

- None verified from the provided assets.

### High

#### H1. Mobile Builder chrome crowds the primary workflow

Evidence:
`output/playwright/design-ux-review-2026-03-13/mobile/home.png`,
`output/playwright/current-builder-mobile-390-2026-03-13.png`,
`output/playwright/builder-mobile-settings.png`

Why it matters:
The Builder is the activation path. On 390px mobile, the hero, prompt card,
sticky builder controls, and bottom nav compete for the same viewport. Follow-on
controls are partially buried, and the user has to manage two fixed UI bands
before they can comfortably refine a prompt.

Recommendation:
Collapse the mobile sticky builder into a single primary row until preview or
settings are explicitly opened. Reserve bottom safe-area padding so content
never sits behind the navigation bar, and move secondary builder controls into
drawers or sheets instead of keeping them permanently stacked above the nav.

Effort: `M`

#### H2. Library empty states overexpose management UI before any content exists

Evidence:
`output/playwright/design-ux-review-2026-03-13/desktop/library.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/library.png`

Why it matters:
First-run users land on an empty Library and are shown search, filter, sort,
selection count, and selection toggles before the main empty-state CTA. That
front-loads admin behaviors before the product has delivered value and slows
the route's recovery path back to Builder.

Recommendation:
When saved-prompt count is zero, replace the search/filter toolbar with a
condensed empty-state explainer and one primary CTA. Reintroduce management
controls only after the first item exists.

Effort: `M`

#### H3. Mobile Community discovery is too dense for fast scan-and-remix behavior

Evidence:
`output/playwright/design-ux-review-2026-03-13/mobile/community.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/community-post-detail.png`

Why it matters:
The mobile feed stacks search, filter, segmented sorts, tag chips, metadata,
save/remix actions, and engagement counters inside a constrained viewport. The
filter row reads ambiguously at 390px, and card actions compete with low-value
metrics. That reduces discovery speed and makes remix behavior feel heavier than
it should.

Recommendation:
Reduce the mobile discovery surface to one full-width search field and one
single-tap filter control. Move low-priority metrics behind the detail screen or
an overflow panel, and preserve clear visual separation between `Save` and
`Remix` without letting bottom navigation crowd the card footer.

Effort: `M`

### Medium

#### M1. Builder evidence and vocabulary drift weaken product and review alignment

Evidence:
`docs/builder-workflow-reference.md`,
`docs/design-ux-review-prompt.md`,
`output/playwright/design-ux-review-2026-03-13/desktop/home.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/home.png`,
`output/playwright/current-builder-desktop-2026-03-13.png`,
`output/playwright/current-builder-mobile-390-2026-03-13.png`

Why it matters:
The current docs and home captures present `Enhance prompt` and staged
disclosure, while the current builder baselines still show `Run quality pass`,
`Smart suggestions`, and a denser pre-run control layout. Not verifiable from
the provided assets whether this is live product inconsistency or stale review
collateral, but either case creates alignment risk for engineering, launch, QA,
and future design reviews.

Recommendation:
Regenerate the builder baseline pack from the same build and scenario used for
the current home review captures. Keep one canonical vocabulary set, one
artifact bundle, and one owner for screenshot refresh before docs are updated.

Effort: `S`

#### M2. The populated Builder state reintroduces too many small competing controls

Evidence:
`output/playwright/current-builder-desktop-2026-03-13.png`,
`output/playwright/current-builder-mobile-390-2026-03-13.png`,
`output/playwright/builder-mobile-settings.png`

Why it matters:
The empty-state Builder is focused, but the filled Builder quickly expands into
suggestion chips, reset links, multiple segmented control groups, and several
low-contrast labels. That weakens the main edit -> enhance loop and makes the
primary input feel like one module among many instead of the central task.

Recommendation:
Keep the staged architecture even after text exists. Limit visible suggestion
chips to one row, demote reset actions into a `Draft actions` menu, and keep
enhancement preferences behind one secondary entry point rather than exposing
every dimension inline.

Effort: `M`

#### M3. Hero system is visually coherent but structurally inconsistent across routes

Evidence:
`output/playwright/design-ux-review-2026-03-13/desktop/home.png`,
`output/playwright/design-ux-review-2026-03-13/desktop/community.png`,
`output/playwright/design-ux-review-2026-03-13/desktop/library.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/history.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/library.png`

Why it matters:
The same palette and glow treatment recur across routes, which helps
recognition, but hero lockups are inconsistent. Some pages include the
PromptForge wordmark inside the hero, some do not, and headline/subtitle
proportions vary enough to make the system feel assembled per route rather than
governed by a shared template.

Recommendation:
Define and document a small hero system: one Builder hero, one collection-index
hero, and one utility-state pattern. Set a fixed rule for when the wordmark
appears inside the hero and standardize headline scale and subtitle width.

Effort: `S`

#### M4. Community participation controls are visually weaker than content chrome

Evidence:
`output/playwright/design-ux-review-2026-03-13/desktop/community-post-detail.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/community-post-detail.png`

Why it matters:
The post content, tags, and shells look premium, but the actual participation
actions are less assertive. The comment composer action is visually quiet, the
rating row sits apart from the rest of engagement, and the remix list competes
for attention without clearly advancing the contribution path.

Recommendation:
Promote one primary participation action per state. On desktop, strengthen the
comment submit affordance and tighten the engagement block. On mobile, compress
the engagement area so the next high-value action appears before the user hits
the lower card edge.

Effort: `M`

### Low

#### L1. Utility recovery screens are clear but could do more to preserve momentum

Evidence:
`output/playwright/design-ux-review-2026-03-13/desktop/notfound.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/notfound.png`,
`output/playwright/design-ux-review-2026-03-13/desktop/history.png`,
`output/playwright/design-ux-review-2026-03-13/mobile/history.png`

Why it matters:
These are the cleanest secondary screens in the pack, but they stop at simple
redirection. They recover the session, yet do not explain what the user can do
next once they return to Builder or Community.

Recommendation:
Keep the minimal layout, but add one line of context about the recommended next
action and, where appropriate, a secondary deep-link such as `Open presets` or
`View recent prompts`.

Effort: `S`

## 3. Flow Audit

### Builder enhance flow

Friction points:
The empty state is clear, but the route splits attention between the left input
column and the right-side action rail. On mobile, the sticky control stack and
bottom navigation compress the editable space quickly. In the populated state,
the interface expands into too many fine-grained controls before the user has
completed the next core action.

Drop-off risks:
Users can stall between drafting and enhancing because the route shifts from
progressive disclosure to dense control management. On mobile, some users will
avoid opening advanced controls or settings because the viewport already feels
overfull.

Quick wins:
Keep one visible primary CTA, one secondary settings entry, and one optional
advanced-control reveal. Align every Builder state to the same vocabulary and
interaction model.

### Library manage flow

Friction points:
Empty-state Library behaves like a populated admin table. Search, filter, sort,
and selection controls precede the first useful task, and the route duplicates
Builder recovery CTAs in both the header callout and empty state.

Drop-off risks:
First-run users receive a management screen without anything to manage. On
mobile, the empty-state card competes with fixed bottom navigation, which makes
the route feel heavier than History even though both are empty.

Quick wins:
Swap the empty toolbar for a single empty-state message with one CTA, then
introduce filters only when content exists. Merge duplicate Builder CTAs into
one obvious recovery action.

### Community discovery/remix flow

Friction points:
Desktop discovery is readable, but card chrome is already busy. Mobile discovery
adds search, filter, tabs, sort buttons, tags, actions, and engagement numbers
before the first card can breathe. Detail pages continue that density, which
reduces the salience of participation controls.

Drop-off risks:
Users may scan but not act. Discovery can feel like analysis work instead of a
quick browse/remix loop, and mobile users may miss the fastest action because
the screen prioritizes metadata parity over action clarity.

Quick wins:
Simplify mobile filters, demote low-value metrics, and visually privilege
`Remix` as the route-level conversion action. Keep `Save` available but quieter.

## 4. Input-Area Deep Dive

### Clarity

The current empty-state input is strong. `What should the model do?` is plain,
task-oriented copy, and the three-step helper turns the route into an obvious
sequence. That clarity is weaker in the populated state, where chips, reset
actions, and multiple preference groups sit near the prompt and dilute the main
editing job.

### Affordance

The large bordered textarea reads clearly as the primary editing surface on both
desktop and mobile. The issue is not whether the input looks editable; it is
whether surrounding controls look equally important. In the populated state,
many secondary pills and segmented toggles carry similar visual weight.

### Visual prominence

On desktop, the action rail is visually separated from the input column enough
that the edit -> enhance action requires a notable eye jump. On mobile, the CTA
is prominent, but the fixed sticky bar and bottom nav make that prominence feel
crowded rather than calm.

### State feedback

`Builder readiness` is useful because it gives a pre-run signal, but the
feedback architecture is split across readiness, preview, current-preview, and
settings blocks. In the populated builder baseline, this feels like several
parallel status regions instead of one clear next-step narrative.

### Consistency

The input-area system is not fully consistent across current evidence. The home
captures use `Enhance prompt` and staged disclosure. The builder baselines still
show older action naming and a more expanded control architecture.

### Mobile comfort

Exact touch-target measurement and keyboard-focus behavior are not verifiable
from the provided assets. Visually, however, the settings chips, filter
controls, and sticky-builder controls appear dense enough to create tap-error
risk at 390px.

### Branded treatments

The dark, luminous framing gives the Builder a distinctive identity and works
well when the page is mostly focused on one input. It helps less when decorative
hero height and persistent chrome push the actual authoring area farther down
the mobile viewport.

## 5. Prioritized Action Plan

### P0 - This sprint

1. Collapse mobile Builder chrome into one safe, non-overlapping action band.
   Success metric: at `390x844`, the input, the primary CTA, and the next
   available refinement control are all visible without any content sitting
   behind fixed navigation.
2. Regenerate and normalize the Builder evidence set.
   Success metric: docs, screenshots, and launch assets all use the same action
   name and section labels, and there is one authoritative current-state
   baseline pack.
3. Remove Library management chrome when the list is empty.
   Success metric: the empty-state explanation and primary CTA are visible above
   the fold on `390x844`, and the first meaningful action requires one tap.

### P1 - Next sprint

1. Keep populated Builder states within the same staged-disclosure model as the
   empty state.
   Success metric: the default filled Builder shows one primary action, one
   secondary settings entry, and no more than one row of suggestion chips.
2. Simplify Community mobile discovery and action hierarchy.
   Success metric: the filter control is legible at `390px`, bottom navigation
   does not crowd card actions, and `Remix` remains the dominant conversion
   action in feed and detail views.
3. Standardize hero templates and in-hero wordmark usage.
   Success metric: one documented hero template exists per route class, and the
   same wordmark rule appears across Builder, collection, and utility screens.

### P2 - Later

1. Promote participation affordances in Community detail.
   Success metric: comment submit and remix actions read as the primary next
   step without needing supporting copy.
2. Enrich low-risk recovery routes with context-aware next steps.
   Success metric: not-found and history screens preserve their clarity while
   offering one additional, relevant recovery path beyond `Go to Builder`.

## 6. Scorecard

- Visual design: `7/10`
- UX clarity: `6/10`
- Accessibility readiness: `5/10`
- Mobile quality: `5/10`
- Design-system consistency: `6/10`
- Overall product polish: `6/10`

## 7. Execution Rules

1. Refresh evidence before changing behavior.
   - Re-run the current screenshot capture flow for Builder, Library, Community,
     History, and not-found before code edits so the team can separate stale
     collateral from live regressions.
   - Keep `docs/builder-workflow-reference.md` as the canonical vocabulary
     source during the refresh.
2. Land changes in risk order.
   - First fix layout overlap and action hierarchy in Builder mobile.
   - Then simplify empty/discovery routes.
   - Then normalize docs and screenshot drift.
   - Finish with brand-template cleanup and utility-route polish.
3. Keep route changes paired with tests.
   - Any Builder mobile change must update
     `src/test/index-mobile-layout.test.tsx` and `playwright/builder.mobile.spec.ts`.
   - Any Community mobile change must update
     `src/test/community-mobile-ux.test.tsx` and `playwright/community.mobile.spec.ts`.
   - Any shared shell or hero change must rerun accessibility and route-level
     screenshot checks.
4. Prefer tokenized/shared layout constants over repeated route math.
   - The current mobile nav height is repeated as `4.375rem` in
     `src/components/PageShell.tsx` and `src/pages/Index.tsx`.
   - Replace that duplication before tuning Builder spacing further.

## 8. Workstreams

### Workstream A: H1 Mobile Builder chrome crowds the primary workflow

Primary files:

- `src/pages/Index.tsx`
- `src/components/PageShell.tsx`
- `src/components/BottomNav.tsx`
- `src/components/MobileEnhancementSettingsSheet.tsx`
- `src/styles/promptforge-fantasy.css`
- `src/test/index-mobile-layout.test.tsx`
- `playwright/builder.mobile.spec.ts`

Goal:
Preserve authoring space on `390x844` and adjacent widths while keeping the
mobile Builder actions reachable and non-overlapping.

Implementation steps:

1. Capture the current mobile layout baseline.
   - Run `playwright/builder.mobile.spec.ts` and save the generated baseline
     JSON and screenshots.
   - Note current sticky-bar height, overlap, and control sizes for `320`,
     `375`, `390`, and `428`.
2. Centralize the mobile bottom-nav height contract.
   - Introduce one shared CSS custom property or shared constant for mobile nav
     occupied height.
   - Replace the duplicated `4.375rem` offset in `src/components/PageShell.tsx`
     and `src/pages/Index.tsx`.
   - Update `src/test/index-mobile-layout.test.tsx` so it stops asserting the
     literal duplicated class string and instead asserts the new shared contract.
3. Collapse the sticky Builder into a calmer default state.
   - In `src/pages/Index.tsx`, reduce the default sticky bar to one primary row:
     readiness chip, primary enhance CTA, and one compact secondary trigger.
   - Move preview/settings into a compact switcher, segmented trigger, or one
     disclosure action instead of two always-visible controls in a second row.
   - Keep preview and settings reachable in one tap, but do not reserve
     permanent vertical space for both when neither is open.
4. Make sticky-bar spacing resilient to bottom navigation.
   - Reserve enough bottom padding on the page content so cards and actions
     never sit visually behind the sticky bar or mobile nav.
   - Ensure the Builder spacer at the end of the route is derived from the same
     shared offset math as the sticky bar and shell padding.
5. Keep settings in the sheet, not the sticky rail.
   - Review `src/components/MobileEnhancementSettingsSheet.tsx` and move any
     non-primary controls that are still mirrored in the sticky band fully into
     the sheet.
   - Preserve Codex session access from the settings sheet so reducing sticky
     chrome does not remove signed-in utility paths.
6. Recheck touch targets and compression behavior.
   - Ensure the remaining sticky controls stay at least `44x44`.
   - Verify there is no horizontal overflow and the sticky bar stays within the
     compact-height threshold already enforced by Playwright.

Validation:

- `npm test -- src/test/index-mobile-layout.test.tsx`
- `npm test -- src/test/index-redesign-phase1.test.tsx`
- `npx playwright test playwright/builder.mobile.spec.ts`

Exit criteria:

- No sticky bar overlap with bottom nav at `320`, `375`, `390`, and `428`.
- The primary CTA, the active input, and the next refinement action remain
  visible without content hiding behind fixed chrome.

### Workstream B: H2 Library empty states overexpose management UI before any content exists

Primary files:

- `src/pages/Library.tsx`
- `src/test/library-featured-layout.test.tsx`
- `src/test/library-inline-bulk-actions.test.tsx`
- `src/test/accessibility-axe.test.tsx`

Goal:
Turn the zero-state Library into a recovery route instead of a management table.

Implementation steps:

1. Split Library rendering into zero-state and populated-state branches.
   - In `src/pages/Library.tsx`, gate the search/filter/sort/selection toolbar
     behind `templateSummaries.length > 0`.
   - Keep the current toolbar and bulk actions intact for non-empty states.
2. Simplify the zero-state header stack.
   - Keep the top “Quality + context + remix” explainer card only if it adds new
     information beyond the empty-state card.
   - If it duplicates the main recovery CTA, merge that guidance into the
     zero-state card and remove the duplicate button.
3. Promote one primary recovery action.
   - Keep one clear CTA to return to Builder.
   - Optionally add a lightweight secondary CTA for Presets only if it reduces
     first-run friction without recreating decision overload.
4. Preserve selection and filter affordances for populated states only.
   - Ensure `selectedCount`, `showSelectedOnly`, and related bulk actions are
     not rendered when there is nothing to select.
   - Keep the “no prompts match this filter” state separate from the first-run
     empty state.
5. Re-run empty-state copy against route intent.
   - Confirm the empty-state text still reflects the current Builder vocabulary:
     `Enhance prompt`, not older terminology.

Validation:

- `npm test -- src/test/library-featured-layout.test.tsx`
- `npm test -- src/test/library-inline-bulk-actions.test.tsx`
- `npm test -- src/test/accessibility-axe.test.tsx`

Exit criteria:

- On an empty account, Library shows a single clear recovery path before any
  search, filter, or bulk-edit chrome.
- On a non-empty account, existing management affordances remain intact.

### Workstream C: H3 Mobile Community discovery is too dense for fast scan-and-remix behavior

Primary files:

- `src/pages/Community.tsx`
- `src/components/community/CommunityPostCard.tsx`
- `src/components/community/CommunityFeed.tsx`
- `src/components/community/CommunityPostDetail.tsx`
- `src/test/community-mobile-ux.test.tsx`
- `playwright/community.mobile.spec.ts`

Goal:
Reduce scan friction on mobile feed and detail views while keeping remix as the
dominant conversion action.

Implementation steps:

1. Simplify the top-of-feed mobile controls.
   - In `src/pages/Community.tsx`, keep the full-width search field.
   - Reduce the mobile filter trigger to one concise control with a short,
     single-line selected-state summary.
   - Keep sort options reachable, but consider collapsing the four-button sort
     matrix behind the same drawer on sub-`sm` widths if the current toolbar
     still crowds the first card.
2. Reduce metadata weight inside feed cards.
   - In `src/components/community/CommunityPostCard.tsx`, audit which counters
     and chips are visible before entry to detail.
   - Demote low-priority metrics or move them to detail if they are not needed
     to decide whether to remix.
3. Keep `Remix` visually dominant.
   - Ensure `Remix` remains the primary action in feed and detail.
   - Reduce visual competition from `Save`, overflow actions, or counters on
     mobile cards.
4. Tighten the detail-page engagement block.
   - In `src/components/community/CommunityPostDetail.tsx`, compress the
     engagement row so comment, rating, and remix metadata do not create a long
     secondary wall below the prompt.
   - Keep the comment-sheet trigger and rating controls reachable without
     spreading every engagement primitive across the full card width.
5. Recheck bottom-nav interference.
   - Validate the last actionable control on feed cards and detail cards stays
     visible above mobile navigation.
   - If needed, add route-specific bottom padding rather than letting cards end
     flush against fixed chrome.

Validation:

- `npm test -- src/test/community-mobile-ux.test.tsx`
- `npm test -- src/test/community-tag-filter-state.test.tsx`
- `npm test -- src/test/community-search-focus.test.tsx`
- `npx playwright test playwright/community.mobile.spec.ts`

Exit criteria:

- The first feed card reads as search -> decide -> remix, not search -> decode
  filters -> decode metrics -> maybe act.
- Mobile detail keeps the primary remix/comment path visible before the lower
  card edge becomes crowded.

### Workstream D: M1 Builder evidence and vocabulary drift weaken product and review alignment

Primary files:

- `docs/builder-workflow-reference.md`
- `docs/design-ux-review-prompt.md`
- `docs/launch-assets-pack.md`
- `output/playwright/current-builder-desktop-2026-03-13.png`
- `output/playwright/current-builder-mobile-390-2026-03-13.png`
- screenshot capture scripts/specs used to generate Builder artifacts

Goal:
Make Builder docs, screenshots, and current route vocabulary describe the same
product state.

Implementation steps:

1. Decide whether the drift is product or collateral.
   - Compare the live `/` route against the current review screenshots.
   - If the live UI still shows `Run quality pass`, treat this as a product
     naming regression.
   - If the live UI matches `Enhance prompt`, treat this as stale screenshot
     collateral and refresh artifacts only.
2. Normalize Builder vocabulary in code if needed.
   - Search `src/pages/Index.tsx`, `src/components/OutputPanel.tsx`,
     `src/components/BuilderHeroInput.tsx`, and related helper files for older
     labels.
   - Keep `Enhance prompt`, `Builder readiness`, `Prompt details`,
     `Context and sources`, `Enhancement settings`, and `Draft actions` as the
     allowed current labels.
3. Refresh the Builder screenshot pack from one deterministic state.
   - Re-generate desktop and mobile builder screenshots from the same seed data,
     viewport, and route state used for the current design review.
   - Replace or archive stale `current-builder-*` artifacts so “current” means
     one thing.
4. Reconcile docs after screenshot refresh.
   - Update any lingering doc or launch references that still imply older
     terminology or section names.
   - Keep historical screenshots explicitly marked as historical only.
5. Add a lightweight doc-asset sanity check.
   - If feasible, extend the screenshot generation workflow or docs freshness
     process so `current-builder-*` cannot drift silently from the canonical
     workflow reference.

Validation:

- `npm run check:docs`
- Targeted Builder screenshot generation command or Playwright capture flow
- Optional targeted Builder smoke run if code labels changed

Exit criteria:

- The live Builder, workflow docs, and current artifact set all use the same
  labels and section names.

### Workstream E: M2 The populated Builder state reintroduces too many small competing controls

Primary files:

- `src/components/BuilderHeroInput.tsx`
- `src/pages/Index.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/MobileEnhancementSettingsSheet.tsx`
- `src/test/index-enhance-controls.test.tsx`
- `src/test/index-ux-friction-improvements.test.tsx`
- `src/test/index-redesign-phase1.test.tsx`

Goal:
Keep the filled Builder aligned with the staged-disclosure model that already
works in the empty state.

Implementation steps:

1. Reduce pre-run control noise in the hero card.
   - In `src/components/BuilderHeroInput.tsx`, keep `Draft actions` collapsed by
     default and avoid placing destructive/reset options at the same visual
     weight as prompt authoring.
   - Limit visible suggestion chips to one row or one prioritized subset with a
     secondary “show more” affordance if needed.
2. Keep advanced authoring controls hidden until requested.
   - In `src/pages/Index.tsx`, preserve the existing `Show advanced controls`
     gate and prevent populated-draft state from auto-expanding extra controls
     unless the user has already opted in.
   - Review whether any populated-state branches force secondary cards to appear
     too early.
3. Consolidate enhancement preferences.
   - Move low-frequency enhancement tuning out of the always-visible desktop
     action rail where possible.
   - Keep one summary card and one edit entry point rather than multiple
     parallel segmented-control groups.
4. Rebalance desktop right rail.
   - In `src/components/OutputPanel.tsx`, ensure readiness, preview, settings
     summary, and session/history modules read as a hierarchy rather than four
     equally weighted panels.
   - Demote explanatory copy and metadata that does not affect the next action.
5. Recheck mobile parity.
   - Ensure any desktop simplification has a mobile equivalent in
     `src/components/MobileEnhancementSettingsSheet.tsx` so the two modes do not
     drift again.

Validation:

- `npm test -- src/test/index-enhance-controls.test.tsx`
- `npm test -- src/test/index-ux-friction-improvements.test.tsx`
- `npm test -- src/test/index-redesign-phase1.test.tsx`
- `npx playwright test playwright/builder.desktop.spec.ts playwright/builder.mobile.spec.ts`

Exit criteria:

- After entering a draft, Builder still presents one obvious next action and no
  more than one visible layer of optional refinement controls.

### Workstream F: M3 Hero system is visually coherent but structurally inconsistent across routes

Primary files:

- `src/components/PageShell.tsx`
- `src/styles/components.css`
- `src/styles/promptforge-fantasy.css`
- route files using `PageHero`
- Builder hero implementation in `src/pages/Index.tsx` and `src/components/BuilderHeroInput.tsx`
- `src/test/accessibility-axe.test.tsx`

Goal:
Define a small, explicit hero system so route headers feel like one product.

Implementation steps:

1. Inventory current hero variants.
   - Compare Builder, Library, Community, History, and not-found.
   - Note where the in-hero wordmark is present, where eyebrow copy appears,
     and which title/subtitle widths differ.
2. Define three supported hero patterns.
   - Builder hero: dedicated conversion-focused hero.
   - Collection hero: Library, Community, History, Presets-style route header.
   - Utility hero/state: not-found and other low-complexity routes.
3. Encode those patterns in shared components.
   - Extend `PageHero` or add controlled variants rather than letting each route
     ad-lib composition.
   - Decide once whether the wordmark always appears in collection heroes or
     only on selected routes.
4. Align typography and spacing tokens.
   - Standardize headline size, subtitle max width, and top/bottom padding for
     each hero class in shared CSS rather than route-local overrides.
5. Re-run route accessibility and screenshots.
   - Ensure heading structure stays correct and the new shared hero does not
     regress visual contrast or spacing on mobile.

Validation:

- `npm test -- src/test/accessibility-axe.test.tsx`
- `npm test -- src/test/community-routes-accessibility-axe.test.tsx`
- targeted screenshot capture for affected routes

Exit criteria:

- Each route hero can be described as one of the documented supported patterns
  without route-specific exceptions.

### Workstream G: M4 Community participation controls are visually weaker than content chrome

Primary files:

- `src/components/community/CommunityPostDetail.tsx`
- `src/components/community/CommunityComments.tsx`
- `src/components/community/CommunityPostCard.tsx`
- `src/test/community-mobile-ux.test.tsx`
- `playwright/community.mobile.spec.ts`

Goal:
Make participation easier to notice and complete than passive reading.

Implementation steps:

1. Pick one primary action per view.
   - Feed card: `Remix`.
   - Detail page before comment interaction: `Remix`.
   - Detail page after entering conversation intent: `Comments`/composer.
2. Tighten the engagement cluster.
   - In `src/components/community/CommunityPostDetail.tsx`, group vote, comment,
     remix count, and rating summary into a more compact hierarchy.
   - Keep badges/counters visually subordinate to the action that changes state.
3. Strengthen the comment path.
   - Review `src/components/community/CommunityComments.tsx` so the composer and
     submit action are visually stronger once comments are in view.
   - Avoid letting helper labels consume more prominence than the input or
     submit control.
4. Rebalance remix list prominence.
   - Keep remixes visible, but avoid letting the remix index compete with the
     main participation actions above it.
   - Consider collapsing or visually softening this section until the user
     reaches it intentionally.

Validation:

- `npm test -- src/test/community-mobile-ux.test.tsx`
- `npm test -- src/test/community-comments.test.tsx`
- `npx playwright test playwright/community.mobile.spec.ts`

Exit criteria:

- On detail view, the next interactive step is always clearer than the metadata
  surrounding it.

### Workstream H: L1 Utility recovery screens are clear but could do more to preserve momentum

Primary files:

- `src/pages/History.tsx`
- `src/pages/NotFound.tsx`
- shared route shell/hero primitives if text treatment changes
- `src/test/history-page-restore.test.tsx`
- `src/test/accessibility-axe.test.tsx`

Goal:
Preserve the existing clarity of History and not-found while making the next
step more concrete.

Implementation steps:

1. Keep the current minimal layout intact.
   - Do not expand these routes into full dashboard pages.
2. Add one context-aware next step per route.
   - History: add supporting copy pointing to saving a version in Builder or a
     shortcut to Presets if that is the lowest-friction next move.
   - Not-found: keep `Back to Builder`, but consider one secondary route based
     on the most likely recovery target.
3. Recheck copy hierarchy and button order.
   - Keep one primary CTA and one quieter secondary action.
   - Avoid introducing equal-weight buttons that create indecision.
4. Verify heading semantics and route focus order still pass axe.

Validation:

- `npm test -- src/test/history-page-restore.test.tsx`
- `npm test -- src/test/accessibility-axe.test.tsx`

Exit criteria:

- These routes remain visually calm but no longer leave the user to infer the
  next step alone.

## 9. Recommended Delivery Sequence

### Phase 1: Guardrails and Builder mobile

1. Refresh current screenshots and baseline metrics.
2. Land Workstream A.
3. Land Workstream D only insofar as it is needed to tell live regressions from
   stale collateral.

### Phase 2: First-run route clarity

1. Land Workstream B.
2. Land Workstream E.
3. Re-capture Builder and Library screenshots.

### Phase 3: Community mobile and participation

1. Land Workstream C.
2. Land Workstream G.
3. Re-capture Community feed and detail screenshots.

### Phase 4: System cleanup

1. Land Workstream F.
2. Land Workstream H.
3. Finalize docs and screenshot pack.

## 10. Final Verification Checklist

1. Run `npm run check:docs`.
2. Run `npm test -- src/test/index-mobile-layout.test.tsx src/test/index-redesign-phase1.test.tsx src/test/index-enhance-controls.test.tsx src/test/index-ux-friction-improvements.test.tsx`.
3. Run `npm test -- src/test/library-featured-layout.test.tsx src/test/library-inline-bulk-actions.test.tsx`.
4. Run `npm test -- src/test/community-mobile-ux.test.tsx src/test/community-tag-filter-state.test.tsx src/test/community-comments.test.tsx src/test/community-search-focus.test.tsx`.
5. Run `npm test -- src/test/accessibility-axe.test.tsx src/test/community-routes-accessibility-axe.test.tsx src/test/history-page-restore.test.tsx`.
6. Run `npx playwright test playwright/builder.mobile.spec.ts playwright/community.mobile.spec.ts`.
7. Refresh the review screenshots under `output/playwright/design-ux-review-2026-03-13/`.
8. Confirm all refreshed Builder artifacts use the same vocabulary as
   `docs/builder-workflow-reference.md`.
