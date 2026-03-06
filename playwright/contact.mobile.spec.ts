import { expect, test } from "@playwright/test";

const MOBILE_WIDTHS = [320, 390, 428] as const;
const VIEWPORT_HEIGHT = 844;

test("keeps the contact form actionable above the mobile bottom nav", async ({ page }) => {
  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/contact");

    await expect(page.getByRole("heading", { name: "Get in touch" })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const checkbox = page.getByLabel("I agree to the privacy policy.");
    const privacyLabel = page.locator("label", { hasText: "I agree to the privacy policy." });
    await expect(checkbox).toBeVisible();
    await expect(privacyLabel).toBeVisible();

    const metrics = await page.evaluate(() => {
      const mobileNav = document.querySelector<HTMLElement>("[aria-label='Mobile navigation']");
      const submitButton = document.querySelector<HTMLElement>("button[type='submit']");
      const navRect = mobileNav?.getBoundingClientRect() || null;
      const submitRect = submitButton?.getBoundingClientRect() || null;

      return {
        bottomNavTop: navRect ? Math.round(navRect.top) : null,
        submitBottom: submitRect ? Math.round(submitRect.bottom) : null,
      };
    });

    expect(metrics.bottomNavTop, `width ${width} should render the mobile bottom nav`).not.toBeNull();
    expect(metrics.submitBottom, `width ${width} should render the contact submit button`).not.toBeNull();
    expect(
      metrics.submitBottom!,
      `width ${width} should keep the submit button above the mobile nav`,
    ).toBeLessThanOrEqual(metrics.bottomNavTop!);

    await privacyLabel.click();
    await expect(checkbox).toBeChecked();
  }
});
