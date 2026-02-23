import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const;

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  return Number.parseFloat(value) || 0;
}

test.describe("Typography guardrails", () => {
  test("builder typography stays readable on mobile and desktop", async ({ page }) => {
    for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const metrics = await page.evaluate(() => {
        const css = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          return {
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          };
        };

        return {
          body: (() => {
            const style = getComputedStyle(document.body);
            return { fontSize: style.fontSize, lineHeight: style.lineHeight };
          })(),
          heroTitle: css("[data-testid='builder-hero'] h1"),
          heroSubtitle: css("[data-testid='builder-hero'] > p"),
          promptLabel: css("label[for='builder-original-prompt']"),
          promptInput: css("#builder-original-prompt"),
        };
      });

      const isMobile = viewport.width < 640;
      const minBodySize = isMobile ? 14 : 16;
      const minSubtitleSize = isMobile ? 14 : 16;
      const minSubtitleLine = isMobile ? 20 : 24;

      expect(toNumber(metrics.body.fontSize)).toBeGreaterThanOrEqual(minBodySize);
      expect(toNumber(metrics.heroTitle?.fontSize)).toBeGreaterThanOrEqual(isMobile ? 24 : 30);
      expect(toNumber(metrics.heroSubtitle?.fontSize)).toBeGreaterThanOrEqual(minSubtitleSize);
      expect(toNumber(metrics.heroSubtitle?.lineHeight)).toBeGreaterThanOrEqual(minSubtitleLine);
      expect(toNumber(metrics.promptLabel?.fontSize)).toBeGreaterThanOrEqual(14);
      expect(toNumber(metrics.promptInput?.fontSize)).toBeGreaterThanOrEqual(16);
      expect(toNumber(metrics.promptInput?.lineHeight)).toBeGreaterThanOrEqual(24);
    }
  });

  test("community controls remain legible when feed data is unavailable", async ({ page }) => {
    for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
      await page.setViewportSize(viewport);
      await page.goto("/community");
      await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();

      const metrics = await page.evaluate(() => {
        const styleOf = (el: Element | null) => {
          if (!el) return null;
          const style = getComputedStyle(el);
          return {
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          };
        };

        const searchInput = document.querySelector("input[placeholder*='Search']");
        const trendingButton = Array.from(document.querySelectorAll("main button")).find((button) =>
          (button.textContent || "").toLowerCase().includes("trending"),
        );
        const helperMessage = Array.from(document.querySelectorAll("main p")).find((p) =>
          (p.textContent || "").toLowerCase().includes("permission denied"),
        );

        return {
          eyebrow: styleOf(document.querySelector("main .ui-section-label")),
          searchInput: styleOf(searchInput),
          trendingButton: styleOf(trendingButton ?? null),
          helperMessage: styleOf(helperMessage ?? null),
        };
      });

      expect(toNumber(metrics.eyebrow?.fontSize)).toBeGreaterThanOrEqual(12);
      expect(toNumber(metrics.searchInput?.fontSize)).toBeGreaterThanOrEqual(16);
      expect(toNumber(metrics.trendingButton?.fontSize)).toBeGreaterThanOrEqual(12);
      expect(toNumber(metrics.helperMessage?.fontSize)).toBeGreaterThanOrEqual(14);
    }
  });

  test("privacy prose keeps readable measure", async ({ page }) => {
    for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
      await page.setViewportSize(viewport);
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

      const metrics = await page.evaluate(() => {
        const firstParagraph = document.querySelector("main article.prose p");
        if (!firstParagraph) {
          return null;
        }

        const style = getComputedStyle(firstParagraph);
        const paragraphWidth = firstParagraph.getBoundingClientRect().width;
        const avgGlyphWidth = (Number.parseFloat(style.fontSize) || 16) * 0.52;
        const approxCharsPerLine = Math.round(paragraphWidth / avgGlyphWidth);

        return {
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          approxCharsPerLine,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) return;

      const isMobile = viewport.width < 640;
      expect(toNumber(metrics.fontSize)).toBeGreaterThanOrEqual(isMobile ? 14 : 16);
      expect(toNumber(metrics.lineHeight)).toBeGreaterThanOrEqual(isMobile ? 22 : 24);

      if (isMobile) {
        expect(metrics.approxCharsPerLine).toBeGreaterThanOrEqual(35);
        expect(metrics.approxCharsPerLine).toBeLessThanOrEqual(60);
      } else {
        expect(metrics.approxCharsPerLine).toBeGreaterThanOrEqual(45);
        expect(metrics.approxCharsPerLine).toBeLessThanOrEqual(75);
      }
    }
  });
});
