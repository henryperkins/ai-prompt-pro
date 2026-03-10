# Prompt Enhancement UI Surface Remediation Plan

**Date:** 2026-03-10
**Status:** Completed
**Revised:** 2026-03-10 — shipped UI-surface classification updates, telemetry exports, and mobile enhancement-control parity
**Source:** UI-surface verification of `docs/plans/2026-03-09-prompt-enhancement-improvements.md`

## Goal

Close the remaining UI-surface gaps found during verification so PromptForge has
clear, defensible answers to both of these questions:

1. Which enhancement capabilities are supposed to be visible in product UI?
2. Are desktop and mobile users given equivalent control over enhancement
   behavior?

This plan is intentionally narrower than the original enhancement roadmap. It
does not redesign the enhancement system again. It addresses the specific
surface-level findings left after implementation.

## Findings Covered

1. The roadmap mixes end-user UI features with non-UI capabilities such as
   telemetry storage and the eval harness. That makes "all new features are
   surfaced in the UI" ambiguous and causes false negatives during verification.
2. Mobile does not surface enhancement depth, rewrite strictness, or ambiguity
   mode. Those controls are desktop-only today.
3. The shipped usefulness telemetry is only discoverable through
   `getTelemetryLog()` in the browser console. There is no in-product developer
   surface for inspecting or exporting it.

## Recommended Implementation Order

Implement in this order:

1. Clarify the acceptance criteria first.
2. Add a lightweight developer/operator telemetry surface.
3. Add mobile parity for enhancement controls.
4. Add regression coverage and update the roadmap status/docs.

This order prevents shipping more UI without first deciding which capabilities
should count as UI features at all.

---

## Workstream 1: Clarify What Must Be Surfaced In UI

**Finding addressed:** The current roadmap treats end-user features,
developer/operator tooling, and test-only infrastructure as one flat list. That
is why the implementation can be "complete" and still fail a literal UI-surface
question.

**Files:**
- Modify: `docs/plans/2026-03-09-prompt-enhancement-improvements.md`
- Modify: `docs/plans/2026-03-10-prompt-enhancement-verification-remediation.md`
- Modify: `docs/launch-measurement-baseline.md`
- Modify if helpful: `docs/README.md`

### Step 1: Add a surface-classification section to the original roadmap

In `docs/plans/2026-03-09-prompt-enhancement-improvements.md`, add a short
section after `Implementation Strategy` called `Surface Classification`.

Split the shipped work into three buckets:

- `End-user UI`
  Items the user must be able to see or change directly in the product.
- `Developer / operator surface`
  Items that are intentionally discoverable through dev tools, export menus, or
  QA workflows rather than normal product UI.
- `Non-UI infrastructure`
  Items that are validated through tests, docs, and runtime behavior but are
  not meant to appear in the product surface.

Use concrete examples from the roadmap:

- End-user UI:
  metadata summary, variants, intent override, ambiguity card, inspector,
  apply-to-builder, reset enhancement preferences, too-much-changed feedback,
  depth/strictness/ambiguity controls.
- Developer / operator surface:
  telemetry log inspection/export, measurement formulas, diagnostics access.
- Non-UI infrastructure:
  eval harness, inference heuristics, backend schema changes, enhancement-plan
  normalization.

### Step 2: Update the original definition of done

In the same plan doc, replace the implicit "everything must be visible in UI"
reading with explicit acceptance language:

- all end-user enhancement controls and inspection surfaces are available on
  desktop and mobile where relevant;
- operator-facing telemetry is discoverable without opening the browser console;
- non-UI infrastructure is considered complete when covered by docs/tests and
  validated behavior, not product UI.

### Step 3: Update the verification/remediation doc to use the same language

In `docs/plans/2026-03-10-prompt-enhancement-verification-remediation.md`,
append a small `Post-remediation note` section clarifying that the follow-up
work resolved implementation gaps, but UI-surface completeness still requires
the scope split and mobile parity work in this plan.

This avoids future re-verification cycles reopening the same ambiguity.

### Step 4: Keep the measurement doc explicit about its intended surface

In `docs/launch-measurement-baseline.md`, add one sentence under
`Enhancement Usefulness Metrics`:

- telemetry is an operator/developer inspection surface, not an end-user
  feature;
- access should be available from in-product developer tools once Workstream 2
  lands.

### Step 5: Optionally update the docs index

If `docs/README.md` is being maintained as an index, add this plan to the list
so later verification can find the UI-surface follow-up without searching
commit history.

### Definition of done

- The roadmap clearly distinguishes end-user UI from operator tooling and
  non-UI infrastructure.
- Future verification can answer "is the UI complete?" without reinterpreting
  the roadmap.

---

## Workstream 2: Add An In-Product Telemetry / Diagnostics Surface

**Finding addressed:** usefulness telemetry exists, but the only current access
path is `getTelemetryLog()` in the console. That is not a product surface.

