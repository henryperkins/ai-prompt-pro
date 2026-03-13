# Prompt Enhancer In-Progress UI Remediation Plan

**Date:** 2026-03-12
**Status:** Completed
**Completed:** 2026-03-12
**Source:** Screenshot-driven review of the current prompt enhancer while an
enhancement is in progress, cross-checked against the shipped implementation in
`src/components/OutputPanel.tsx` and `src/pages/Index.tsx`

## Goal

Make the enhancer easier to trust and faster to review while preserving the
March 10-12 workflow fixes that already closed important regressions around
mobile parity, stale-preview drift, session gating, and telemetry access.

This plan addresses the current UI/workflow issues visible during an active or
recent enhancement run:

1. The main prompt artifact is buried under workflow/analysis surfaces.
2. Source/status/stale state is too subtle for a trust-sensitive review loop.
3. The desktop output rail becomes a tall audit column with poor visual
   balance.
4. Header actions are too busy during transient run states.
5. Builder score and AI-reported score compete instead of clarifying distinct
   meanings.

## Outcome

This remediation pass is complete.

- The output panel now follows a preview-first review loop: trust-state banner,
  preview frame, review actions, then supporting disclosures for progress,
  enhancer findings, inspector content, and sources.
- Header actions are phase-aware: compare and feedback only appear for settled
  enhanced output, while `Save` and `More` stay disabled during transient
  phases.
- Clarification questions stay visible near the preview as a compact trust note
  while the full AI findings remain available in the lower disclosure stack.
- Desktop rail density dropped by renaming the draft metric to
  `Builder readiness` and removing the separate `Next best action` and
  `Recent web sources` cards.

## Verification

Validated on 2026-03-12 with:

- `npx vitest run src/test/output-panel-phase2.test.tsx src/test/output-panel-workflow.test.tsx src/test/output-panel-enhance-metadata.test.tsx src/test/web-search-activity-indicator.test.tsx src/test/index-mobile-layout.test.tsx src/test/index-ux-friction-improvements.test.tsx src/test/phase2-accessibility-validation.test.tsx`
- `PLAYWRIGHT_PORT=4273 CI=1 npx playwright test playwright/builder.mobile.spec.ts playwright/builder.desktop.spec.ts`
- `npm run lint`
- `npm run build`
- `npm run check:docs`

## Guardrails

Do not regress the completed work documented in:

- `docs/plans/2026-03-12-prompt-builder-enhancer-workflow-remediation.md`
- `docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md`

The implementation must preserve these behaviors:

- signed-in mobile users can open the Codex session drawer from the settings
  sheet;
- stale enhancements fall back to the current draft instead of showing outdated
  AI output as current truth;
- guest users cannot append hidden context into the Codex session;
- developer/operator telemetry exports remain discoverable under `More` ->
  `Developer tools`;
- mobile sticky chrome stays compact and does not regain the older vertical
  density problem.

## Findings Covered

### Finding 1: Preview hierarchy is backward

The current `OutputPanel` shows reasoning, workflow, clarification UI, stale
messages, preview, metadata summaries, inspector content, and sources in one
stack. That makes the prompt itself feel like one section inside an analysis
console instead of the primary artifact under review.

### Finding 2: Trust state is under-signaled

`Source:` and run status are currently represented by small chips, and stale
output is explained by a muted card. That is not strong enough when users need
to know whether the visible text is:

- the current builder draft;
- a stale-but-preserved AI result;
- an actively streaming AI result; or
- the final settled enhancement.

### Finding 3: Desktop layout drifts into a tall side rail

The right column combines the builder quality card, output panel, session
summary, next-best-action card, web sources, history, and footer hint. The
result is a long dense rail that is hard to scan and visually disconnected from
the left builder surface.

### Finding 4: Actions are not phase-aware enough

`Show changes`, `Too much changed`, `Copy`, `Save`, and `More` appear together
near the top of the panel even while the run is still starting, streaming, or
settling. This makes low-confidence or secondary actions look equally primary.

### Finding 5: Quality terminology drifts

The desktop rail uses a builder score as a readiness signal, while the metadata
summary also shows an AI-reported score for the enhanced output. Both are
reasonable, but together they create metric competition and terminology drift
around what "quality" means.

## Recommended Implementation Order

Implement in this order:

1. Freeze new review-state contracts with focused tests before rearranging the
   UI.
2. Recompose the output panel around a preview-first review loop.
3. Add a strong unified state banner for source, status, and stale messaging.
4. Phase-gate header actions so the surface reflects run confidence.
5. Push workflow/provenance/inspector content behind progressive disclosure.
6. Clarify score semantics and rebalance desktop/mobile layout density.
7. Re-run focused regression coverage, capture fresh screenshots, and update
   docs.

