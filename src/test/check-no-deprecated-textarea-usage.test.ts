import { describe, expect, it } from "vitest";

async function loadChecker() {
    return import("../../scripts/check-no-deprecated-textarea-usage-lib.mjs");
}

describe("check-no-deprecated-textarea-usage AST scanner", () => {
    it("detects deprecated Textarea imports, including aliased imports", async () => {
        const { collectDeprecatedTextareaUsages } = await loadChecker();
        const source = `
      import { Textarea, TextArea as PreferredTextArea } from "@/components/base/textarea";
      import { Textarea as LegacyTextarea } from "@/components/base/textarea";

      export function View() {
        return (
          <>
            <Textarea />
            <PreferredTextArea />
            <LegacyTextarea />
          </>
        );
      }
    `;

        const violations = collectDeprecatedTextareaUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(2);
        expect(violations.map((item) => item.localName)).toEqual(["Textarea", "LegacyTextarea"]);
        expect(violations.map((item) => item.kind)).toEqual(["import", "import"]);
    });

    it("detects export-from usages of deprecated Textarea", async () => {
        const { collectDeprecatedTextareaUsages } = await loadChecker();
        const source = `
      export { Textarea } from "@/components/base/textarea";
      export { TextArea } from "@/components/base/textarea";
    `;

        const violations = collectDeprecatedTextareaUsages(source, "fixture.ts");
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            kind: "export",
            localName: "Textarea",
        });
    });

    it("allows canonical TextArea-only imports", async () => {
        const { collectDeprecatedTextareaUsages } = await loadChecker();
        const source = `
      import { TextArea } from "@/components/base/textarea";

      export function View() {
        return <TextArea aria-label="Notes" />;
      }
    `;

        const violations = collectDeprecatedTextareaUsages(source, "fixture.tsx");
        expect(violations).toHaveLength(0);
    });
});