**Files:**
- Modify: `src/components/OutputPanelDevTools.tsx`
- Modify if needed: `src/lib/telemetry.ts`
- Modify if needed: `src/components/OutputPanelHeader.tsx`
- Test: `src/test/output-panel-phase2.test.tsx`
- Test: `src/test/telemetry-listener.test.ts`
- Test: `src/test/telemetry-usefulness-events.test.ts`

### Step 1: Reuse the existing developer-tools entry point

Do not create a brand new top-level settings area for this.

Use the existing `Developer tools` submenu in
`src/components/OutputPanelDevTools.tsx` as the canonical location for
enhancement diagnostics.

Add a new subsection or a grouped set of menu items such as:

- `Copy telemetry log (JSON)`
- `Download telemetry log`
- `Copy latest enhance session summary`

Keep them under the developer-tools surface, not in the normal user-facing save
menu.

### Step 2: Add a small telemetry export helper

Inside `OutputPanelDevTools.tsx`, import `getTelemetryLog()` and serialize the
result as formatted JSON.

Implementation guidance:

- `Copy telemetry log (JSON)`
  copies `JSON.stringify(getTelemetryLog(), null, 2)`.
- `Download telemetry log`
  downloads the same content as `promptforge-telemetry-log.json`.
- `Copy latest enhance session summary`
  derives a small object from the most recent relevant events rather than
  copying the entire history.

Track these with `builder_dev_export_used`, for example:

- `action: "copy_telemetry_log"`
- `action: "download_telemetry_log"`
- `action: "copy_enhance_summary"`

### Step 3: Define empty-state behavior

When the telemetry log is empty:

- keep the items visible so the surface is discoverable;
- disable the export actions;
- show a short toast or disabled title explaining that no telemetry has been
  captured yet.

Do not hide the menu items completely, because discoverability is the point of
this workstream.

### Step 4: Keep the API narrow

Do not expose mutating telemetry actions in the UI yet.

Avoid adding:

- `Clear telemetry log`
- arbitrary event injection
- raw localStorage inspection UI

Those can be added later if there is a QA need, but they are not necessary to
close the current finding.

### Step 5: Add focused regression tests

Update `src/test/output-panel-phase2.test.tsx` to verify:

- the developer-tools menu shows the new telemetry items;
- items are disabled when no telemetry exists;
- items become enabled after at least one telemetry event is recorded.

Update telemetry tests if needed to verify:

- the exported JSON shape matches `getTelemetryLog()`;
- tab-scoped log merging still works unchanged.

### Step 6: Manual verification

Run:

```bash
npx vitest run \
  src/test/output-panel-phase2.test.tsx \
  src/test/telemetry-listener.test.ts \
  src/test/telemetry-usefulness-events.test.ts
```

Then verify in the app:

1. trigger at least one enhance event;
2. open `More` -> `Developer tools`;
3. copy the telemetry log;
4. download the telemetry log;
5. confirm the exported content matches `getTelemetryLog()`.

### Definition of done

- usefulness telemetry is discoverable from in-product developer tools;
- exporting telemetry no longer requires opening the console;
- the surface stays clearly scoped to developer/operator workflows.

---

## Workstream 3: Add Mobile Parity For Enhancement Controls