This order keeps trust and correctness on the critical path before any visual
polish.

---

## Workstream 0: Freeze The Review-State Contracts With Tests

**Findings covered:** All findings

**Files:**
- Modify: `src/test/output-panel-phase2.test.tsx`
- Modify: `src/test/output-panel-workflow.test.tsx`
- Modify: `src/test/output-panel-enhance-metadata.test.tsx`
- Modify: `src/test/web-search-activity-indicator.test.tsx`
- Modify: `src/test/index-mobile-layout.test.tsx`
- Modify: `src/test/index-ux-friction-improvements.test.tsx`
- Modify: `playwright/builder.mobile.spec.ts`
- Add: `playwright/builder.desktop.spec.ts`

### Step 1: Add a preview-first DOM-order test

Extend `src/test/output-panel-phase2.test.tsx` so it proves the new desired
hierarchy:

1. render an enhanced state with workflow, reasoning summary, metadata, and
   sources present;
2. assert that the primary preview frame renders before the long-form
   supporting sections;
3. assert that only prompt-affecting controls stay adjacent to the preview;
4. assert that workflow/reasoning/provenance move into a collapsed or
   secondary details area.

Do not rely on snapshots alone. Query by visible headings, `data-testid`s, and
container order.

### Step 2: Add a state-banner matrix test

In the same file, add state coverage for:

1. no enhanced output yet;
2. enhancement starting;
3. enhancement streaming;
4. enhancement settling;
5. enhancement done;
6. stale enhancement after builder edits.

For each state, assert:

- the banner copy;
- the preview source label;
- whether metadata/variant controls are shown or suppressed;
- whether the rerun guidance is present.

### Step 3: Add action-gating tests by phase

Still in `src/test/output-panel-phase2.test.tsx`, add explicit expectations
for:

- `Show changes` hidden while starting/streaming/settling;
- `Too much changed` hidden unless the panel is showing a settled enhanced
  result;
- `Save` and `More` either hidden or disabled during transient phases;
- `Copy` retaining a phase-appropriate label such as `Copy draft` or
  `Copy current output`.

### Step 4: Add score-semantics tests

Extend `src/test/output-panel-enhance-metadata.test.tsx` and, if needed,
`src/test/index-ux-friction-improvements.test.tsx` to prove:

- the builder rail no longer uses the same "quality" language as the
  enhancement summary;
- the AI-reported score is visually/copy-wise framed as an enhancer assessment
  rather than a second global quality score;
- stale states suppress AI score surfaces when they no longer apply to the
  current draft.

### Step 5: Keep workflow and web-search coverage aligned

Update:

- `src/test/output-panel-workflow.test.tsx`
- `src/test/web-search-activity-indicator.test.tsx`

so they validate the new progressive-disclosure placement without weakening the
existing semantics:

- workflow steps still render correctly;
- live/captured labeling still works;
- web-search activity is still announced accessibly;
- hiding or collapsing these surfaces does not remove them from the DOM when
  their disclosure is opened.

### Step 6: Add runtime layout checks

Extend `playwright/builder.mobile.spec.ts` and add
`playwright/builder.desktop.spec.ts` to cover:

- mobile output drawer state clarity;
- mobile sticky bar remaining compact after copy/status changes;
- desktop output rail at `1280x900` and `1440x900`;
- no preview burying below long stacks of support cards;
- no action-row wrapping into visually broken states.

### Definition of done

- Every UX change in later workstreams is backed by at least one targeted
  regression assertion.
- Desktop and mobile layout changes have at least one runtime verification path.

---

## Workstream 1: Recompose The Panel Around A Preview-First Review Loop

**Finding addressed:** The prompt artifact is visually subordinated to process
surfaces.

**Files:**
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify: `src/components/OutputPanelEnhancementSummary.tsx`
- Modify if needed: `src/components/EnhancementClarificationCard.tsx`
- Add: `src/components/OutputPanelStateBanner.tsx`
- Add: `src/components/OutputPanelDetailsAccordion.tsx`

### Step 1: Define three surface layers

Refactor `OutputPanel` so it renders in this order:

1. `Review state`
   One prominent banner explaining what the user is looking at.
2. `Primary artifact`
   The preview frame and the controls that directly affect or copy the visible
   prompt.
3. `Supporting details`
   Workflow, reasoning, provenance, inspection, and longer-form analysis.

Do not leave the current single-stack ordering in place.

### Step 2: Move the preview frame directly under the state banner

