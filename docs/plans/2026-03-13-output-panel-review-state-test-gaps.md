# Output Panel Review-State Test Gaps Remediation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five confirmed gaps from the uncommitted output-panel review-state refactor before merging.

**Architecture:** Two required fixes (archived-workflow test gap, desktop Playwright functional E2E) and three low-risk cleanups (dead code removal, banner rendering test, tone type consolidation). Each task is independent and can run in parallel.

**Tech Stack:** Vitest + React Testing Library (unit), Playwright (E2E), TypeScript

---

## Chunk 1: Required Fixes

### Task 1: Add `archivedEnhanceWorkflow` test coverage

The integration mock in `index-enhancement-staleness.test.tsx` does not destructure or render `archivedEnhanceWorkflow`, so the prop pass-through from `Index.tsx` is completely untested. The component test in `output-panel-phase2.test.tsx` passes the prop but only checks the accordion *exists* — it never opens it or checks the step content. If either layer broke, no test would fail.

**Files:**
- Modify: `src/test/index-enhancement-staleness.test.tsx:79-143` (mock) and `458-500` (test)
- Modify: `src/test/output-panel-phase2.test.tsx:669-713` (test)

- [ ] **Step 1: Add `archivedEnhanceWorkflow` to the integration mock**

In `src/test/index-enhancement-staleness.test.tsx`, add the missing prop to the `OutputPanel` mock destructure (around line 92) and render it as a testable div (around line 140):

```tsx
// Add to the destructured props (after archivedWebSearchSources on line 92):
    archivedEnhanceWorkflow,

// Add to the type annotation (after archivedWebSearchSources on line 108):
    archivedEnhanceWorkflow?: Array<{ stepId: string; label: string }>;

// Add a new test div (after line 140, before </div>):
      <div data-testid="archived-workflow-prop">
        {(archivedEnhanceWorkflow || []).map((s) => s.label).join("|")}
      </div>
```

- [ ] **Step 2: Add assertion to the "passes archived artifacts" test**

In `src/test/index-enhancement-staleness.test.tsx`, add to the "passes archived artifacts" test (after the `archived-sources-prop` assertion around line 497):

```tsx
    expect(screen.getByTestId("archived-workflow-prop")).toHaveTextContent("");
```

Wait — the mock `streamEnhance` does not emit workflow events, so `enhanceWorkflow` in `Index.tsx` stays empty `[]`, meaning the archived version will also be `[]`. We need to also emit a workflow event in the mock to have data to archive.

Add a workflow event emission to the `streamEnhance` mock in the `beforeEach` (after the `enhance/metadata` event around line 288):

```tsx
        onEvent?.({
          eventType: "enhance/workflow",
          responseType: "enhance.workflow",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_workflow_1",
          itemType: "message",
          payload: {
            event: "enhance/workflow",
            type: "enhance.workflow",
            payload: {
              step_id: "draft",
              order: 10,
              label: "Analyze request",
              status: "completed",
              detail: "Draft analysis complete.",
            },
          },
        });
```

Then update the "passes archived artifacts" test assertions (around line 497):

```tsx
    // Archived workflow should carry the settled workflow steps
    expect(screen.getByTestId("archived-workflow-prop")).toHaveTextContent(
      "Analyze request",
    );
```

- [ ] **Step 3: Run the test to verify the integration assertion passes**

Run: `npx vitest run src/test/index-enhancement-staleness.test.tsx`
Expected: All tests pass including the new archived-workflow assertion.

If the test fails because `Index.tsx` does not process `enhance/workflow` events into the `enhanceWorkflow` state array, investigate `src/pages/Index.tsx` to find the event handler that populates `enhanceWorkflow` and trace whether the mock event shape matches.

- [ ] **Step 4: Strengthen the component-level archived-workflow test**

In `src/test/output-panel-phase2.test.tsx`, extend the "shows archived detail sections in stale state" test (after line 712) to open the run-progress accordion and verify the archived workflow step renders:

```tsx
    // Open the run-progress accordion and verify archived workflow step content
    fireEvent.click(screen.getByTestId("output-panel-details-run-progress-trigger"));
    expect(screen.getByText("Analyze request")).toBeInTheDocument();
    expect(screen.getByText("Archived reasoning summary")).toBeInTheDocument();
```

- [ ] **Step 5: Run the component test to verify**

