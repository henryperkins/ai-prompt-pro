import { expect, test } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 428] as const;
const VIEWPORT_HEIGHT = 900;

const SHOWCASE_CONTROLS = [
  { role: "button" as const, name: "Decrease progress" },
  { role: "button" as const, name: "Increase progress" },
  { role: "button" as const, name: "Reset progress" },
  { role: "radio" as const, name: "Icons" },
  { role: "radio" as const, name: "Numbers" },
  { role: "radio" as const, name: "All" },
  { role: "radio" as const, name: "Mentions" },
  { role: "button" as const, name: "Actions for Community Feed v2" },
  { role: "button" as const, name: "Save Community Feed v2" },
] as const;

test("keeps public design-system controls at or above 44px on mobile", async ({ page }) => {
  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/components-showcase");

    await expect(page.getByRole("heading", { name: "Untitled UI Component Showcase" })).toBeVisible();

    for (const control of SHOWCASE_CONTROLS) {
      const locator = page.getByRole(control.role, { name: control.name, exact: true });
      await locator.scrollIntoViewIfNeeded();
      await expect(locator, `width ${width}: "${control.name}" should be visible`).toBeVisible();

      const box = await locator.boundingBox();
      expect(box, `width ${width}: "${control.name}" should have a bounding box`).not.toBeNull();
      expect(box!.width, `width ${width}: "${control.name}" should be at least 44px wide`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `width ${width}: "${control.name}" should be at least 44px tall`).toBeGreaterThanOrEqual(44);
    }
  }
});