In `src/components/OutputPanel.tsx`, render the preview card immediately after
the header/banner block.

Keep the preview dominant by:

- preserving the large scrollable frame;
- keeping it above workflow, reasoning, and sources;
- avoiding explanatory cards between the banner and the preview unless they are
  directly actionable on the prompt.

### Step 3: Keep direct prompt-affecting controls close to the preview

Treat these as first-class review controls:

- copy current preview;
- compare against builder draft when valid;
- variant switching when alternative versions exist;
- apply-to-builder or clarification actions that directly mutate the draft.

Keep them adjacent to the prompt. Do not bury them inside the lower details
accordion.

### Step 4: Compress clarification/open-question handling

If clarification questions are present:

1. show a compact summary card near the preview stating that the result still
   has unresolved questions;
2. keep the `Add to prompt` action visible;
3. move the full question list or extended explanation into the supporting
   details area unless the surface is explicitly in an ambiguity-first mode.

The goal is to keep trust messaging visible without turning the top of the
panel into a long checklist.

### Step 5: Move support surfaces into a secondary details zone

Below the preview, group the current long-form surfaces into one or more
collapsible sections such as:

- `Enhancement details`
- `How this was built`
- `Sources and provenance`

Move these into that zone:

- reasoning summary;
- workflow steps;
- web search activity/history;
- enhancement summary text blocks;
- structured inspector content;
- source links.

### Step 6: Mirror the same hierarchy in the mobile drawer

The mobile output drawer must use the same structure as desktop:

- review banner first;
- preview second;
- details disclosure after;
- settings summary/edit affordance preserved when the primary controls are
  hidden.

Do not let mobile drift back into a different information architecture.

### Definition of done

- Users can judge the visible prompt before they have to parse process detail.
- Supporting analysis remains available but no longer dominates the initial
  viewport.

---

## Workstream 2: Add A Strong Unified Trust-State Banner

**Finding addressed:** Source/status/stale state is too subtle.

**Files:**
- Add: `src/components/OutputPanelStateBanner.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify if needed: `src/components/output-panel-types.ts`

### Step 1: Replace scattered state chips with one explicit banner

Create a dedicated state banner component that combines:

- preview source;
- run status;
- stale state;
- next recommended action.

Do not rely on separate low-emphasis chips plus a distant muted stale card.

### Step 2: Define explicit copy for each run state

Use concrete user-facing copy for each case:

- `Draft preview`
  The visible text comes from the current builder fields.
- `Enhancing`
  The AI is actively rewriting the prompt. The visible output may still change.
- `Enhanced output ready`
  The run is complete and the visible text is the settled AI result.
- `Builder changed after enhancement`
  The preview has returned to the current draft. Re-run Enhance to refresh AI
  output.

The exact words can change, but the semantics cannot stay implicit.

### Step 3: Mirror visible state in assistive announcements

Update the `aria-live` messaging so the screen-reader status mirrors the same
high-confidence state phrasing used in the visible banner.

Avoid having one set of semantics for sighted users and another for assistive
technology.

### Step 4: Tie banner severity to trust implications

Use stronger visual treatment for states that affect trust:

- warning/attention treatment for stale draft fallback;
- active/info treatment for streaming;
- settled/success treatment for complete enhanced output.

Keep semantic color-token usage aligned with the design system.

### Step 5: Suppress stale-only-invalid surfaces

When the builder is stale relative to the last enhancement:

- hide or collapse AI score surfaces;
- hide `Too much changed`;
- hide alternative-version switches if they no longer correspond to the visible
  draft;
- keep only the rerun path and archived detail access if needed.

This prevents outdated AI artifacts from masquerading as current review state.

### Definition of done

- A user can tell, within one glance, what the visible prompt represents.
- Stale and in-progress states are impossible to confuse with settled output.

---

## Workstream 3: Make Header Actions Phase-Aware

**Finding addressed:** Header actions compete with one another during transient
run phases.

**Files:**
- Modify: `src/components/OutputPanelHeader.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: `src/components/OutputPanelSaveDialog.tsx`

### Step 1: Introduce an explicit action-availability model

Compute action availability from:

- `enhancePhase`
- `previewSource`
- `hasEnhancedOnce`
- stale state
- whether the displayed prompt differs from the builder prompt

Do not continue using only `hasCompare`, `hasEnhancedOnce`, and generic prompt
presence as the main gating rules.

### Step 2: Quiet the header while the run is in flight

During `starting`, `streaming`, and `settling`:

- hide `Show changes`;
- hide `Too much changed`;
- disable or demote save/share actions if they should not operate on partial
  output;
- keep only the actions that are safe and meaningful on transient content.

