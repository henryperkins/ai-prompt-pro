# Prompt Builder UI Review Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all 18 findings from the March 9 UI review — 2 critical, 8 major, 8 minor — across accessibility, visual design, layout, mobile, and token consistency.

**Architecture:** Changes are grouped into 9 phases ordered by severity and dependency. Phase 1 (contrast/a11y) and Phase 2 (toggle states) are token/CSS-only with no component restructuring. Phases 3-6 involve component edits. Phases 7-9 are lower-priority polish.

**Tech Stack:** CSS custom properties (HSL tokens), Tailwind utility classes, React (TSX), UUI component library, SVG (PFQualityGauge), Vitest for unit tests.

**Review findings reference:** Screenshots in project root (`review-01-*.png` through `review-09-*.png`).

---

## Phase 1: Accessibility & Contrast (Critical)

### Task 1: Bump muted-foreground token for WCAG AA compliance

**Context:** `--muted-foreground` at `37 11% 68%` against `--card` at `212 25% 15%` yields ~4.0:1 contrast ratio, failing WCAG AA (4.5:1 minimum for normal text). This token is used across all description text in the builder.

**Files:**
- Modify: `src/styles/tokens.css:25-26` (standard theme) and `src/styles/tokens.css:141-142` (midnight theme)

**Step 1: Update standard theme muted-foreground**

In `src/styles/tokens.css`, change line 26 from:
```css
--muted-foreground: 37 11% 68%;
```
to:
```css
--muted-foreground: 37 11% 74%;
```

This raises the lightness from 68% to 74%, achieving ~5.2:1 contrast against `--card` (15% lightness).

**Step 2: Update midnight theme muted-foreground**

In the same file, change line 142 from:
```css
--muted-foreground: 37 11% 70%;
```
to:
```css
--muted-foreground: 37 11% 76%;
```

Achieves ~5.0:1 against midnight `--card` (12% lightness).

**Step 3: Verify visually**

Run: `npm run dev`
Check: Builder page — all description text (textarea placeholder, sidebar card descriptions, accordion subtitles) should be noticeably more readable without looking too bright.

**Step 4: Run lint and tests**

Run: `npm run lint && npm run test:unit`
Expected: All pass (token-only change, no component logic affected).

**Step 5: Commit**

```bash
git add src/styles/tokens.css
git commit -m "fix(a11y): bump muted-foreground lightness to meet WCAG AA 4.5:1 contrast"
```

---

### Task 2: Fix pf-parchment text opacity for contrast compliance

**Context:** Several places in the builder use `text-pf-parchment/70` and `text-pf-parchment/90` which produce ~4.2:1 and ~5.5:1 respectively against card backgrounds. The `/70` variant fails AA.

**Files:**
- Modify: `src/pages/Index.tsx:2242-2245` (Quality signal card heading + description)

**Step 1: Update Quality signal card text classes**

In `src/pages/Index.tsx`, find the quality signal card (around lines 2238-2276).

Change line 2243 from:
```tsx
<p className="text-xs font-medium text-pf-parchment/90">
```
to:
```tsx
<p className="text-xs font-medium text-foreground">
```

Change line 2245 from:
```tsx
<p className="mt-0.5 text-sm text-pf-parchment/70">
```
to:
```tsx
<p className="mt-0.5 text-sm text-muted-foreground">
```

This also addresses Finding 10a (mixed fantasy/semantic token usage in sidebar cards).

**Step 2: Update tier label text**

In the same card, find line ~2258:
```tsx
<span className="text-[11px] text-pf-parchment/70">
```
Change to:
```tsx
<span className="text-[11px] text-muted-foreground">
```

**Step 3: Verify visually**

Check: Quality signal card text should now match the contrast level of all other sidebar cards.

**Step 4: Run tests**

