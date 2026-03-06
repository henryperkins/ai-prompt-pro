import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-no-deprecated-ds-bridges-lib.mjs");
}

describe("check-no-deprecated-ds-bridges AST scanner", () => {
  it("detects deprecated bridge imports across import, export, mock, and dynamic import usage", async () => {
    const { collectForbiddenBridgeImportUsages } = await loadChecker();
    const source = `
      import { cn } from "@/lib/utils";
      export { cn as mergeClasses } from "@/lib/utils";
      vi.mock("@/lib/utils", () => ({}));
      await import("@/lib/utils");
    `;

    const violations = collectForbiddenBridgeImportUsages(source, "fixture.tsx");
    expect(violations.map((violation) => violation.kind)).toEqual(["import", "export", "mock", "dynamic-import"]);
  });

  it("allows canonical helper imports", async () => {
    const { collectForbiddenBridgeImportUsages } = await loadChecker();
    const source = `
      import { cx } from "@/lib/utils/cx";
      import { getInitials } from "@/lib/utils/get-initials";
    `;

    const violations = collectForbiddenBridgeImportUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });

  it("detects legacy classList dark compatibility alias usage", async () => {
    const { collectLegacyThemeClassCompatibilityUsages } = await loadChecker();
    const source = `
      document.documentElement.classList.toggle("dark", true);
      document.documentElement.classList.add("dark-mode");
      document.documentElement.classList.remove("dark");
    `;

    const violations = collectLegacyThemeClassCompatibilityUsages(source, "fixture.tsx");
    expect(violations.map((violation) => violation.value)).toEqual(["dark", "dark-mode", "dark"]);
  });

  it("detects legacy css selector aliases", async () => {
    const { collectLegacyThemeSelectorUsages } = await loadChecker();
    const source = `
      .dark .hero {}
      :root.dark-mode .panel {}
    `;

    const violations = collectLegacyThemeSelectorUsages(source, "fixture.css");
    expect(violations.map((violation) => violation.value)).toEqual([".dark", ".dark-mode"]);
  });

  it("detects style bridge import ownership violations", async () => {
    const { collectRestrictedStyleImportUsages } = await loadChecker();
    const source = `
      @import "./theme.css";
      @import "./untitled-compat.css";
      @import "./legacy-utility-tokens.css";
    `;

    const violations = collectRestrictedStyleImportUsages(source, "src/styles/components.css");
    expect(violations.map((violation) => violation.rule)).toEqual([
      "theme-import-owner",
      "untitled-compat-owner",
      "no-legacy-utility-import",
    ]);
  });

  it("allows ownership-compliant style bridge imports", async () => {
    const { collectRestrictedStyleImportUsages } = await loadChecker();

    const globalsSource = '@import "./theme.css";';
    const themeSource = '@import "./untitled-compat.css";';
    const shimSource = '@import "./untitled-compat.css";';

    expect(collectRestrictedStyleImportUsages(globalsSource, "src/styles/globals.css")).toHaveLength(0);
    expect(collectRestrictedStyleImportUsages(themeSource, "src/styles/theme.css")).toHaveLength(0);
    expect(collectRestrictedStyleImportUsages(shimSource, "src/styles/legacy-utility-tokens.css")).toHaveLength(0);
  });
});