If `Copy` remains available, its label must reflect exactly what it copies.

### Step 3: Restore comparison and feedback only when confidence is high

After the run is settled and the preview is still showing enhanced output:

- re-enable `Show changes`;
- re-enable `Too much changed`;
- restore save/share actions;
- keep developer tools nested under `More` rather than expanding the top-row
  button count.

### Step 4: Keep pre-enhance and stale states explicit

Before the first enhancement:

- label copy as `Copy draft` or `Copy preview`;
- avoid feedback controls that imply AI output exists.

When stale:

- keep copy/save for the live draft if valid;
- suppress change-review actions that refer to the prior enhancement output.

### Step 5: Guard against action-row wrapping regressions

As part of the implementation, verify:

- no cramped multi-row action header on desktop at common widths;
- no icon/text collisions in mobile drawer mode;
- no hidden dropdown trigger caused by long state labels.

### Definition of done

- Action prominence now reflects output confidence and workflow relevance.
- The header no longer reads like a full control panel while the run is still
  in flux.

---

## Workstream 4: Push Workflow, Reasoning, And Provenance Behind Progressive Disclosure

**Findings addressed:** Preview burying and audit-column density

**Files:**
- Modify: `src/components/OutputPanelWorkflow.tsx`
- Modify: `src/components/WebSearchActivityIndicator.tsx`
- Modify: `src/components/OutputPanelEnhancementSummary.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify if needed: `src/components/EnhancementInspector.tsx`

### Step 1: Decide which surfaces stay immediately visible

Keep immediately visible only what is necessary to judge or act on the current
prompt:

- the review-state banner;
- the prompt preview;
- prompt-affecting controls;
- compact ambiguity or stale warnings.

Everything else should move into progressive disclosure by default.

### Step 2: Split supporting detail into review-friendly groups

Create groups with clear semantics:

- `Run progress`
  workflow steps and streaming/search activity;
- `What the enhancer found`
  detected intent, assumptions, missing parts, suggestions;
- `Sources and evidence`
  source links and provenance details;
- `Apply to builder`
  inspector actions and editable lists.

This is better than one uninterrupted stack of cards.

### Step 3: Keep live run details compact during enhancement

While enhancement is active:

- show a compact progress surface;
- keep long reasoning text collapsed by default;
- keep web-search activity in the run-progress group rather than as a detached
  standalone line.

The top of the panel should communicate motion, not expand vertically.

### Step 4: Preserve discoverability for power users

Do not remove the workflow, reasoning, or sources surfaces.

Instead:

- expose counts or summary labels on the disclosure triggers;
- remember open state only if it improves repeat-review usability;
- ensure keyboard and screen-reader access still reaches all content.

### Step 5: Make the inspector feel secondary until needed

The structured inspector is valuable, but it should not visually compete with
the preview on first load.

Move it under a dedicated disclosure with summary text such as:

- `Inspector: assumptions, gaps, and builder updates`

Only keep it expanded automatically if:

- the run surfaced ambiguity;
- the result is missing required parts; or
- the user explicitly reopens it.

### Definition of done

- Power-user detail survives.
- Default scan order is substantially shorter and more task-focused.

---

## Workstream 5: Clarify Score Semantics And Eliminate Metric-Language Drift

**Finding addressed:** Builder score and AI score compete conceptually.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanelEnhancementSummary.tsx`
- Modify if needed: `prompt-build-and-enhancement.md`
- Modify if needed: `docs/launch-measurement-baseline.md`

### Step 1: Rename the builder rail concept

Update the desktop rail copy so the builder-side score reads as a readiness
signal for the input draft, not a global quality verdict.

Preferred direction:

- `Builder quality signal` -> `Builder readiness`
- supporting copy should explain that this is based on the current builder
  inputs and structure, not AI judgment.

### Step 2: Rename or reframe the AI-reported score

In `OutputPanelEnhancementSummary`, avoid presenting the AI score as a second
competing top-level quality metric.

Preferred direction:

- `Enhanced quality (AI)` -> `Enhancer self-check` or `AI output assessment`
- explanation should state that it is limited to the generated output and is
  separate from builder readiness.

### Step 3: Avoid showing two equivalent-looking score surfaces at once

Do not let the user see two equally prominent numeric score cards without clear
role separation.

Options:

1. keep builder readiness persistent and move the AI score into collapsed
   enhancement details; or
2. keep the AI score compact and non-primary while the builder readiness card
   stays in the rail.

Choose one and apply it consistently.

### Step 4: Suppress AI scoring when it no longer applies