Run: `npm run test:unit`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "fix(a11y): replace pf-parchment opacity text with semantic tokens for contrast"
```

---

### Task 3: Improve focus ring visibility on dark backgrounds

**Context:** The current focus ring is `2px solid hsl(var(--ring) / 0.85)` with `outline-offset: 2px`. On dark card backgrounds the teal ring is barely visible due to the 0.85 opacity.

**Files:**
- Modify: `src/styles/base.css:128-139`

**Step 1: Increase ring opacity and add shadow for double-ring effect**

In `src/styles/base.css`, replace lines 128-139:

```css
:where(a,
  button,
  input,
  textarea,
  select,
  [role="button"],
  [role="tab"],
  [role="menuitem"],
  [tabindex]):focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  box-shadow: 0 0 0 4px hsl(var(--background) / 0.8);
}
```

Changes: removed `/0.85` opacity from ring color (now full saturation), added a `box-shadow` that creates a dark halo behind the ring for contrast against any background.

**Step 2: Verify with keyboard navigation**

Tab through the builder with keyboard. The focus ring should now be clearly visible on:
- Nav buttons (dark header background)
- Textarea (dark card background)
- Toggle buttons inside accordions
- Sidebar card buttons

**Step 3: Run tests**

Run: `npm run lint && npm run test:unit`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/styles/base.css
git commit -m "fix(a11y): improve focus ring visibility with full opacity and halo shadow"
```

---

### Task 4: Fix accordion trigger accessible names

**Context:** Accordion triggers include subtitle text in their accessible name, making screen reader announcements verbose (e.g., "Adjust details Role, style, format, and constraints.").

**Files:**
- Modify: `src/components/BuilderAdjustDetails.tsx:78-106`
- Modify: `src/components/BuilderSourcesAdvanced.tsx:73-95`

**Step 1: Add aria-label to BuilderAdjustDetails trigger**

In `src/components/BuilderAdjustDetails.tsx`, find the trigger button (line 78). Add `aria-label`:

```tsx
<button
  type="button"
  className="flex w-full items-center justify-between gap-2 text-left"
  onClick={() => onOpenChange(!isOpen)}
  aria-expanded={isOpen}
  aria-controls="builder-zone-2-content"
  aria-label="Adjust details"
>
```

Then wrap the subtitle paragraph in `aria-hidden`:

Find line ~90:
```tsx
<p className="text-xs text-muted-foreground">
  Role, style, format, and constraints.
</p>
```
Change to:
```tsx
<p className="text-xs text-muted-foreground" aria-hidden="true">
  Role, style, format, and constraints.
</p>
```

**Step 2: Add aria-label to BuilderSourcesAdvanced trigger**

In `src/components/BuilderSourcesAdvanced.tsx`, find the trigger button (line 73). Same pattern:

```tsx
<button
  type="button"
  className="flex w-full items-center justify-between gap-2 text-left"
  onClick={() => onOpenChange(!isOpen)}
  aria-expanded={isOpen}
  aria-controls="builder-zone-3-content"
  aria-label="Add sources or advanced settings"
>
```

Find the subtitle (~line 85):
```tsx
<p className="text-xs text-muted-foreground" aria-hidden="true">
  Optional references and integrations.
</p>
```

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/components/BuilderAdjustDetails.tsx src/components/BuilderSourcesAdvanced.tsx
git commit -m "fix(a11y): add aria-label to accordion triggers, hide verbose subtitles from SR"
```

---

## Phase 2: Toggle Button State Visibility (Major)

### Task 5: Make selected toggle buttons visually distinct

**Context:** Selected toggles use `variant="primary"` which renders as `bg-primary text-primary-foreground` (teal bg, dark text). On the dark card background, the teal is visible but the unselected `variant="secondary"` (dark bg, light text) looks nearly identical because both are low-contrast against the card. The selected state needs stronger differentiation.

**Files:**
- Modify: `src/components/base/buttons/button.tsx` — no changes needed here; the `primary` variant already has a distinct style.
- Modify: `src/components/BuilderAdjustDetails.tsx:189-214, 227-242, 287-313`
- Modify: `src/components/ToneControls.tsx:22-73`

**Step 1: Add ring accent to selected toggle buttons in BuilderAdjustDetails**

The issue is that `variant="primary"` and `variant="secondary"` look too similar at small sizes on dark backgrounds. Add a `ring` to the selected state for extra differentiation.

In `src/components/BuilderAdjustDetails.tsx`, find the tone toggle pattern (around lines 189-214). For each button that uses `variant={... ? "primary" : "secondary"}`, add a conditional ring class:

For the "Model decides" tone button (line ~194):
```tsx
variant={config.tone === "" ? "primary" : "secondary"}
className={`h-11 px-2 text-sm sm:h-9 ${config.tone === "" ? "ring-1 ring-primary/50" : ""}`}
```

For the mapped tone buttons (line ~205):
```tsx
variant={config.tone === tone ? "primary" : "secondary"}
className={`h-11 px-2 text-sm sm:h-9 ${config.tone === tone ? "ring-1 ring-primary/50" : ""}`}
```

Apply the same pattern to:
- Output format toggles (lines ~227-242): `config.format.includes(format) ? "ring-1 ring-primary/50" : ""`
- Length toggles (find lines with `config.length === ...`): same pattern
- Complexity toggles (lines ~287-313): `config.complexity === option ? "ring-1 ring-primary/50" : ""`

**Step 2: Apply same pattern to ToneControls**

In `src/components/ToneControls.tsx`, apply the same ring-1 treatment to all toggle buttons (lines 22-73).

**Step 3: Verify visually**

Open the builder, expand "Adjust details." Selected buttons should show a subtle teal ring that makes them clearly distinguishable from unselected buttons.

**Step 4: Run tests**

Run: `npm run test:unit`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/components/BuilderAdjustDetails.tsx src/components/ToneControls.tsx
git commit -m "fix(ui): add ring accent to selected toggle buttons for better visibility"
```

