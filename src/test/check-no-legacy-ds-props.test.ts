import { describe, expect, it } from "vitest";

async function loadChecker() {
    return import("../../scripts/check-no-legacy-ds-props-lib.mjs");
}

describe("check-no-legacy-ds-props AST scanner", () => {
    it("detects legacy Button props including multiline attributes", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Button } from "@/components/base/buttons/button";

      export function View() {
        return (
          <Button
            asChild
            variant="outline"
            size={"default"}
          >
            Open
          </Button>
        );
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations.map((item) => item.prop)).toEqual(["asChild", "variant", "size"]);
        expect(violations.map((item) => item.value)).toEqual([null, "outline", "default"]);
    });

    it("detects legacy Badge variant prop", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Badge } from "@/components/base/badges/badges";

      export function View() {
        return <Badge variant={"secondary"}>Status</Badge>;
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({ component: "Badge", prop: "variant", value: "secondary" });
    });

    it("resolves aliased imports for Button and Badge", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Button as CTA } from "@/components/base/buttons/button";
      import { Badge as Pill } from "@/components/base/badges/badges";

      export function View() {
        return (
          <>
            <CTA variant="ghost">Back</CTA>
            <Pill variant="outline">Meta</Pill>
          </>
        );
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations.map((item) => `${item.component}:${item.prop}`)).toEqual(["Button:variant", "Badge:variant"]);
    });

    it("ignores similarly named props on other components", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { StateCard } from "@/components/base/primitives/state-card";

      export function View() {
        return <StateCard variant="error" title="Oops" description="Nope" />;
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(0);
    });
});