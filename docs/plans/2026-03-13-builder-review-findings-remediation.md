# Builder Review Findings Remediation Plan

**Date:** 2026-03-13
**Status:** Draft
**Source:** 2026-03-13 evidence-based UX and design-system review of the
current builder route, grounded in the live `/` surface, current source, and
current desktop/mobile screenshots.

## Goal

Address the current builder review findings without regressing the workflow,
mobile, stale-preview, telemetry, or session-management fixes completed during
the March 8-12 remediation passes.

This plan addresses the following current gaps:

1. Workflow language is inconsistent across builder, preview, and enhancement
   surfaces.
2. The desktop pre-run review rail is too dense and weakens action hierarchy.
3. Draft-state feedback is repeated across multiple adjacent surfaces.
4. Prompt-shaping controls and AI-run settings are only partly differentiated.
5. Reset and recovery actions are too prominent relative to authoring actions.
6. Mobile preserves space well, but key state and configuration meaning is too
   drawer-dependent.
7. The builder still emits accessibility-label warnings and carries design-
   system drift in naming and class composition patterns.
8. Current docs and screenshot artifacts drift from the shipped builder UI.
9. The live route degrades noisily when `infer-builder-fields` is unavailable,
   which undermines trust during the first-run authoring flow.

## Desired Outcome

After this pass:

- the builder uses one canonical vocabulary for draft, enhancement, and review
  actions;
- the desktop pre-run experience reads as `write -> review draft -> enhance`
  instead of as a dense audit column;
- draft-state messaging is compact, non-repetitive, and still accessible;
- prompt-shaping controls, context controls, and enhancement controls are
  clearly separated by purpose;
- reset actions are available but visually subordinate;
- mobile users can understand current state and next action without opening
  multiple drawers;
- builder surfaces no longer emit runtime accessibility warnings for unlabeled
  controls;
- the artifact and doc set matches the current builder instead of the retired
  light-theme / older-IA versions;
- inference-service outages degrade to one clear recoverable message instead of
  repeated noisy failures.

## Guardrails

Do not regress the completed work documented in:

- `docs/plans/2026-03-12-prompt-builder-enhancer-workflow-remediation.md`
- `docs/plans/2026-03-12-prompt-enhancer-in-progress-ui-remediation.md`
- `docs/plans/2026-03-12-output-panel-review-state-regressions-remediation.md`
- `docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md`
- `docs/plans/2026-03-08-builder-ux-improvements-design.md`

The implementation must preserve these behaviors:

- stale enhancements fall back to the current draft instead of presenting old
  AI output as current truth;
- mobile sticky chrome stays compact and does not grow into a third persistent
  row;
- signed-in mobile users can still reach the Codex session drawer from the
  enhancement settings sheet;
- telemetry event names and measurement semantics stay stable unless analytics
  migration is explicitly planned;
- expert/power-user controls remain available through progressive disclosure;
- save/share/version flows remain available once a valid reviewable prompt is
  present.

## Source Of Truth For This Plan

Treat these artifacts as the current builder baseline:

- `output/playwright/current-builder-desktop-2026-03-13.png`
- `output/playwright/current-builder-mobile-390-2026-03-13.png`
- `output/playwright/builder-mobile-settings.png`
- `src/pages/Index.tsx`
- `src/components/BuilderHeroInput.tsx`
- `src/components/BuilderAdjustDetails.tsx`
- `src/components/BuilderSourcesAdvanced.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/MobileEnhancementSettingsSheet.tsx`

Treat these as historical references only until refreshed:

- `screenshots/desktop/home.png`
- `screenshots/launch-sprint/builder-desktop.png`
- `screenshots/launch-sprint/builder-mobile-390.png`

## Recommended Implementation Order

Implement in this order:

1. Freeze the current baseline and regression contracts.
2. Normalize builder vocabulary and score semantics.
3. Rebalance desktop pre-run hierarchy and compress draft-state messaging.
4. Clarify control architecture and demote reset/recovery actions.
5. Improve mobile glanceability without growing persistent chrome.
6. Fix accessibility-label issues and design-system drift.
7. Improve degraded inference-service handling and refresh docs/screenshots.
8. Re-run the full regression matrix and merge in scoped PRs.

This order keeps clarity and trust on the critical path before stylistic or
documentation cleanup.

---

## Workstream 0: Freeze The Baseline And Regression Contracts

**Findings covered:** All findings