---

### Task 6: Fix locked buttons — disable and add tooltip

**Context:** "Save (locked)" and "More (locked)" are clickable but only fire telemetry. Users expect disabled affordance.

**Files:**
- Modify: `src/components/OutputPanel.tsx:651-687`

**Step 1: Disable the buttons and clean up labels**

In `src/components/OutputPanel.tsx`, find the locked buttons section (lines 651-687).

Change the "Save (locked)" button (~line 657):
```tsx
<Button
  type="button"
  variant="secondary"
  size="sm"
  className="ui-toolbar-button gap-1.5"
  isDisabled
  title="Enter a prompt to unlock saving"
>
  <Save className="w-3 h-3" />
  Save
</Button>
```

Change the "More (locked)" button (~line 671):
```tsx
<Button
  type="button"
  variant="tertiary"
  size="sm"
  className="ui-toolbar-button gap-1.5"
  isDisabled
  title="Enter a prompt to unlock options"
>
  <MoreHorizontal className="w-3 h-3" />
  More
</Button>
```

Changes: Added `isDisabled`, added `title` for tooltip, removed `onClick` handlers and "(locked)" from labels.

**Step 2: Verify visually**

Open builder with empty prompt. "Save" and "More" should appear grayed out with a tooltip on hover.

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: All pass. If any test asserts on "Save (locked)" text, update the assertion to "Save".

**Step 4: Commit**

```bash
git add src/components/OutputPanel.tsx
git commit -m "fix(ui): disable locked buttons instead of making them clickable no-ops"
```

---

## Phase 3: Sidebar Layout & Hierarchy (Major)

### Task 7: Consolidate secondary sidebar cards into collapsible section

**Context:** The right sidebar stacks 5+ cards. Cards 3-5 (Codex session, Next best action, History) compete with the primary Preview + Enhance CTA. Collapsing them reduces visual noise.

**Files:**
- Modify: `src/pages/Index.tsx:2307-2405`

**Step 1: Wrap secondary cards in a collapsible details/summary**

In `src/pages/Index.tsx`, find the section after `<OutputPanel>` (line ~2307). Wrap the Codex session, Next best action, and History cards in a `<details>` element:

Replace lines 2307-2405 with:

```tsx
<details className="group">
  <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-card/80 [&::-webkit-details-marker]:hidden">
    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
    Session, tips & history
  </summary>
  <div className="mt-2 space-y-3">
    <Card className="pf-panel border-border/70 bg-card/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Codex session
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sessionDrawerSummary}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleOpenSessionDrawer}
        >
          {isSignedIn ? "Open drawer" : "Sign in to use"}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge
          variant="pill"
          tone={
            isSignedIn
              ? enhanceSession.threadId
                ? "brand"
                : "default"
              : "default"
          }
          className="text-xs"
        >
          {isSignedIn
            ? enhanceSession.threadId
              ? "Thread active"
              : "New thread"
            : "Login required"}
        </Badge>
        {isSignedIn && enhanceSession.contextSummary.trim() && (
          <Badge variant="pill" tone="brand" className="text-xs">
            Context saved
          </Badge>
        )}
        {isSignedIn && enhanceSession.latestEnhancedPrompt.trim() && (
          <Badge variant="pill" tone="brand" className="text-xs">
            Prompt saved
          </Badge>
        )}
      </div>
    </Card>
    <Card className="pf-panel border-border/70 bg-card/80 p-3">
      <p className="text-sm font-medium text-foreground">
        Next best action
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {!hasEnhancedOnce
          ? canSharePrompt
            ? `Preview is ready to copy, save, or share. ${primaryCtaLabel} to compare changes and get AI refinement suggestions.`
            : `Preview is ready to copy or save. Sign in to share, or ${primaryCtaLabel} to compare changes and get AI refinement suggestions.`
          : (refineSuggestions[0]?.description ??
            "Use Improve this result suggestions to keep iterating.")}
      </p>
    </Card>
    {webSearchSources.length > 0 && (
      <Card className="pf-panel border-border/70 bg-card/80 p-3">
        <p className="text-sm font-medium text-foreground">
          Recent web sources
        </p>
        <ul className="mt-2 space-y-1">
          {webSearchSources.slice(0, 3).map((source, index) => (
            <li
              key={`${source}-${index}`}
              className="text-xs text-muted-foreground line-clamp-2 break-all"
            >
              {source}
            </li>
          ))}
        </ul>
      </Card>
    )}
    <Card className="pf-panel border-border/70 bg-card/80 p-3">
      <p className="text-sm font-medium text-foreground">History</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Saved versions appear in History. Open{" "}
        <Link
          to="/history"
          className="text-primary underline-offset-2 hover:underline"
        >
          Version History
        </Link>{" "}
        to restore prior prompts.
      </p>
    </Card>
  </div>
</details>
<p className="text-xs text-muted-foreground text-center mt-3">
  Press{" "}
  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">
    Ctrl+Enter
  </kbd>{" "}
  to enhance
</p>
```

**Note:** You'll need to import `ChevronRight` from `@phosphor-icons/react` (or use `CaretRight`). Check existing imports at the top of Index.tsx.

**Step 2: Also update heading sizes in the cards while we're here (Finding 6b)**

In the code above, card headings are now `text-sm font-medium` (up from `text-xs font-medium`) and descriptions are `text-xs text-muted-foreground`. This fixes the inverted heading/body size hierarchy.

Apply the same fix to the Quality signal card heading (already changed in Task 2).

**Step 3: Verify visually**

The sidebar should now show: Quality gauge card → OutputPanel → collapsed "Session, tips & history" summary → Ctrl+Enter hint. Clicking the summary expands the secondary cards.

**Step 4: Run tests**

Run: `npm run test:unit`
Expected: Pass. If any test targets sidebar card text, update selectors.

**Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat(ui): collapse secondary sidebar cards into expandable section"
```

---

### Task 8: Remove duplicate quality score displays

**Context:** The score shows 3 times: badge in quality card, inside the SVG gauge, and tier label text. Reduce to 2: gauge (primary) + badge (compact reference).

**Files:**
- Modify: `src/pages/Index.tsx:2251-2266`

**Step 1: Remove the tier label text**

In the quality signal card, find lines ~2258-2266 (the tier label span):
```tsx
<span className="text-[11px] text-muted-foreground">
  {score.total >= 90
    ? "Legendary"
    : ...}
</span>
```

Remove this `<span>` entirely. The tier is already communicated via the gauge color (Common=gray, Rare=teal, Epic=orange, Legendary=gold).

Keep the `Badge` with `{score.total}/100` as it serves as a quick-glance reference without needing to interpret the gauge.

**Step 2: Run tests and commit**

Run: `npm run test:unit`

```bash
git add src/pages/Index.tsx
git commit -m "fix(ui): remove duplicate tier label from quality signal card"
```

---

## Phase 4: Quality Gauge Improvements (Major)

### Task 9: Enlarge gauge and migrate hardcoded colors to tokens

**Context:** The gauge is rendered at 92px — too small for the tier detail to land. Hardcoded `rgba()` values bypass the token system.

**Files:**
- Modify: `src/pages/Index.tsx:2270-2274` (gauge size prop)
- Modify: `src/components/fantasy/PFQualityGauge.tsx:22-45, 70-131` (hardcoded colors)

**Step 1: Increase gauge size**

In `src/pages/Index.tsx`, find line ~2271:
```tsx
<PFQualityGauge
  value={score.total}
  size={92}
  showLabel={false}