Run: `npx vitest run src/test/output-panel-phase2.test.tsx`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/test/index-enhancement-staleness.test.tsx src/test/output-panel-phase2.test.tsx
git commit -m "test: close archivedEnhanceWorkflow coverage gap in staleness and phase2 tests"
```

---

### Task 2: Restore functional desktop Playwright E2E coverage

The old `builder.desktop.spec.ts` tested authenticated sessions, `infer-builder-fields` mock, suggestion chip overlap, adjust-details with long role text, and role-summary truncation bounds. The rewrite replaced all of this with a layout-geometry-only test. No other Playwright spec covers these desktop functional scenarios.

The mobile spec already has a reusable `installBuilderAuthMocks` helper and a `fulfillJson` utility. The desktop spec should reuse the same pattern rather than duplicating the mock infrastructure.

**Files:**
- Modify: `playwright/builder.desktop.spec.ts`
- Reference: `playwright/builder.mobile.spec.ts:57-125` (auth mock pattern)

- [ ] **Step 1: Add auth mock infrastructure to the desktop spec**

Add imports and the same `fulfillJson` + `installBuilderDesktopMocks` helper to `playwright/builder.desktop.spec.ts`. The desktop helper needs the same auth/data routes as mobile, plus the `infer-builder-fields` mock.

Merge `Page` and `Route` into the existing import on line 2, then add the mock infrastructure before the `DESKTOP_VIEWPORTS` constant:

```typescript
// Line 2 — replace the existing import:
import { expect, test, type Page, type Route } from "@playwright/test";

const AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

const AUTH_USER = {
  id: "builder-desktop-1",
  aud: "authenticated",
  role: "authenticated",
  email: "builder-desktop@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {
    display_name: "Taylor Builder",
    full_name: "Taylor Builder",
    avatar_url: null,
  },
  created_at: "2026-01-20T12:00:00.000Z",
};

const AUTH_SESSION = {
  access_token: "builder-desktop-access-token",
  refresh_token: "builder-desktop-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: AUTH_EXPIRES_AT,
  user: AUTH_USER,
};

function fulfillJson(
  route: Route,
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(payload),
  });
}

async function installBuilderDesktopMocks(page: Page): Promise<void> {
  await page.route("**/auth/get-session", (route) =>
    fulfillJson(route, { session: AUTH_SESSION, user: AUTH_USER }),
  );
  await page.route("**/auth/token/anonymous", (route) =>
    fulfillJson(route, { token: "header.payload.signature", expires_at: AUTH_EXPIRES_AT }),
  );
  await page.route("**/auth/v1/user", (route) =>
    fulfillJson(route, { user: AUTH_USER }),
  );
  await page.route("**/auth/get-user", (route) =>
    fulfillJson(route, { user: AUTH_USER }),
  );
  await page.route("**/rest/v1/drafts**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "HEAD") {
      await fulfillJson(route, null);
      return;
    }
    await fulfillJson(route, []);
  });
  await page.route("**/rest/v1/saved_prompts**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/rest/v1/community_posts**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/rest/v1/prompt_versions**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/infer-builder-fields", (route) =>
    fulfillJson(route, {
      inferredUpdates: {},
      inferredFields: [],
      suggestionChips: [
        {
          id: "append-evidence",
          label: "Add evidence requirements",
          description: "What should back the claims?",
          action: {
            type: "append_prompt",
            text: "\nEvidence: [cite sources, use data, include examples]",
          },
        },
        {
          id: "append-comparison-framework",
          label: "Add comparison framework",
          description: "Define the baseline, segments, or time periods to compare.",
          action: {
            type: "append_prompt",
            text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
          },
        },
      ],
    }),
  );
}
```

- [ ] **Step 2: Add the functional authenticated desktop test**

Append a new test after the existing layout geometry test:

```typescript
const LONG_ROLE =
  "Senior UX auditor and design systems strategist for AI-assisted product experiences";

