import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-no-arbitrary-typography-lib.mjs");
}

describe("check-no-arbitrary-typography AST scanner", () => {
  it("detects arbitrary text size, leading, and tracking utilities", async () => {
    const { collectArbitraryTypographyUsages } = await loadChecker();
    const source = `
      export const className = "text-[0.9375rem] leading-[1.375rem] sm:text-[1rem] tracking-[0.08em]";
    `;

    const violations = collectArbitraryTypographyUsages(source, "fixture.tsx");
    expect(violations.map((item) => item.value)).toEqual([
      "text-[0.9375rem]",
      "leading-[1.375rem]",
      "sm:text-[1rem]",
      "tracking-[0.08em]",
    ]);
  });

  it("ignores tokenized typography utilities", async () => {
    const { collectArbitraryTypographyUsages } = await loadChecker();
    const source = `
      export const className = "text-sm sm:text-base leading-relaxed type-label-caps text-2xs";
    `;

    const violations = collectArbitraryTypographyUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });

  it("ignores arbitrary text color utilities so color checks stay separate", async () => {
    const { collectArbitraryTypographyUsages } = await loadChecker();
    const source = `
      export const className = "text-[rgba(var(--pf-parchment-rgb)/0.95)] text-[hsl(var(--foreground))]";
    `;

    const violations = collectArbitraryTypographyUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });
});
