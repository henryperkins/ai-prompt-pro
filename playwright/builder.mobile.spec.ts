import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const MOBILE_WIDTHS = [360, 390, 428] as const;
const DEVTOOLS_MOBILE_WIDTHS = [320, 375, 390, 428] as const;
const VIEWPORT_HEIGHT = 900;
const DEVELOPER_TOOL_MENU_ITEMS = [
  "Copy Codex exec command",
  "Copy Codex TUI command",
  "Copy app server command",
  "Copy skill scaffold",
  "Download SKILL.md",
  "Download AGENTS.md",
  "Download AGENTS.override.md",
] as const;

interface BuilderMobileMetric {
  width: number;
  viewportHeight: number;
  hasHorizontalOverflow: boolean;
  stickyOverlapWithBottomNavPx: number;
  stickyControlsGapPx: number;
  controlsUnder44px: Array<{ testId: string; width: number; height: number }>;
}

test("captures Builder mobile sticky-bar ergonomics at 360-430px widths", async ({ page }, testInfo) => {
  const baseline: BuilderMobileMetric[] = [];

  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Turn basic prompts into production-ready instructions/i }),
    ).toBeVisible();
    await expect(page.getByTestId("builder-mobile-sticky-bar")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-preview-trigger")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-web-toggle")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-enhance-button")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid='builder-mobile-preview-trigger'], [data-testid='builder-mobile-web-toggle'], [data-testid='builder-mobile-enhance-button']",
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
      const webToggle = document.querySelector<HTMLElement>("[data-testid='builder-mobile-web-toggle']");
      const enhanceButton = document.querySelector<HTMLElement>("[data-testid='builder-mobile-enhance-button']");

      const stickyRect = sticky?.getBoundingClientRect() || null;
      const navRect = mobileNav?.getBoundingClientRect() || null;
      const webRect = webToggle?.getBoundingClientRect() || null;
      const enhanceRect = enhanceButton?.getBoundingClientRect() || null;

      const stickyOverlapWithBottomNavPx =
        stickyRect && navRect ? Math.max(0, Math.round(stickyRect.bottom - navRect.top)) : 0;
      const stickyControlsGapPx =
        webRect && enhanceRect ? Math.max(0, Math.round(enhanceRect.left - webRect.right)) : 0;

      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        stickyOverlapWithBottomNavPx,
        stickyControlsGapPx,
        controlsUnder44px,
      };
    });

    baseline.push({
      width,
      viewportHeight: VIEWPORT_HEIGHT,
      hasHorizontalOverflow: metrics.hasHorizontalOverflow,
      stickyOverlapWithBottomNavPx: metrics.stickyOverlapWithBottomNavPx,
      stickyControlsGapPx: metrics.stickyControlsGapPx,
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
      metric.stickyOverlapWithBottomNavPx,
      `width ${metric.width} has sticky controls overlapping bottom navigation`,
    ).toBe(0);
    expect(
      metric.stickyControlsGapPx,
      `width ${metric.width} needs more spacing between sticky toggle and enhance action`,
    ).toBeGreaterThanOrEqual(4);
  }
});

test("keeps Builder developer tools menu fully within mobile viewport", async ({ page }) => {
  for (const width of DEVTOOLS_MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");

    await page.getByRole("textbox", { name: "Your Prompt" }).fill("Plan a weekly engineering sync agenda");
    await page.getByTestId("builder-mobile-preview-trigger").click();

    const previewDialog = page.getByRole("dialog", { name: /Preview/i });
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
