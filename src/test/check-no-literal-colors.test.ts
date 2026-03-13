import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-no-literal-colors-lib.mjs");
}

describe("check-no-literal-colors AST scanner", () => {
  it("detects literal color functions in strings", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const className = "text-[rgba(230,225,213,.95)]";
      export const style = { textShadow: "0 2px 12px rgba(0,0,0,0.5)" };
    `;

    const violations = collectLiteralColorUsages(source, "fixture.tsx");
    expect(violations.map((item) => item.value)).toEqual([
      "rgba(230,225,213,.95)",
      "rgba(0,0,0,0.5)",
    ]);
  });

  it("detects direct hex color literals", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const stroke = "#D5D7DA";
    `;

    const violations = collectLiteralColorUsages(source, "fixture.ts");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.value).toBe("#D5D7DA");
  });

  it("detects raw Tailwind palette-scale utilities", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const className = "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    `;

    const violations = collectLiteralColorUsages(source, "fixture.tsx");
    expect(violations.map((item) => item.value)).toEqual([
      "border-emerald-500/30",
      "bg-emerald-500/10",
      "text-emerald-700",
      "dark:text-emerald-300",
    ]);
  });

  it("ignores var-based color functions and non-color hashes", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const className = "text-[rgba(var(--pf-parchment-rgb)/0.95)]";
      export const ring = "hsl(var(--ring))";
      export const label = "PR #482";
    `;

    const violations = collectLiteralColorUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });

  it("ignores semantic design-system color utilities and enum-like values", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const className = "border-border bg-success-primary text-fg-success-primary dark:text-foreground";
      export const tone = "blue-light";
    `;

    const violations = collectLiteralColorUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });

  it("ignores token-backed svg and filter color functions", async () => {
    const { collectLiteralColorUsages } = await loadChecker();
    const source = `
      export const glow = "drop-shadow(0 0 18px rgb(var(--pf-gold-rgb) / 0.35))";
      export const stopColor = "rgb(var(--pf-parchment-rgb) / 0.35)";
      export const stroke = "rgb(var(--pf-slate-rgb) / 0.65)";
    `;

    const violations = collectLiteralColorUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });
});
