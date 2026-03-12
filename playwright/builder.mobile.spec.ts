import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const MOBILE_WIDTHS = [360, 390, 428] as const;
const DEVTOOLS_MOBILE_WIDTHS = [320, 375, 390, 428] as const;
const VIEWPORT_HEIGHT = 900;
const AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;
const DEVELOPER_TOOL_MENU_ITEMS = [
  "Copy Codex exec command",
  "Copy Codex TUI command",
  "Copy app server command",
  "Copy skill scaffold",
  "Download SKILL.md",
  "Download AGENTS.md",
  "Download AGENTS.override.md",
  "Copy telemetry log (JSON)",
  "Download telemetry log",
  "Copy latest enhance session summary",
] as const;

const AUTH_USER = {
  id: "builder-viewer-1",
  aud: "authenticated",
  role: "authenticated",
  email: "builder-viewer@example.com",
  app_metadata: {
    provider: "email",
    providers: ["email"],
  },
  user_metadata: {
    display_name: "Taylor Builder",
    full_name: "Taylor Builder",
    avatar_url: null,
  },
  created_at: "2026-01-20T12:00:00.000Z",
};

const AUTH_SESSION = {
  access_token: "builder-auth-access-token",
  refresh_token: "builder-auth-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: AUTH_EXPIRES_AT,
  user: AUTH_USER,
};

interface BuilderMobileMetric {
  width: number;
  viewportHeight: number;
  hasHorizontalOverflow: boolean;
  stickyBarHeightPx: number;
  stickyOverlapWithBottomNavPx: number;
  stickySecondaryControlsGapPx: number;
  controlsUnder44px: Array<{ testId: string; width: number; height: number }>;
}

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