**Files:**
- Modify: `src/test/index-ux-friction-improvements.test.tsx`
- Modify: `src/test/index-mobile-layout.test.tsx`
- Modify: `src/test/output-panel-phase2.test.tsx`
- Modify: `src/test/output-panel-enhance-metadata.test.tsx`
- Modify: `src/test/output-panel-workflow.test.tsx`
- Modify: `src/test/phase2-accessibility-validation.test.tsx`
- Modify: `playwright/builder.desktop.spec.ts`
- Modify: `playwright/builder.mobile.spec.ts`
- Modify if needed: `playwright/typography.spec.ts`
- Add if needed: targeted builder copy/state tests in `src/test/`

### Step 1: Capture the current visible contract before rearranging UI

Add or extend tests so they assert the current builder concepts that must
survive refactors:

- `Builder readiness` exists as the pre-run builder score surface;
- the output panel has distinct `empty`, `draft`, `enhancing`, `ready`, and
  `stale` review states;
- mobile exposes the preview and enhancement settings through the sticky bar
  and drawers, not through a desktop-like persistent rail.

Do not rely on screenshots alone. Use visible copy, `data-testid`s, and DOM
order assertions.

### Step 2: Add explicit vocabulary assertions

Before changing copy, add failing or pending tests that prove the intended
canonical naming model:

- one primary AI action label;
- one draft preview label;
- one enhancement settings label;
- distinct labels for builder-readiness vs enhancer assessment.

Place these assertions in:

- `src/test/index-ux-friction-improvements.test.tsx`
- `src/test/output-panel-phase2.test.tsx`
- `playwright/builder.desktop.spec.ts`
- `playwright/builder.mobile.spec.ts`

### Step 3: Add pre-run hierarchy coverage

Extend desktop coverage so it verifies:

- pre-run rail ordering;
- absence of action wrapping at common laptop widths;
- no duplicated draft-state surfaces above the preview;
- one obvious primary CTA in the pre-run state.

Use `1280x900` and `1440x900` viewports.

### Step 4: Add mobile state-summary coverage

Extend mobile coverage so it verifies:

- sticky bar remains compact at `320`, `375`, `390`, and `428`;
- preview trigger text reflects current review state;
- settings sheet summary reflects the current enhancement mode;
- no overlap between sticky chrome and bottom navigation.

### Step 5: Add degraded-service coverage

Add a targeted test for suggestion/inference failure:

- service unavailable or refused;
- one clear non-blocking UI message is shown;
- suggestions container does not thrash or duplicate alerts;
- authoring remains usable.

Prefer a focused RTL test over only relying on manual QA.

### Definition of done

- The current review findings are represented in tests before major UI changes.
- Desktop and mobile both have explicit regression guards for hierarchy and
  state-label semantics.

---

## Workstream 1: Normalize Vocabulary And Score Semantics

**Findings covered:**
- Workflow language inconsistency
- Score-semantics drift

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelStateBanner.tsx`
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify: `src/components/OutputPanelEnhanceControls.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify: `src/components/OutputPanelEnhancementSummary.tsx`
- Modify if needed: `src/lib/output-panel-review-state.ts`
- Modify if needed: `docs/launch-measurement-baseline.md`
- Modify if needed: `prompt-build-and-enhancement.md`

### Step 1: Choose and document the canonical nouns and verbs

Adopt one user-facing vocabulary set and use it everywhere:

- pre-run preview artifact: `Draft prompt`
- AI action: `Enhance prompt`
- AI settings surface: `Enhancement settings`
- pre-run score: `Builder readiness`
- post-run AI assessment: `Enhancer self-check`

Do not mix these with `Run quality pass`, `Prompt draft`, `Built prompt`,
`Preview`, or other alternate labels in the same state.

### Step 2: Replace mixed copy across desktop and mobile

Update all visible labels, helper copy, and keyboard hints so the same terms
appear on:

- the desktop primary CTA;
- the mobile sticky action;
- the preview trigger / dialog title;
- the state banner;
- the settings drawer summary;
- any lingering footer or hint text.

Keep telemetry event names unchanged unless a separate analytics migration is
approved.

### Step 3: Keep score meanings separate

Ensure the builder-side score and AI-side assessment never read like competing
global quality verdicts:

- `Builder readiness` should describe the current draft only;
- `Enhancer self-check` should describe the generated output only;
- stale states must not show an AI assessment as if it still applies to the
  live draft.

### Step 4: Align supporting docs