If the panel is showing the live builder draft because the enhancement is stale,
hide the AI assessment entirely until a new run completes.

### Step 5: Sync wording in product docs

If the terminology changes, update:

- `prompt-build-and-enhancement.md`
- `docs/launch-measurement-baseline.md`

so design/measurement language no longer mixes readiness, assessment, and
quality as if they were interchangeable.

### Definition of done

- A user can explain what each score means without guessing.
- Stale or draft-only states never show the wrong assessment surface.

---

## Workstream 6: Rebalance Desktop And Mobile Layout Density

**Findings addressed:** Tall desktop audit column and risk of mobile density
regression

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/MobileEnhancementSettingsSheet.tsx`
- Modify if needed: `src/styles/components.css`
- Test: `playwright/builder.mobile.spec.ts`
- Test: `playwright/builder.desktop.spec.ts`

### Step 1: Reduce persistent rail content on desktop

In `src/pages/Index.tsx`, keep the desktop right rail focused on:

- builder readiness;
- the output panel;
- a compact session/history launcher if still needed.

Move or demote:

- `Next best action`;
- `Recent web sources`;
- any explanatory text that duplicates the new output-panel banner.

### Step 2: Collapse session/history support by default

The existing `Session, tips & history` details block should stay available, but
the default closed state should not be the only strategy for controlling rail
height.

After moving duplicate content out of the rail, re-evaluate whether the
remaining block should:

- stay as a single details disclosure;
- split into smaller sections; or
- reduce copy and badge density.

### Step 3: Add height boundaries where needed

If the new output details area or right rail can still run long:

- add max heights;
- use internal scrolling where appropriate;
- keep sticky behavior defensible on laptop-height viewports.

Do not create nested scroll traps without strong reason.

### Step 4: Preserve mobile compactness

Keep the existing two-row sticky bar pattern.

Do not add:

- a third persistent row;
- a second session button in the sticky chrome;
- long labels that push the bar taller.

If new state or copy is needed on mobile, place it in the output drawer or the
settings sheet instead of the sticky bar.

### Step 5: Verify common review viewports

Manually validate:

1. desktop `1280x900`
2. desktop `1440x900`
3. mobile `390x844`
4. mobile `428x926`

Confirm:

- the preview is visible without excessive scrolling;
- the output drawer does not feel top-heavy;
- the sticky bar remains compact;
- no right-rail card stack visually overwhelms the builder.

### Definition of done

- The desktop review surface feels balanced instead of tower-like.
- Mobile retains the compact interaction model introduced earlier this week.

---

## Workstream 7: Validation, Documentation, And Rollout

**Findings covered:** All findings and regression guardrails

**Files:**
- Modify: `docs/README.md`
- Modify if needed: `prompt-build-and-enhancement.md`
- Modify if needed: `docs/launch-measurement-baseline.md`

### Step 1: Run focused test coverage first

Run:

```bash
npx vitest run \
  src/test/output-panel-phase2.test.tsx \
  src/test/output-panel-workflow.test.tsx \
  src/test/output-panel-enhance-metadata.test.tsx \
  src/test/web-search-activity-indicator.test.tsx \
  src/test/index-mobile-layout.test.tsx \
  src/test/index-ux-friction-improvements.test.tsx
```

### Step 2: Run browser verification

Run:

```bash
playwright test playwright/builder.mobile.spec.ts playwright/builder.desktop.spec.ts
```

If local port allocation requires it, follow the same alternate-port pattern
used in prior mobile verification work.

### Step 3: Run repository gates

Run:

```bash
npm run lint
npm run build
npm run check:docs
```

### Step 4: Capture fresh review screenshots

Capture before/after screenshots for these states:

1. built prompt, pre-enhance
2. enhancement streaming
3. enhancement settled
4. stale enhancement after editing the builder
5. enhancement with open questions and source links

Use those screenshots to verify that the review order is visibly shorter and
the preview is dominant.

### Step 5: Update documentation if copy or surface contracts changed

If score names, state copy, or disclosure structure changed materially, update:

- `prompt-build-and-enhancement.md`
- `docs/launch-measurement-baseline.md`
- `docs/README.md`

### Definition of done

- Focused tests, browser checks, lint, build, and docs validation pass.
- Screenshot comparison confirms that the preview-first hierarchy is visible in
  practice, not just in code structure.

## Non-Goals

This plan does not:

- redesign enhancement models or backend transport behavior;
- change session policy away from signed-in management;
- remove workflow/provenance/inspector surfaces entirely;
- change telemetry schemas unless required for UI state gating;
- reopen already-completed structured constraint round-tripping work unless a
  UI change uncovers a fresh bug.