async function installBuilderAuthMocks(
  page: Page,
  { authenticated = false }: { authenticated?: boolean } = {},
): Promise<void> {
  const authUser = authenticated ? AUTH_USER : null;
  const authSession = authenticated ? AUTH_SESSION : null;

  await page.route("**/auth/get-session", async (route) => {
    await fulfillJson(route, { session: authSession, user: authUser });
  });

  await page.route("**/auth/token/anonymous", async (route) => {
    await fulfillJson(route, {
      token: "header.payload.signature",
      expires_at: AUTH_EXPIRES_AT,
    });
  });

  await page.route("**/auth/v1/user", async (route) => {
    if (!authenticated) {
      await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
      return;
    }
    await fulfillJson(route, { user: authUser });
  });

  await page.route("**/auth/get-user", async (route) => {
    if (!authenticated) {
      await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
      return;
    }
    await fulfillJson(route, { user: authUser });
  });

  await page.route("**/rest/v1/drafts**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "HEAD") {
      await fulfillJson(route, null);
      return;
    }
    await fulfillJson(route, []);
  });

  await page.route("**/rest/v1/saved_prompts**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });

  await page.route("**/rest/v1/community_posts**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });

  await page.route("**/rest/v1/prompt_versions**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });
}

test("captures Builder mobile sticky-bar ergonomics at 360-430px widths", async ({ page }, testInfo) => {
  const baseline: BuilderMobileMetric[] = [];

  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");

    await expect(
      page.getByRole("textbox", { name: /What should the model do\?/i }),
    ).toBeVisible();
    await expect(page.getByTestId("builder-mobile-sticky-bar")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-preview-trigger")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-settings-trigger")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-enhance-button")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid='builder-mobile-preview-trigger'], [data-testid='builder-mobile-settings-trigger'], [data-testid='builder-mobile-enhance-button']",
        ),
      );
      const controlsUnder44px = controls
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            testId: element.dataset.testid || element.getAttribute("role") || "unknown",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((entry) => entry.width < 44 || entry.height < 44);

      const sticky = document.querySelector<HTMLElement>("[data-testid='builder-mobile-sticky-bar']");
      const mobileNav = document.querySelector<HTMLElement>("[aria-label='Mobile navigation']");
      const previewTrigger = document.querySelector<HTMLElement>("[data-testid='builder-mobile-preview-trigger']");
      const settingsTrigger = document.querySelector<HTMLElement>("[data-testid='builder-mobile-settings-trigger']");
      const enhanceButton = document.querySelector<HTMLElement>("[data-testid='builder-mobile-enhance-button']");

      const stickyRect = sticky?.getBoundingClientRect() || null;
      const navRect = mobileNav?.getBoundingClientRect() || null;
      const previewRect = previewTrigger?.getBoundingClientRect() || null;
      const settingsRect = settingsTrigger?.getBoundingClientRect() || null;

      const stickyOverlapWithBottomNavPx =
        stickyRect && navRect ? Math.max(0, Math.round(stickyRect.bottom - navRect.top)) : 0;
      const stickyBarHeightPx = stickyRect ? Math.round(stickyRect.height) : 0;
      const stickySecondaryControlsGapPx =
        previewRect && settingsRect ? Math.max(0, Math.round(settingsRect.left - previewRect.right)) : 0;

      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        stickyBarHeightPx,
        stickyOverlapWithBottomNavPx,
        stickySecondaryControlsGapPx,
        controlsUnder44px,
      };
    });

    baseline.push({
      width,
      viewportHeight: VIEWPORT_HEIGHT,
      hasHorizontalOverflow: metrics.hasHorizontalOverflow,
      stickyBarHeightPx: metrics.stickyBarHeightPx,
      stickyOverlapWithBottomNavPx: metrics.stickyOverlapWithBottomNavPx,
      stickySecondaryControlsGapPx: metrics.stickySecondaryControlsGapPx,
      controlsUnder44px: metrics.controlsUnder44px,
    });

    await page.screenshot({
      path: testInfo.outputPath(`builder-mobile-${width}.png`),
      fullPage: true,
    });
  }

  const baselinePath = testInfo.outputPath("builder-mobile-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("builder-mobile-baseline", {
    path: baselinePath,
    contentType: "application/json",
  });

  expect(baseline).toHaveLength(MOBILE_WIDTHS.length);
  for (const metric of baseline) {
    expect(metric.hasHorizontalOverflow, `width ${metric.width} should not overflow horizontally`).toBeFalsy();
    expect(metric.controlsUnder44px, `width ${metric.width} has controls below 44px`).toEqual([]);
    expect(
      metric.stickyBarHeightPx,
      `width ${metric.width} sticky bar should stay compact enough to preserve builder space`,
    ).toBeLessThanOrEqual(136);
    expect(
      metric.stickyOverlapWithBottomNavPx,
      `width ${metric.width} has sticky controls overlapping bottom navigation`,
    ).toBe(0);
    expect(
      metric.stickySecondaryControlsGapPx,
      `width ${metric.width} needs more spacing between preview and settings controls`,
    ).toBeGreaterThanOrEqual(4);
  }
});

test("lets mobile users change enhancement settings before running enhance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();
  await expect(page.getByTestId("builder-mobile-settings-trigger")).toBeVisible();

  await page.getByTestId("builder-mobile-settings-trigger").click();

  const settingsSheet = page.getByTestId("builder-mobile-settings-sheet");
  await expect(settingsSheet).toBeVisible();
  await expect(page.getByTestId("builder-mobile-settings-sheet-summary")).toContainText(
    "Structured rewrite · Balanced · Infer conservatively",
  );

  await settingsSheet.getByRole("button", { name: "Expert prompt" }).click();
  await settingsSheet.getByRole("button", { name: "Preserve wording" }).click();
  await settingsSheet.getByRole("button", { name: "Ask me" }).click();

  await expect(page.getByTestId("builder-mobile-settings-sheet-summary")).toContainText(
    "Expert prompt · Preserve wording · Ask me",
  );

  await settingsSheet.getByRole("button", { name: "Done" }).click();

  await page
    .getByRole("textbox", { name: /What should the model do\?|Your Prompt/i })
    .fill("Rewrite this rough prompt into an expert instruction set");
  await page.getByTestId("builder-mobile-preview-trigger").click();

  const previewDialog = page.getByRole("dialog", {
    name: /Built Prompt|Enhanced Prompt|Preview/i,
  });
  await expect(previewDialog).toBeVisible();
  await expect(
    page.getByTestId("output-panel-enhancement-settings-summary"),
  ).toContainText("Expert prompt · Preserve wording · Ask me");
});