Update any product or measurement docs that still use mixed terminology so
engineers, QA, and reviewers are not referencing outdated names.

### Definition of done

- A user can describe what the draft score means and what the AI assessment
  means without guessing.
- Desktop and mobile use the same language for the same concept.

---

## Workstream 2: Rebalance Desktop Pre-Run Hierarchy

**Findings covered:**
- Desktop right-rail density
- Weak primary-action hierarchy

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify: `src/components/OutputPanelEnhanceControls.tsx`
- Modify if needed: `src/styles/components.css`

### Step 1: Define explicit desktop pre-run and post-run layouts

Do not keep one monolithic rail layout for every state.

Introduce or formalize two desktop review modes:

- `pre-run`
- `post-run`

In `pre-run`, optimize for comprehension and one next step. In `post-run`,
support deeper review, comparison, and provenance.

### Step 2: Trim the pre-run rail to the essentials

Before any enhancement result exists, keep the right rail focused on:

- compact `Builder readiness`
- compact `Draft prompt` preview
- primary action
- compact enhancement settings summary with an explicit edit affordance
- collapsed session/history support

Do not keep the full enhancement option groups always visible in the pre-run
state.

### Step 3: Move advanced AI-run controls behind progressive disclosure

Move full depth/strictness/ambiguity controls out of the always-visible rail
in the pre-run desktop state.

Acceptable patterns:

- inline expander
- popover
- drawer
- modal

Prefer a surface that preserves scanability without burying the controls for
expert users.

### Step 4: Reassess pre-run header actions

Before the first enhancement:

- keep `Copy draft` easy to find;
- decide whether `Save` and `More` should stay visible or move to a quieter
  position;
- do not let utility actions visually compete with the primary AI action.

### Step 5: Verify common laptop-height viewports

At `1280x900` and `1440x900`, confirm:

- the preview is visible without scrolling past multiple advisory cards;
- the primary action is obvious;
- the rail does not feel like a tower of stacked micro-panels.

### Definition of done

- The pre-run desktop experience reads as one coherent path instead of a dense
  side console.

---

## Workstream 3: Compress Draft-State Messaging

**Findings covered:**
- Draft-state feedback duplication

**Files:**
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelStateBanner.tsx`
- Modify: `src/lib/output-panel-review-state.ts`

### Step 1: Give each review state one visible explanation surface

For each review state (`empty`, `draft`, `enhancing`, `ready`, `stale`),
decide which surface owns the explanation:

- state banner
- preview card header
- inline helper text

Do not duplicate the same state meaning across all three.

### Step 2: Simplify the draft state specifically

In the current draft state, reduce repeated messages such as:

- `Draft preview`
- `The visible text comes from the current builder inputs.`
- `Source: Prompt draft`
- `Next: ...`

Keep enough context to preserve trust, but compress the visible wording to one
primary explanation plus one compact source/state label.

### Step 3: Preserve accessibility semantics

Even if visible copy becomes shorter, keep a clear assistive status message via
`aria-live` or the existing assistive-state contract so screen-reader users
still receive the full meaning.

### Step 4: Keep stale and transient states stronger than draft

Do not over-compress `stale`, `enhancing`, or `settling` states. Those states
carry more trust risk than the draft state and should remain more explicit.

### Definition of done

- The draft state is understandable in one glance.
- The rail regains vertical space without losing state clarity.

---

## Workstream 4: Clarify Control Architecture

**Findings covered:**
- Unclear split between prompt-shaping, context, and AI-run settings

**Files:**
- Modify: `src/components/BuilderAdjustDetails.tsx`
- Modify: `src/components/BuilderSourcesAdvanced.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify: `src/pages/Index.tsx`
- Modify if needed: `src/components/BuilderHeroInput.tsx`

### Step 1: Rename authoring sections by purpose

Rename left-column controls so their purpose is obvious:

- `Adjust details` -> `Prompt details` or `Shape the prompt`
- `Add sources or advanced settings` -> `Context and sources`

Prefer labels that describe user intent rather than control mechanics.

### Step 2: Separate context from integrations

Inside the context section, keep simple references and project notes at the
top, and move database/RAG/integration controls under a nested `Advanced
integrations` disclosure.

This prevents sources/context from reading like the same category as technical
plumbing.

### Step 3: Keep AI-run settings in one dedicated place

Remove or reduce any left-column surface that looks like a second home for
enhancement settings unless it directly edits those settings.

Users should not have to infer that:

- some controls shape the prompt itself;
- some controls affect the next AI run only;
- some cards are only reset affordances.

### Step 4: Add helper copy that explains the split

Authoring surfaces should explain that they change the draft prompt.

Enhancement settings should explain that they change the next rewrite request,
not the draft content directly.

### Step 5: Keep the same grouping model on mobile

Mobile may use drawers instead of persistent columns, but the conceptual
grouping should match desktop:

- prompt details
- context and sources
- enhancement settings

### Definition of done

- A user can predict what a control changes before interacting with it.

---

## Workstream 5: Demote Reset And Recovery Actions

**Findings covered:**
- Reset actions are too prominent early in the flow

**Files:**
- Modify: `src/components/BuilderHeroInput.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify if needed: `src/components/OutputPanelHeader.tsx`

### Step 1: Only show global reset affordances when they matter

Gate `Reset all settings` on actual dirty state versus defaults.

If nothing meaningful is customized yet, do not reserve prime visual space for
resetting the builder.

### Step 2: Lower the visual weight of recovery actions

Keep `Clear prompt` and related resets as tertiary or overflow-level actions.
They should remain accessible but should not out-rank authoring and review
actions in the visual hierarchy.

### Step 3: Move enhancement-preference reset out of the primary authoring path

`Reset enhancement preferences` should live inside the enhancement settings
surface or a quieter overflow area, not as a persistent peer to composition
controls.

### Step 4: Provide lightweight undo where feasible

For broad resets, prefer a toast with undo over a heavy blocking confirm flow,
as long as the action remains reversible and testable.

### Definition of done

- Recovery controls are available, but they do not compete with productive next
  steps in the initial builder path.

---

## Workstream 6: Improve Mobile Glanceability

**Findings covered:**
- Mobile state comprehension is too drawer-dependent

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: `src/styles/components.css`

### Step 1: Preserve the compact two-row sticky model

Do not add:

- a third persistent sticky row;
- a second persistent session button;
- long helper paragraphs in sticky chrome.

### Step 2: Make the preview trigger carry state meaning

The preview trigger should communicate current state, not just destination.

Examples:

- `Draft prompt`
- `Enhanced prompt`
- `Stale result`

Use compact copy that fits the existing sticky-bar constraints.

### Step 3: Make the settings trigger summarize current AI-run mode better

Without opening the drawer, the user should be able to infer the current run
profile from the sticky affordance or from a concise summary nearby.

Do not rely on users opening the drawer just to confirm whether the current
mode is `Light polish`, `Structured rewrite`, or `Expert prompt`.

### Step 4: Keep detailed explanatory copy inside drawers

Longer trust or helper text should remain inside:

- the preview drawer;
- the settings drawer;
- the Codex session drawer

not in persistent sticky chrome.

### Step 5: Re-verify ergonomic behavior with keyboard and long content

Validate:

- prompt textarea with long content;
- bottom navigation present;
- software keyboard open;
- preview/settings drawers opened and closed repeatedly.

### Definition of done

- Mobile users can understand current state and next action with minimal taps.
- Sticky chrome remains compact and non-overlapping.

---

## Workstream 7: Fix Accessibility And Design-System Drift

**Findings covered:**
- Accessibility-label warnings
- Design-system helper/naming drift

**Files:**
- Modify: `src/components/BuilderHeroInput.tsx`
- Modify: `src/components/BuilderAdjustDetails.tsx`
- Modify: `src/components/BuilderSourcesAdvanced.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: builder primitives in `src/components/base/`
- Modify: `src/test/accessibility-axe.test.tsx`
- Modify: `src/test/phase2-accessibility-validation.test.tsx`
- Modify if needed: related stories

### Step 1: Reproduce the warnings deterministically

Use the current builder route and tests to isolate which controls are emitting
the repeated `react-aria-components` warnings about missing labels.

Prioritize:

- switches
- comboboxes
- custom trigger buttons
- mobile drawers

### Step 2: Fix labeling at the primitive boundary where possible

Prefer solving missing labels in shared wrappers or trigger patterns rather
than patching every individual caller if the same defect repeats across
surfaces.

### Step 3: Expand accessibility regression coverage

Add or extend coverage for:

- desktop builder default state;
- advanced controls open;
- mobile settings drawer;
- mobile preview drawer.

Ensure these states stay green in axe and do not emit runtime label warnings.

### Step 4: Remove semantic naming drift in code