test("builder desktop smart suggestions and detail summaries stay within layout bounds", async ({
  page,
}) => {
  await installBuilderDesktopMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const prompt = page.getByRole("textbox", {
    name: /What should the model do\?/i,
  });
  await expect(prompt).toBeVisible();

  await prompt.fill(
    "Review the prompt builder interface, compare the visible flows, and summarize the highest-impact UX improvements.",
  );

  const comparisonSuggestion = page.getByTestId(
    "builder-suggestion-chip-append-comparison-framework",
  );
  await expect(comparisonSuggestion).toBeVisible();
  await expect(
    page.getByTestId("builder-suggestion-chip-append-evidence"),
  ).toBeVisible();

  const showAdvancedControls = page.getByRole("button", {
    name: "Show advanced controls",
  });
  if (await showAdvancedControls.isVisible()) {
    await showAdvancedControls.click();
  }

  const adjustDetails = page.getByRole("button", { name: "Adjust details" });
  await expect(adjustDetails).toBeVisible();
  await adjustDetails.click();

  const customRole = page.getByLabel("Custom role");
  await expect(customRole).toBeVisible();
  await customRole.fill(LONG_ROLE);

  await adjustDetails.click();
  await expect(
    page.getByTestId("builder-adjust-details-selected-role"),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const suggestionButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid^='builder-suggestion-chip-']",
      ),
    );
    const roleSummary = document.querySelector<HTMLElement>(
      "[data-testid='builder-adjust-details-selected-role']",
    );
    const adjustTrigger = roleSummary?.closest("button");
    const overlapPairs: string[] = [];

    const rects = suggestionButtons.map((button) => ({
      id: button.dataset.testid ?? "unknown",
      rect: button.getBoundingClientRect(),
    }));

    for (let index = 0; index < rects.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < rects.length; otherIndex += 1) {
        const current = rects[index];
        const other = rects[otherIndex];
        const overlaps =
          current.rect.left < other.rect.right &&
          current.rect.right > other.rect.left &&
          current.rect.top < other.rect.bottom &&
          current.rect.bottom > other.rect.top;
        if (overlaps) {
          overlapPairs.push(`${current.id}::${other.id}`);
        }
      }
    }

    const roleRect = roleSummary?.getBoundingClientRect() ?? null;
    const triggerRect = adjustTrigger?.getBoundingClientRect() ?? null;

    return {
      buttonCount: suggestionButtons.length,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > window.innerWidth,
      overlapPairs,
      roleSummaryClientWidth: roleSummary?.clientWidth ?? 0,
      roleSummaryScrollWidth: roleSummary?.scrollWidth ?? 0,
      roleSummaryEscapesTrigger: Boolean(
        roleRect &&
          triggerRect &&
          roleRect.right > triggerRect.right - 24,
      ),
    };
  });

  expect(metrics.buttonCount).toBe(2);
  expect(metrics.hasHorizontalOverflow).toBeFalsy();
  expect(metrics.overlapPairs).toEqual([]);
  expect(metrics.roleSummaryScrollWidth).toBeGreaterThan(
    metrics.roleSummaryClientWidth,
  );
  expect(metrics.roleSummaryEscapesTrigger).toBeFalsy();
});
```

- [ ] **Step 3: Run the Playwright desktop spec locally**

Run: `npx playwright test playwright/builder.desktop.spec.ts --headed`
Expected: Both tests pass — the existing layout geometry test and the new functional test.

If the functional test fails on selector lookup (e.g., `builder-suggestion-chip-*` or `builder-adjust-details-selected-role`), check whether those test IDs still exist in the current component code via `grep -r "builder-suggestion-chip" src/` and `grep -r "builder-adjust-details-selected-role" src/`. Adjust selectors to match current markup.

- [ ] **Step 4: Commit**

```bash
git add playwright/builder.desktop.spec.ts
git commit -m "test: restore functional authenticated desktop Playwright E2E coverage"
```

---

## Chunk 2: Cleanup Fixes

### Task 3: Remove dead `"Copy preview"` branch

`copyLabel` is set to `"Copy preview"` when `!hasPreviewContent`, but `copyLabel` is only consumed by `OutputPanelHeader` which only renders when `showUtilityActions` is true — and `showUtilityActions = hasPreviewContent`. The conditions are mutually exclusive in the same synchronous render. The `"Copy preview"` string is provably unreachable.

**Files:**
- Modify: `src/components/OutputPanel.tsx:295-299`

- [ ] **Step 1: Simplify the `copyLabel` ternary**

In `src/components/OutputPanel.tsx`, replace lines 295-299:

```typescript
  const copyLabel = !hasPreviewContent
    ? "Copy preview"
    : isTransientPhase || isSettledEnhancedOutput
      ? "Copy current output"
      : "Copy draft";
```

With:

```typescript
  const copyLabel =
    isTransientPhase || isSettledEnhancedOutput
      ? "Copy current output"
      : "Copy draft";
```

- [ ] **Step 2: Run existing tests to confirm no regressions**

Run: `npx vitest run src/test/output-panel-phase2.test.tsx`
Expected: All 22 tests pass. No test references "Copy preview".

- [ ] **Step 3: Commit**

```bash
git add src/components/OutputPanel.tsx
git commit -m "fix: remove unreachable Copy preview branch in copyLabel"
```

---

### Task 4: Add `OutputPanelStateBanner` rendering test

The pure function `getOutputPanelReviewState` has 12 test cases, but the banner component's tone→CSS class mapping, `data-state` attribute, conditional `statusLabel` chip, and `nextAction` rendering are never tested directly or indirectly.

**Files:**
- Create: `src/test/output-panel-state-banner.test.tsx`
- Reference: `src/components/OutputPanelStateBanner.tsx`
- Reference: `src/lib/ui-status.ts`

- [ ] **Step 1: Write the banner rendering test**

Create `src/test/output-panel-state-banner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutputPanelStateBanner } from "@/components/OutputPanelStateBanner";

