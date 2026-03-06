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
});
