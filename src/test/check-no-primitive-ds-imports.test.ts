import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-no-primitive-ds-imports-lib.mjs");
}

describe("check-no-primitive-ds-imports AST scanner", () => {
  it("detects multiline import declarations", async () => {
    const { collectForbiddenModulePathUsages } = await loadChecker();
    const source = `
      import {
        Select,
        SelectContent,
      } from "@/components/base/primitives/select";
    `;

    const violations = collectForbiddenModulePathUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: "import",
      specifier: "@/components/base/primitives/select",
    });
  });

  it("detects vi.mock and jest.mock module paths", async () => {
    const { collectForbiddenModulePathUsages } = await loadChecker();
    const source = `
      vi.mock("@/components/base/primitives/button", () => ({}));
      jest.mock("@/components/base/primitives/badge", () => ({}));
    `;

    const violations = collectForbiddenModulePathUsages(source, "fixture.test.tsx");
    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.kind)).toEqual(["mock", "mock"]);
    expect(violations.map((violation) => violation.specifier)).toEqual([
      "@/components/base/primitives/button",
      "@/components/base/primitives/badge",
    ]);
  });

  it("detects export-from and dynamic imports", async () => {
    const { collectForbiddenModulePathUsages } = await loadChecker();
    const source = `
      export { Button } from "@/components/base/primitives/button";
      await import("@/components/base/primitives/input");
    `;

    const violations = collectForbiddenModulePathUsages(source, "fixture.ts");
    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.kind)).toEqual(["export", "dynamic-import"]);
  });

  it("ignores non-forbidden module paths", async () => {
    const { collectForbiddenModulePathUsages } = await loadChecker();
    const source = `
      import { Button } from "@/components/base/buttons/button";
      vi.mock("@/components/base/badges/badges", () => ({}));
    `;

    const violations = collectForbiddenModulePathUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });
});