**Finding addressed:** mobile users can enhance and toggle web search, but they
cannot change enhancement depth, rewrite strictness, or ambiguity mode.

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/OutputPanel.tsx`
- Modify: `src/components/OutputPanelEnhanceControls.tsx`
- Add: `src/components/MobileEnhancementSettingsSheet.tsx`
- Test: `src/test/index-mobile-layout.test.tsx`
- Add or modify: `src/test/output-panel-enhance-controls.test.tsx`
- Add or modify: `playwright/builder.mobile.spec.ts`

### Step 1: Do not duplicate the control logic

Before adding mobile UI, split the control rendering in
`src/components/OutputPanelEnhanceControls.tsx` into two conceptual pieces:

- `EnhancementControlGroups`
  the web/depth/strictness/ambiguity controls;
- `EnhancePrimaryButton`
  the enhance CTA and its loading/done states.

The existing desktop component can then compose both pieces.

This prevents the mobile implementation from forking the same options and drift
starting immediately.

### Step 2: Add a dedicated mobile settings trigger

In the mobile sticky bar in `src/pages/Index.tsx`, add a third secondary action
next to preview and web toggle:

- `Settings`

Recommended implementation:

- a compact button or chip labeled `Settings`;
- opens a bottom sheet or drawer optimized for mobile controls.

Do not force users to open the output drawer just to change enhancement
settings. The settings need to be available before the next enhancement run.

### Step 3: Implement a mobile settings sheet

Create `src/components/MobileEnhancementSettingsSheet.tsx`.

Render inside it:

- enhancement depth
- rewrite strictness
- ambiguity mode
- current web-search state

Use the same option labels and callbacks as desktop:

- `Light polish` / `Structured rewrite` / `Expert prompt`
- `Preserve wording` / `Balanced` / `Optimize aggressively`
- `Ask me` / `Use placeholders` / `Infer conservatively`

The component should accept the same props already flowing into `OutputPanel`:

- current values
- change handlers
- `isEnhancing`

### Step 4: Surface current selections without opening the sheet

In the mobile sticky bar or the top of the mobile output drawer, add a compact
read-only summary line such as:

- `Structured rewrite · Balanced · Infer conservatively`

This solves two problems:

- the controls become visible even before the sheet is opened;
- users can confirm what mode they are about to run without reopening settings.

Keep the summary short and truncation-safe.

### Step 5: Stop hiding the control state in the mobile output drawer

Today the mobile drawer passes `hideEnhanceButton`, which also removes the
control block that desktop uses.

Change the mobile review surface so at least one of these is true:

- the drawer shows the same control summary as the sticky bar; or
- the drawer includes a secondary `Edit enhancement settings` trigger.

Do not require users to back out of the drawer and guess where the settings
live.

### Step 6: Keep the actual enhance CTA in the sticky bar

Do not move the primary mobile enhance button into the settings sheet.

The intended flow should stay:

1. open settings if needed;
2. choose depth/strictness/ambiguity;
3. close sheet;
4. tap the sticky-bar enhance button.

This preserves the current fast mobile interaction model while adding parity.

### Step 7: Verify the payload still changes correctly

Once the mobile controls exist, confirm that mobile interactions still update
the same state used by `handleEnhance` in `Index.tsx`.

Specifically verify that the next enhance request reflects the mobile-selected:

- `builder_mode`
- `rewrite_strictness`
- `ambiguity_mode`

No mobile-only state should bypass the existing request pipeline.

### Step 8: Add regression coverage

Update `src/test/index-mobile-layout.test.tsx` to verify:

- the sticky bar shows the new settings trigger;
- opening the trigger reveals depth/strictness/ambiguity options;
- selecting an option updates the visible current-selection summary.

Update `src/test/output-panel-enhance-controls.test.tsx` if the shared control
group is extracted.

Add or extend `playwright/builder.mobile.spec.ts` to verify on at least one
mobile viewport:

1. open enhancement settings;
2. change all three controls;
3. close settings;
4. confirm the summary reflects the new values;
5. run enhance and ensure no layout regression occurs.

### Step 9: Manual verification

Run:

```bash
npx vitest run \
  src/test/index-mobile-layout.test.tsx \
  src/test/output-panel-enhance-controls.test.tsx
```

Then run:

```bash
npx playwright test playwright/builder.mobile.spec.ts
```

Manual QA checklist:

1. on mobile, confirm `Settings` is visible before the first enhancement;
2. change depth, strictness, and ambiguity;
3. confirm the summary updates immediately;
4. run enhance;
5. open the output drawer and confirm the chosen settings are still visible or
   editable from there;
6. rerun enhancement with a different setting and confirm the output changes in
   the expected direction.

### Definition of done

- mobile users can change the same enhancement controls as desktop users;
- the current mobile settings are visible without opening the console or
  inspecting state;
- the next enhance request uses the selected mobile values through the existing
  request path.

---

## Workstream 4: Re-Verify UI Surface Completeness

**Finding addressed:** after the above changes land, the project needs one
verification pass that answers the UI-surface question directly rather than
indirectly through roadmap completion.

**Files:**
- Modify: `docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md`
- Modify if complete: `docs/plans/2026-03-09-prompt-enhancement-improvements.md`
- Modify if complete: `docs/plans/2026-03-10-prompt-enhancement-verification-remediation.md`

### Step 1: Run the targeted verification slice

Run:

```bash
npx vitest run \
  src/test/output-panel-phase2.test.tsx \
  src/test/output-panel-enhance-controls.test.tsx \
  src/test/index-mobile-layout.test.tsx \
  src/test/telemetry-listener.test.ts \
  src/test/telemetry-usefulness-events.test.ts
```

Then run:

```bash
npx playwright test playwright/builder.mobile.spec.ts
```

### Step 2: Do a desktop/mobile surface checklist

Desktop checklist:

1. intent override is visible before enhance;
2. metadata summary is visible after enhance;
3. variants are visible when present;
4. structured inspector is visible when present;
5. developer tools expose telemetry exports.

Mobile checklist:

1. preview is accessible;
2. web toggle is accessible;
3. settings trigger is accessible;
4. depth/strictness/ambiguity controls are accessible;
5. current selections are visible after closing settings;
6. output drawer still exposes summary/inspector content after enhance.

### Step 3: Update plan statuses when the work lands

When all workstreams are complete:

- mark this plan `Completed`;
- update the original roadmap to note that UI-surface parity is complete for
  the intended end-user features;
- keep the operator/non-UI classification note in place so future verification
  does not regress into scope ambiguity.

### Exit criteria

This plan is complete when all of the following are true:

- the roadmap clearly states which items are end-user UI, operator tooling, and
  non-UI infrastructure;
- usefulness telemetry is accessible from in-product developer tools;
- mobile exposes enhancement depth, rewrite strictness, and ambiguity controls;
- desktop and mobile both surface the intended enhancement features;
- future verification can answer the UI-surface question without reinterpreting
  the plan.