Replace stage-oriented names such as `phase2Enabled` and `phase3Enabled` with
semantic names that describe actual behavior, not historical rollout phases.

### Step 5: Align builder components with current DS helper usage

Where builder components still assemble complex class strings manually, prefer
the repo's canonical helper (`cx`) for consistency and maintainability.

Do not do purely mechanical churn. Focus on the surfaces touched in this
remediation so helper alignment does not become a noisy refactor.

### Definition of done

- Builder surfaces no longer emit label warnings in normal interaction paths.
- Touched builder code follows current DS conventions and clearer naming.

---

## Workstream 8: Improve Degraded Inference Handling And Refresh Artifacts

**Findings covered:**
- Noisy inference-service degradation
- Screenshot/doc drift

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/lib/ai-client.ts`
- Modify if needed: `src/components/BuilderHeroInput.tsx`
- Modify: `docs/design-ux-review-prompt.md`
- Modify: `docs/launch-assets-pack.md`
- Modify: `docs/README.md`

### Step 1: Reduce repeated suggestion-failure noise

When `infer-builder-fields` is unavailable:

- show one clear non-blocking UI fallback message;
- avoid repeated noisy retries or duplicate alerts;
- keep builder authoring fully functional.

### Step 2: Ensure the fallback state is visually coherent

If smart suggestions are unavailable:

- do not leave an empty or twitchy container;
- do not let failure copy dominate the authoring area;
- keep the fallback near the textarea but clearly secondary.

### Step 3: Refresh screenshot references

Replace or archive outdated builder screenshots in docs that still point to the
retired light-theme or earlier IA version.

### Step 4: Refresh documentation references

Update review and launch docs so they reference the current builder artifacts,
current route behavior, and current terminology.

### Definition of done

- Service degradation is understandable and non-disruptive.
- Docs and screenshots describe the builder that actually ships.

---

## Workstream 9: Validation, PR Slicing, And Rollout

**Findings covered:** All findings

**Files:**
- Modify: `docs/README.md`
- Modify if needed: `prompt-build-and-enhancement.md`
- Modify if needed: launch and review docs touched above

### Step 1: Run focused tests first

Run a focused regression suite before broad repo gates:

```bash
npx vitest run \
  src/test/index-ux-friction-improvements.test.tsx \
  src/test/index-mobile-layout.test.tsx \
  src/test/output-panel-phase2.test.tsx \
  src/test/output-panel-enhance-metadata.test.tsx \
  src/test/output-panel-workflow.test.tsx \
  src/test/phase2-accessibility-validation.test.tsx \
  src/test/accessibility-axe.test.tsx
```

### Step 2: Run browser verification

Run:

```bash
PLAYWRIGHT_PORT=4273 CI=1 npx playwright test \
  playwright/builder.desktop.spec.ts \
  playwright/builder.mobile.spec.ts \
  playwright/typography.spec.ts
```

If port allocation differs locally, use the same alternate-port pattern already
used elsewhere in the repo.

### Step 3: Run repository gates

Run:

```bash
npm run lint
npm run build
npm run check:docs
```

Run `npm run check:design-system` if DS wrappers or primitives are touched.

### Step 4: Validate the critical manual flows

Manually verify:

1. empty builder
2. first typed prompt
3. advanced controls opened
4. pre-run desktop and mobile review states
5. successful enhancement result
6. stale enhancement after editing the builder
7. preset entry path
8. remix entry path
9. history restore entry path
10. signed-in mobile Codex session access
11. degraded suggestion-service behavior

### Step 5: Merge in scoped PRs

Use this PR order:

1. vocabulary and score semantics
2. desktop hierarchy and draft-state compression
3. control architecture and reset demotion
4. mobile glanceability
5. accessibility and DS hardening
6. degraded-service handling and artifact/docs refresh

Keep each PR narrowly scoped enough that layout or copy regressions are easy to
attribute.

### Definition of done

- The builder passes focused tests, browser checks, and docs validation.
- The shipped artifact set and terminology match the current implementation.

## Success Criteria

This plan is complete when:

- one canonical vocabulary set is visible across builder, preview, and
  enhancement surfaces;
- desktop pre-run review density is materially lower than the 2026-03-13
  baseline;
- draft-state copy no longer repeats the same explanation across multiple
  adjacent surfaces;
- mobile remains compact while exposing clearer state and settings summaries;
- builder accessibility warnings are removed from normal interaction flows;
- current builder screenshots and docs no longer point to the retired builder
  layout.
