import { describe, expect, it } from "vitest";
import { defaultConfig, hasPromptInput, type PromptConfig } from "@/lib/prompt-builder";

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
        documentRefs:
          overrides?.contextConfig?.rag?.documentRefs || defaultConfig.contextConfig.rag.documentRefs,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("hasPromptInput", () => {
  it("returns false for untouched defaults", () => {
    expect(hasPromptInput(buildConfig())).toBe(false);
  });

  it("returns true when builder-only inputs are present", () => {
    expect(
      hasPromptInput(
        buildConfig({
          role: "Software Developer",
        }),
      ),
    ).toBe(true);
  });

  it("returns true when structured context is filled", () => {
    expect(
      hasPromptInput(
        buildConfig({
          contextConfig: {
            ...defaultConfig.contextConfig,
            structured: {
              ...defaultConfig.contextConfig.structured,
              audience: "B2B SaaS founders",
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("does not treat delimiter toggles as prompt input by themselves", () => {
    expect(
      hasPromptInput(
        buildConfig({
          contextConfig: {
            ...defaultConfig.contextConfig,
            useDelimiters: false,
          },
        }),
      ),
    ).toBe(false);
  });
});
