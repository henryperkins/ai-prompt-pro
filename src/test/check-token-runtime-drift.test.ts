import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-token-runtime-drift-lib.mjs");
}

describe("check-token-runtime-drift scanner", () => {
  it("collects semantic, pf-token, legacy utility, and arbitrary var-backed classes", async () => {
    const { collectTokenRuntimeClasses } = await loadChecker();
    const source = `
      const classes = [
        "border-border/80 bg-card/90 text-foreground",
        "hover:text-pf-parchment/90 ring-pf-gold/70 shadow-[0_0_18px_rgba(var(--pf-arcane-rgb)/0.18)]",
        "from-primary/10 via-card to-card/85",
        "bg-utility-success-50 text-error-primary",
      ];
    `;

    expect(collectTokenRuntimeClasses(source, "fixture.tsx")).toEqual([
      "bg-card/90",
      "bg-utility-success-50",
      "border-border/80",
      "from-primary/10",
      "hover:text-pf-parchment/90",
      "ring-pf-gold/70",
      "shadow-[0_0_18px_rgba(var(--pf-arcane-rgb)/0.18)]",
      "text-error-primary",
      "text-foreground",
      "to-card/85",
      "via-card",
    ]);
  });

  it("ignores non-token layout utilities and embedded code sample strings", async () => {
    const { collectTokenRuntimeClasses } = await loadChecker();
    const source = `
      const state = "flex h-11 rounded-lg text-center shadow-lg";
      const snippets = [
        {
          code: \`<div className="bg-card/90 text-foreground">Example</div>\`,
        },
      ];
      const semantic = "text-md border-transparent placeholder:text-muted-foreground";
    `;

    expect(collectTokenRuntimeClasses(source, "fixture.tsx")).toEqual([
      "placeholder:text-muted-foreground",
      "text-md",
    ]);
  });

  it("matches escaped selectors in built css and reports missing classes", async () => {
    const { escapeCssClassSelector, findMissingTokenRuntimeClasses, hasClassSelectorInCss } = await loadChecker();
    const builtCss = [
      `.${escapeCssClassSelector("bg-card/90")}{}`,
      `.${escapeCssClassSelector("hover:text-pf-parchment/90")}:hover{}`,
      `.${escapeCssClassSelector("shadow-[0_0_18px_rgba(var(--pf-arcane-rgb)/0.18)]")}{}`,
    ].join("\n");

    expect(hasClassSelectorInCss("hover:text-pf-parchment/90", builtCss)).toBe(true);
    expect(
      findMissingTokenRuntimeClasses(
        [
          "bg-card/90",
          "hover:text-pf-parchment/90",
          "shadow-[0_0_18px_rgba(var(--pf-arcane-rgb)/0.18)]",
          "ring-pf-gold/70",
        ],
        builtCss,
      ),
    ).toEqual(["ring-pf-gold/70"]);
  });
});