test("lets signed-in mobile users open the Codex session drawer from settings and keep carry-forward edits", async ({
  page,
}) => {
  await installBuilderAuthMocks(page, { authenticated: true });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();

  await page.getByTestId("builder-mobile-settings-trigger").click();

  const settingsSheet = page.getByTestId("builder-mobile-settings-sheet");
  await expect(settingsSheet).toBeVisible();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-section"),
  ).toBeVisible();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-summary"),
  ).toContainText(
    "Open the drawer to add supplemental context before the next enhancement pass.",
  );

  await settingsSheet.getByRole("button", { name: "Open session" }).click();

  const contextSummary = page.getByLabel("Outside context summary");
  const carryForwardPrompt = page.getByLabel("Carry-forward prompt");
  await expect(contextSummary).toBeVisible();
  await expect(carryForwardPrompt).toBeVisible();

  await contextSummary.fill(
    "Bring in the launch brief, beta feedback, and the legal review notes.",
  );
  await carryForwardPrompt.fill(
    "Carry forward the partner launch prompt with the revised compliance guardrails.",
  );

  await page.getByRole("button", { name: "Done" }).click();
  await expect(contextSummary).toHaveCount(0);

  await page.getByTestId("builder-mobile-settings-trigger").click();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-summary"),
  ).toContainText("Outside context is ready to carry into the next Codex turn.");

  await settingsSheet.getByRole("button", { name: "Open session" }).click();
  await expect(contextSummary).toHaveValue(
    "Bring in the launch brief, beta feedback, and the legal review notes.",
  );
  await expect(carryForwardPrompt).toHaveValue(
    "Carry forward the partner launch prompt with the revised compliance guardrails.",
  );
});

test("keeps adjust details progressive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Show advanced controls" }).click();

  const adjustDetails = page.getByRole("button", { name: "Adjust details" });
  const roleGroup = page.getByRole("button", { name: "Role and voice" });
  const outputGroup = page.getByRole("button", { name: "Output shape" });

  await adjustDetails.click();

  await expect(roleGroup).toHaveAttribute("aria-expanded", "true");
  await expect(outputGroup).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Custom role")).toBeVisible();
  await expect(page.getByLabel("Custom format")).toHaveCount(0);

  await outputGroup.click();
  await expect(outputGroup).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Custom format")).toBeVisible();

  await page.getByRole("button", { name: "Professional" }).click();
  await adjustDetails.click();

  await expect(page.getByText(/Professional tone/i)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBeFalsy();
});

test("keeps Builder developer tools menu fully within mobile viewport", async ({ page }) => {
  for (const width of DEVTOOLS_MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: /What should the model do\?/i }),
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: /What should the model do\?|Your Prompt/i })
      .fill("Plan a weekly engineering sync agenda");
    await page.getByTestId("builder-mobile-preview-trigger").click();

    const previewDialog = page.getByRole("dialog", {
      name: /Built Prompt|Enhanced Prompt|Preview/i,
    });
    await expect(previewDialog).toBeVisible();

    await previewDialog.getByRole("button", { name: "More" }).click();
    await expect(page.getByText("Developer tools")).toBeVisible();

    for (const itemLabel of DEVELOPER_TOOL_MENU_ITEMS) {
      const item = page.getByRole("menuitem", { name: itemLabel });
      await expect(item, `width ${width}: "${itemLabel}" should be visible`).toBeVisible();

      const box = await item.boundingBox();
      expect(box, `width ${width}: "${itemLabel}" should have a bounding box`).not.toBeNull();
      expect(box!.x, `width ${width}: "${itemLabel}" should not overflow left`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `width ${width}: "${itemLabel}" should not overflow right`,
      ).toBeLessThanOrEqual(width);
    }

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
});
