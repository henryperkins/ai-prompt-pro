import { describe, expect, it } from "vitest";
import { defaultConfig, hasPromptInput, reconcileFormatLength, type PromptConfig } from "@/lib/prompt-builder";

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

describe("reconcileFormatLength", () => {
  it("extracts Length: standard from inspector format", () => {
    const result = reconcileFormatLength("Table | Length: standard");
    expect(result.customFormat).toBe("Table");
    expect(result.lengthPreference).toBe("standard");
  });

  it("extracts Length: brief", () => {
    const result = reconcileFormatLength("Bullet points | Length: brief");
    expect(result.customFormat).toBe("Bullet points");
    expect(result.lengthPreference).toBe("brief");
  });

  it("extracts Length: detailed", () => {
    const result = reconcileFormatLength("Markdown | Length: detailed");
    expect(result.customFormat).toBe("Markdown");
    expect(result.lengthPreference).toBe("detailed");
  });

  it("returns null lengthPreference when no Length: token is present", () => {
    const result = reconcileFormatLength("Table");
    expect(result.customFormat).toBe("Table");
    expect(result.lengthPreference).toBeNull();
  });

  it("returns empty customFormat when only a Length: token is present", () => {
    const result = reconcileFormatLength("| Length: standard");
    expect(result.customFormat).toBe("");
    expect(result.lengthPreference).toBe("standard");
  });

  it("returns null lengthPreference for unrecognized length values", () => {
    const result = reconcileFormatLength("Table | Length: verbose");
    expect(result.customFormat).toBe("Table");
    expect(result.lengthPreference).toBeNull();
  });
});
