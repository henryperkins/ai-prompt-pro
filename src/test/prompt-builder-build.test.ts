import { describe, expect, it } from "vitest";
import { buildPrompt, defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("buildPrompt", () => {
  it("returns an empty preview for untouched defaults", () => {
    expect(buildPrompt(buildConfig())).toBe("");
  });

  it("omits default tone/complexity when user has not changed them", () => {
    const prompt = buildPrompt(
      buildConfig({
        originalPrompt: "Explain this architecture.",
      }),
    );

    expect(prompt).not.toContain("Use a professional tone");
    expect(prompt).not.toContain("Target moderate complexity level");
  });

  it("includes tone constraints when user explicitly changes tone", () => {
    const prompt = buildPrompt(
      buildConfig({
        tone: "Casual",
      }),
    );

    expect(prompt).toContain("Use a casual tone");
  });

  it("prioritizes original prompt text over legacy task text", () => {
    const prompt = buildPrompt(
      buildConfig({
        originalPrompt: "Draft a concise customer-facing outage update.",
        task: "Legacy internal task text",
      }),
    );

    expect(prompt).toContain("**Task:** Draft a concise customer-facing outage update.");
    expect(prompt).not.toContain("Legacy internal task text");
  });
});