/>
```
Change `size={92}` to `size={128}`.

**Step 2: Replace hardcoded rgba values with CSS variable references**

In `src/components/fantasy/PFQualityGauge.tsx`:

Line 75 — background track stroke:
```tsx
stroke="rgba(46,58,70,0.65)"
```
Change to:
```tsx
stroke="rgba(var(--pf-slate-rgb), 0.65)"
```

Line ~96 — inner circle fill:
```tsx
fill="rgba(11,15,20,0.88)"
```
Change to:
```tsx
fill="rgba(var(--pf-coal-rgb), 0.88)"
```

Line ~97 — inner circle stroke:
```tsx
stroke="rgba(214,166,64,0.25)"
```
Change to:
```tsx
stroke="rgba(var(--pf-gold-rgb), 0.25)"
```

Line ~106 — score text fill:
```tsx
fill="rgba(230,225,213,0.95)"
```
Change to:
```tsx
fill="rgba(var(--pf-parchment-rgb), 0.95)"
```

Line ~117 — denominator text fill:
```tsx
fill="rgba(230,225,213,0.55)"
```
Change to:
```tsx
fill="rgba(var(--pf-parchment-rgb), 0.55)"
```

Similarly update any remaining hardcoded values in the label section (lines 124-129).

**Step 3: Verify visually**

The gauge should now be noticeably larger (128px vs 92px) and the tier color glow/gradient should be more appreciable.

**Step 4: Run tests and commit**

Run: `npm run test:unit`

```bash
git add src/pages/Index.tsx src/components/fantasy/PFQualityGauge.tsx
git commit -m "fix(ui): enlarge quality gauge and migrate hardcoded colors to CSS vars"
```

---

## Phase 5: Input & Copy Polish (Major/Minor)

### Task 10: Shorten textarea placeholder

**Context:** The current placeholder wraps to 3 lines on desktop, making the empty state look pre-filled.

**Files:**
- Modify: `src/components/BuilderHeroInput.tsx:104`

**Step 1: Shorten placeholder text**

In `src/components/BuilderHeroInput.tsx`, find line 104:
```tsx
placeholder="Describe the task in 1-2 sentences. Example: Draft a concise project update for executives using these notes."
```
Change to:
```tsx
placeholder="Describe what the model should do..."
```

The example text is already communicated by the "Start in 3 steps" card below the textarea.

**Step 2: Run tests and commit**

Run: `npm run test:unit`
If any test asserts on the old placeholder text, update it.

```bash
git add src/components/BuilderHeroInput.tsx
git commit -m "fix(ui): shorten textarea placeholder to prevent multi-line wrapping"
```

---

### Task 11: Clarify Reset all vs Clear button labels

**Context:** Both "Reset all" and "Clear" appear when text is entered. The distinction is unclear.

**Files:**
- Modify: `src/components/BuilderHeroInput.tsx` — find the "Reset all" and "Clear" buttons

**Step 1: Find and update button labels**

Search for the Reset and Clear buttons in `BuilderHeroInput.tsx`. Update labels:

- "Reset all" → "Reset all settings" (this clears the textarea AND all advanced settings)
- "Clear" → "Clear prompt" (this only clears the textarea)

**Step 2: Run tests and commit**

```bash
git add src/components/BuilderHeroInput.tsx
git commit -m "fix(ui): clarify Reset all vs Clear button labels"
```

---

### Task 12: Remove quotation marks from "No preview yet" badge

**Context:** The badge displays `"Source: No preview yet"` with literal quotation marks.

**Files:**
- Modify: `src/components/OutputPanel.tsx` — find the "Source: No preview yet" text

**Step 1: Find and update badge text**

Search OutputPanel.tsx for `"Source: No preview yet"`. Remove the wrapping quotes from the rendered output. This is likely inside a `<Badge>` or `<span>`. Change from:

```tsx
"Source: No preview yet"
```
to:
```tsx
Source: No preview yet
```

(Ensure you're changing the displayed text, not a JS string literal — the quotes may be part of the template string.)

**Step 2: Run tests and commit**

```bash
git add src/components/OutputPanel.tsx
git commit -m "fix(ui): remove unnecessary quotation marks from preview source badge"
```

---

## Phase 6: Mobile Layout (Major)

### Task 13: Simplify mobile sticky bar

**Context:** The mobile sticky bar packs 5 elements (preview chip, session chip, web toggle, score badge, enhance button) into a narrow strip. Text truncates on 375px viewports.

**Files:**
- Modify: `src/pages/Index.tsx:2410-2497`

**Step 1: Restructure the mobile sticky bar to two rows**

Replace the current 3-row layout with a cleaner 2-row layout:
- **Row 1:** Score badge (left) + Enhance button (fills remaining space)
- **Row 2:** Preview trigger (left half) + Web toggle (right half)

Remove the Session trigger from the sticky bar entirely — it's accessible via the hamburger menu and is a secondary action.

In `src/pages/Index.tsx`, replace lines 2412-2496 (the sticky bar inner content):

```tsx
<div
  className="fixed inset-x-0 bottom-[calc(4.375rem+env(safe-area-inset-bottom)+1px)] z-30 border-t border-border bg-card/95 px-3 py-2 backdrop-blur-sm sm:bottom-0"
  data-testid="builder-mobile-sticky-bar"
