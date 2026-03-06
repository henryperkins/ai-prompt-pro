import { describe, expect, it } from "vitest";

async function loadChecker() {
  return import("../../scripts/check-no-duplicate-ds-entrypoints-lib.mjs");
}

describe("check-no-duplicate-ds-entrypoints", () => {
  it("flags deprecated duplicate entrypoint imports", async () => {
    const checker = await loadChecker();
    const source = `
      import { Label } from "@/components/base/input/label";
      import { TextArea } from "@/components/base/textarea/textarea";
      export { Card } from "@/components/base/primitives/card";
      await import("@/components/base/primitives/drawer");
    `;

    const violations = checker.collectForbiddenDesignSystemEntrypointUsages(source, "fixture.tsx");
    expect(violations.map((item) => item.specifier)).toEqual([
      "@/components/base/input/label",
      "@/components/base/textarea/textarea",
      "@/components/base/primitives/card",
      "@/components/base/primitives/drawer",
    ]);
  });

  it("allows canonical imports", async () => {
    const checker = await loadChecker();
    const source = `
      import { Label } from "@/components/base/label";
      import { TextArea } from "@/components/base/textarea";
      import { Card } from "@/components/base/card";
      import { Drawer } from "@/components/base/drawer";
    `;

    const violations = checker.collectForbiddenDesignSystemEntrypointUsages(source, "fixture.tsx");
    expect(violations).toHaveLength(0);
  });
});