describe("OutputPanelStateBanner", () => {
  it("renders title, description, source label, and nextAction", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="The visible text comes from the current builder inputs."
        previewSourceLabel="Built prompt"
        nextAction="Copy the draft as-is, or run Enhance to compare an AI rewrite."
        tone="info"
        stateKey="draft"
      />,
    );

    expect(screen.getByText("Draft preview")).toBeInTheDocument();
    expect(
      screen.getByText("The visible text comes from the current builder inputs."),
    ).toBeInTheDocument();
    expect(screen.getByText("Source: Built prompt")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Copy the draft as-is, or run Enhance to compare an AI rewrite.",
      ),
    ).toBeInTheDocument();
  });

  it("sets data-state attribute to the stateKey", () => {
    render(
      <OutputPanelStateBanner
        title="Builder changed after enhancement"
        description="Re-run Enhance."
        previewSourceLabel="Built prompt"
        tone="warning"
        stateKey="stale"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner).toHaveAttribute("data-state", "stale");
  });

  it("applies warning tone classes from ui-status", () => {
    render(
      <OutputPanelStateBanner
        title="Builder changed after enhancement"
        description="Re-run Enhance."
        previewSourceLabel="Built prompt"
        tone="warning"
        stateKey="stale"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-utility-warning-200");
    expect(banner.className).toContain("bg-utility-warning-50");
  });

  it("applies success tone classes for ready state", () => {
    render(
      <OutputPanelStateBanner
        title="Enhanced output ready"
        description="The run is complete."
        previewSourceLabel="Enhanced output"
        tone="success"
        stateKey="ready"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-utility-success-200");
    expect(banner.className).toContain("bg-utility-success-50");
  });

  it("applies info tone classes by default", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="Current inputs."
        previewSourceLabel="Built prompt"
        stateKey="draft"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-primary/30");
    expect(banner.className).toContain("bg-primary/10");
  });

  it("renders statusLabel chip when provided", () => {
    render(
      <OutputPanelStateBanner
        title="Enhancing"
        description="AI is rewriting."
        previewSourceLabel="Enhanced output"
        statusLabel="Streaming"
        tone="info"
        stateKey="enhancing"
      />,
    );

    expect(screen.getByText("Status: Streaming")).toBeInTheDocument();
  });

  it("omits statusLabel chip when null", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="Current inputs."
        previewSourceLabel="Built prompt"
        statusLabel={null}
        stateKey="draft"
      />,
    );

    expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
  });

  it("omits nextAction paragraph when not provided", () => {
    render(
      <OutputPanelStateBanner
        title="No preview yet"
        description="Start writing."
        previewSourceLabel="No preview yet"
        stateKey="empty"
      />,
    );

    expect(screen.queryByText("Next:")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new test**

Run: `npx vitest run src/test/output-panel-state-banner.test.tsx`
Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/test/output-panel-state-banner.test.tsx
git commit -m "test: add OutputPanelStateBanner rendering tests for tone, data-state, and conditional chips"
```

---

### Task 5: Consolidate tone type declarations

`OutputPanelStateTone` is declared locally in `OutputPanelStateBanner.tsx:8` and identically as `OutputPanelReviewStateTone` in `output-panel-review-state.ts:6`. Not a correctness bug, but a DRY violation — the banner should import the type from the canonical source.

**Files:**
- Modify: `src/components/OutputPanelStateBanner.tsx:1-8`
- Reference: `src/lib/output-panel-review-state.ts:6`

- [ ] **Step 1: Replace the local type with the imported one**

In `src/components/OutputPanelStateBanner.tsx`, remove line 8:

```typescript
type OutputPanelStateTone = "info" | "success" | "warning";
```

And add the import at the top (after line 1):

```typescript
import type { OutputPanelReviewStateTone } from "@/lib/output-panel-review-state";
```

Then update the interface (line 16) from:

```typescript
  tone?: OutputPanelStateTone;
```

To:

```typescript
  tone?: OutputPanelReviewStateTone;
```

- [ ] **Step 2: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run src/test/output-panel-state-banner.test.tsx src/test/output-panel-phase2.test.tsx`
Expected: Type check passes, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/OutputPanelStateBanner.tsx
git commit -m "refactor: import OutputPanelReviewStateTone instead of redeclaring local tone type"
```

---

## Verification Gate

After all five tasks are complete, run the full pre-merge gate:

```bash
npm run check:prod
```

Expected: All gates pass (docs-freshness, design-system gates, lint, test:unit, build, token-runtime).