>
  {/* Row 1: Score + Enhance */}
  <div className="flex items-center gap-2">
    <Badge
      variant="pill"
      tone={score.total >= 75 ? "brand" : "default"}
      className="h-10 min-w-16 justify-center rounded-md px-2 text-sm font-semibold"
    >
      {score.total}/100
    </Badge>
    <Button
      variant="primary"
      size="md"
      onClick={handleEnhance}
      disabled={isEnhancing || !builtPrompt}
      className="signature-enhance-button h-10 min-w-0 flex-1 gap-2"
      data-phase={enhancePhase}
      data-testid="builder-mobile-enhance-button"
    >
      {isEnhancing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {mobileEnhanceLabel}
        </>
      ) : (
        <>
          {enhancePhase === "done" ? (
            <Check className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {mobileEnhanceLabel}
        </>
      )}
    </Button>
  </div>

  {/* Row 2: Preview trigger + Web toggle */}
  <div className="mt-2 flex items-center gap-2">
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className="interactive-chip flex-1 min-h-9 rounded-lg border border-border/80 bg-background/70 px-3 py-1.5 text-left"
      aria-label="Open output preview"
      data-testid="builder-mobile-preview-trigger"
    >
      <div className="type-label-caps flex items-center gap-1.5 text-[0.7rem] font-medium text-foreground/85">
        <Eye className="h-3.5 w-3.5" />
        {mobilePreviewLabel}
      </div>
      <p className="mt-0.5 truncate text-[0.7rem] leading-4 text-muted-foreground">
        {mobilePreviewText}
      </p>
    </button>
    <label
      className="flex min-h-9 items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 text-xs text-muted-foreground cursor-pointer select-none"
      data-testid="builder-mobile-web-toggle"
    >
      <Switch
        checked={webSearchEnabled}
        onCheckedChange={handleWebSearchToggle}
        disabled={isEnhancing}
        aria-label="Enable web search during enhancement"
      />
      <Globe className="h-3.5 w-3.5" />
      <span>Web</span>
    </label>
  </div>
</div>
```

**Step 2: Verify on mobile viewport**

Resize browser to 375x812. The sticky bar should now have:
- Top row: score pill + full-width enhance button — the primary CTA is dominant
- Bottom row: preview trigger + web toggle — secondary actions

**Step 3: Run Playwright mobile tests**

Run: `npm run test:mobile`
Expected: Tests should pass. If any test targets the session trigger in the sticky bar, it will need updating.

**Step 4: Run unit tests and commit**

Run: `npm run test:unit`

```bash
git add src/pages/Index.tsx
git commit -m "fix(mobile): simplify sticky bar to prioritize score + enhance CTA"
```

---

### Task 14: Add compact quality indicator on mobile

**Context:** The SVG quality gauge is hidden on mobile. Only a number badge is shown. Add a tier-colored horizontal progress bar.

**Files:**
- Modify: `src/pages/Index.tsx` — inside the mobile sticky bar Badge

**Step 1: Replace the plain badge with a progress-enhanced badge**

This was already partially addressed in Task 13. The score badge in the mobile sticky bar can be enhanced with a background gradient that indicates progress.

In the Badge from Task 13's code, add a style prop:

```tsx
<Badge
  variant="pill"
  tone={score.total >= 75 ? "brand" : "default"}
  className="relative h-10 min-w-16 justify-center overflow-hidden rounded-md px-2 text-sm font-semibold"
>
  <span
    className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
    style={{ width: `${score.total}%` }}
  />
  <span className="relative">{score.total}/100</span>
</Badge>
```

This adds a subtle fill behind the score number that visually communicates progress.

**Step 2: Verify and commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat(mobile): add progress fill to mobile score badge"
```

---

## Phase 7: Hero & Returning Users (Minor)

### Task 15: Auto-collapse hero for returning users

**Context:** The hero banner consumes ~170px on every visit. Returning users don't need the value prop repeated.

**Files:**
- Modify: `src/pages/Index.tsx:1887-1910` (hero section)

**Step 1: Add localStorage-based hero collapse**

Near the top of the `Index` component (with other state declarations), add:

```tsx
const [heroCollapsed, setHeroCollapsed] = useState(() => {
  try {
    return localStorage.getItem("pf-hero-dismissed") === "1";
  } catch {
    return false;
  }
});
```

**Step 2: Add dismiss button to hero and conditional rendering**

Wrap the hero in a conditional. When collapsed, show a minimal one-line bar:

```tsx
{heroCollapsed ? (
  <button
    type="button"
    onClick={() => {
      setHeroCollapsed(false);
      try { localStorage.removeItem("pf-hero-dismissed"); } catch {}
    }}
    className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-card/80"
  >
    <Sparkles className="h-3 w-3" />
    PromptForge — Turn rough ideas into quality prompts
  </button>
) : (
  <div
    className="pf-gilded-frame pf-hero-surface relative mb-4 px-4 py-4 text-center sm:mb-8 sm:px-6 sm:py-6"
    data-testid="builder-hero"
  >
    <button
      type="button"
      onClick={() => {
        setHeroCollapsed(true);
        try { localStorage.setItem("pf-hero-dismissed", "1"); } catch {}
      }}
      className="absolute right-3 top-3 rounded-md p-1 text-pf-parchment/60 hover:text-pf-parchment/90"
      aria-label="Collapse hero"
    >
      <X className="h-4 w-4" />
    </button>
    {/* ... existing hero content ... */}
  </div>
)}
```

Make sure `X` is imported from `@phosphor-icons/react`.

**Step 3: Verify**

- First visit: hero shows with dismiss X button
- Click X: hero collapses to one-line bar, persists across reloads
- Click collapsed bar: hero re-expands

**Step 4: Run tests and commit**

Run: `npm run test:unit`

```bash
git add src/pages/Index.tsx
git commit -m "feat(ui): auto-collapse hero banner for returning users"
```

---

## Phase 8: Theme Differentiation (Critical — High Effort)

### Task 16: Increase standard/midnight theme contrast

**Context:** The two themes differ by only ~2% background lightness. Users perceive the toggle as broken.

This is the highest-effort task. Two options:

**Option A (recommended — medium effort):** Keep both themes dark but make midnight visually distinct with different accent colors and card styling.

**Option B (high effort):** Implement a true light theme.

This plan covers **Option A**.

**Files:**
- Modify: `src/styles/tokens.css:122-178` (midnight theme overrides)
- Modify: `src/styles/promptforge-fantasy.css` (add midnight-specific hero treatment)

**Step 1: Increase midnight theme depth and accent shift**

In `src/styles/tokens.css`, update the midnight theme section (lines 122-178):

```css
:root[data-theme="midnight"],
:root.dark,
:root.dark-mode {
  --background: 220 30% 3%;
  --foreground: 42 20% 92%;

  --card: 220 25% 8%;
  --card-foreground: 42 20% 92%;

  --popover: 220 25% 8%;
  --popover-foreground: 42 20% 92%;

  --primary: 174 90% 42%;
  --primary-foreground: 220 30% 3%;

  --secondary: 220 20% 14%;
  --secondary-foreground: 42 20% 92%;

  --muted: 220 18% 12%;
  --muted-foreground: 37 8% 72%;

  --accent: 174 60% 45%;
  --accent-foreground: 220 30% 3%;

  --destructive: 0 72% 51%;
  --destructive-foreground: 220 30% 3%;
  --destructive-strong: 0 70% 42%;

  --border: 220 18% 14%;
  --input: 220 18% 14%;
  --ring: 174 90% 42%;
```

Key changes:
- Background shifted from blue-gray (`213`) to cooler blue (`220`) and darker (3% vs 4%)
- Card backgrounds much darker (8% vs 12%) for more contrast with standard theme (15%)
- Accent shifted from warm gold to cool teal-green for a distinctly different personality
- Border/muted shifted to match the cooler hue
- Destructive shifted from orange to red for the midnight palette

**Step 2: Verify both themes**

Toggle between themes. Standard should feel warm-dark (navy, gold accents). Midnight should feel cool-dark (deep blue-black, teal accents). The difference should be immediately obvious.

**Step 3: Run the full check suite**

Run: `npm run check:prod`
Expected: All gates pass.

**Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(theme): differentiate midnight theme with cooler palette and darker depth"
```

---

## Phase 9: Remaining Polish (Minor)

### Task 17: Migrate remaining pf-* tokens to semantic tokens in sidebar

**Context:** The Quality signal card border uses `border-pf-gold/30` while other cards use `border-border/70`. This is the last remaining fantasy token in the sidebar layout.

**Files:**
- Modify: `src/pages/Index.tsx:2238`

**Step 1: Update card border class**

Find line ~2238:
```tsx
<Card className="pf-panel mb-3 border-pf-gold/30 bg-card/80 p-3">
```
Change to:
```tsx
<Card className="pf-panel mb-3 border-border/70 bg-card/80 p-3">
```

**Step 2: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "fix(tokens): replace pf-gold border with semantic border token in quality card"
```

---

### Task 18: Fix switch label association for Web lookup

**Context:** The "Web lookup" toggle uses a sibling `<generic>` for its label instead of a proper `<label>` element.

**Files:**
- Modify: `src/pages/Index.tsx` — find the desktop Web lookup switch (around line 2172-2177)

**Step 1: Wrap in a proper label**

Find the Web lookup switch in the desktop right column. It should already be inside a `<label>` or clickable container. If the label text is a sibling div, wrap it:

Ensure the pattern is:
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <Switch
    checked={webSearchEnabled}
    onCheckedChange={handleWebSearchToggle}
    disabled={isEnhancing}
    aria-label="Enable web search during enhancement"
  />
  <Globe className="h-3.5 w-3.5" />
  <span>Web lookup</span>
</label>
```

**Step 2: Run tests and commit**

```bash
git add src/pages/Index.tsx
git commit -m "fix(a11y): wrap web lookup switch in proper label element"
```

---

## Summary: Commit Sequence

| Task | Phase | Severity | Files Modified | Commit Message |
|------|-------|----------|---------------|----------------|
| 1 | 1 | Critical | tokens.css | bump muted-foreground for WCAG AA |
| 2 | 1 | Critical | Index.tsx | replace pf-parchment opacity with semantic tokens |
| 3 | 1 | Critical | base.css | improve focus ring visibility |
| 4 | 1 | Major | BuilderAdjustDetails, BuilderSourcesAdvanced | accordion trigger aria-labels |
| 5 | 2 | Major | BuilderAdjustDetails, ToneControls | ring accent on selected toggles |
| 6 | 2 | Minor | OutputPanel | disable locked buttons |
| 7 | 3 | Major | Index.tsx | collapse secondary sidebar cards |
| 8 | 3 | Minor | Index.tsx | remove duplicate tier label |
| 9 | 4 | Major | Index.tsx, PFQualityGauge | enlarge gauge, migrate colors |
| 10 | 5 | Major | BuilderHeroInput | shorten placeholder |
| 11 | 5 | Minor | BuilderHeroInput | clarify button labels |
| 12 | 5 | Minor | OutputPanel | remove badge quotation marks |
| 13 | 6 | Major | Index.tsx | simplify mobile sticky bar |
| 14 | 6 | Minor | Index.tsx | mobile score progress fill |
| 15 | 7 | Minor | Index.tsx | auto-collapse hero |
| 16 | 8 | Critical | tokens.css | differentiate midnight theme |
| 17 | 9 | Minor | Index.tsx | migrate pf-gold border |
| 18 | 9 | Minor | Index.tsx | wrap switch in label |

**Total: 18 tasks, 9 phases, 7 unique files.**
