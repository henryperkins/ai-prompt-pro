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
            color="secondary"
            size={"default"}
            isDisabled
            isLoading
          >
            Open
          </Button>
        );
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations.map((item) => item.prop)).toEqual(["asChild", "color", "size", "isDisabled", "isLoading"]);
        expect(violations.map((item) => item.value)).toEqual([null, "secondary", "default", null, null]);
    });

    it("allows icon button sizing in canonical Button API", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Button } from "@/components/base/buttons/button";

      export function View() {
        return (
          <Button size="icon" aria-label="Open menu">
            Menu
          </Button>
        );
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(0);
    });

    it("allows canonical Badge props", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Badge } from "@/components/base/badges/badges";

      export function View() {
        return <Badge variant={"modern"} tone={"brand"}>Status</Badge>;
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(0);
    });

    it("detects legacy Badge props, including aliased imports", async () => {
        const { collectLegacyDesignSystemPropUsages } = await loadChecker();
        const source = `
      import { Button as CTA } from "@/components/base/buttons/button";
      import { Badge as Pill } from "@/components/base/badges/badges";

      export function View() {
        return (
          <>
            <CTA color="secondary">Back</CTA>
            <Pill type="modern" color="brand">Meta</Pill>
          </>
        );
      }
    `;

        const violations = collectLegacyDesignSystemPropUsages(source, "fixture.tsx");
        expect(violations.map((item) => `${item.component}:${item.prop}`)).toEqual(["Button:color", "Badge:type", "Badge:color"]);
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
