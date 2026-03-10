import { describe, expect, it } from "vitest";
import { detectDraftIntent } from "@/lib/enhance-intent";

describe("detectDraftIntent", () => {
  it("detects analysis prompts from the current draft", () => {
    const result = detectDraftIntent("Analyze these retention numbers by cohort");

    expect(result.intent).toBe("analysis");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects rewrite prompts from the current draft", () => {
    const result = detectDraftIntent(
      "Rewrite this sales email for enterprise buyers",
    );

    expect(result.intent).toBe("rewrite");
  });

  it("can use builder context as a code hint", () => {
    const result = detectDraftIntent("Fix this implementation", {
      role: "Software Developer",
      outputFormats: ["Code block"],
    });

    expect(result.intent).toBe("code");
  });

  it("returns brainstorm for generic generation requests without stronger signals", () => {
    const result = detectDraftIntent("Write a proposal for the launch");

    expect(result.intent).toBe("brainstorm");
  });

  it("returns null for vague prompts", () => {
    const result = detectDraftIntent("Help");

    expect(result.intent).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
