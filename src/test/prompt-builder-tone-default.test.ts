import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  constraintExclusions,
  defaultConfig,
  scorePrompt,
} from "@/lib/prompt-builder";

describe("tone default", () => {
  it("defaults to empty string", () => {
    expect(defaultConfig.tone).toBe("");
  });

  it("buildPrompt omits tone constraint when tone is empty", () => {
    const prompt = buildPrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(prompt).not.toContain("tone");
  });

  it("buildPrompt includes tone when explicitly set", () => {
    const prompt = buildPrompt({
      ...defaultConfig,
      originalPrompt: "Test task",
      tone: "Professional",
    });
    expect(prompt).toContain("professional tone");
  });

  it("scorePrompt structure score is 0 when tone is empty", () => {
    const score = scorePrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(score.structure).toBeLessThan(5);
  });
});

describe("constraintExclusions", () => {
  it("maps formal tone to conversational and vice versa", () => {
    expect(constraintExclusions["Use formal tone"]).toBe("Be conversational");
    expect(constraintExclusions["Be conversational"]).toBe("Use formal tone");
  });
});
