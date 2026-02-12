import { describe, expect, it } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import {
  hydrateConfigV1ToWorkingState,
  PROMPT_CONFIG_SCHEMA_VERSION_KEY,
  PROMPT_CONFIG_V2_COMPAT_KEY,
  serializeWorkingStateToV1,
  serializeWorkingStateToV2,
} from "@/lib/prompt-config-adapters";

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

describe("prompt-config adapters", () => {
  it("hydrates malformed v1 payloads to safe defaults", () => {
    const result = hydrateConfigV1ToWorkingState({
      role: "Writer",
      format: "not-an-array",
      constraints: null,
      contextConfig: {
        sources: [
          {
            id: "url-1",
            type: "url",
            title: "Runbook",
            rawContent: "https://example.com",
            summary: "Summary",
            addedAt: Date.now(),
          },
        ],
        rag: {
          documentRefs: ["ok", 123],
        },
      },
    });

    expect(result.role).toBe("Writer");
    expect(result.format).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.contextConfig.rag.documentRefs).toEqual(["ok"]);
    expect(result.contextConfig.sources[0]?.rawContent).toBe("https://example.com");
  });

  it("serializes working state to v1 using normalized external source handling", () => {
    const config = buildConfig({
      contextConfig: {
        ...defaultConfig.contextConfig,
        sources: [
          {
            id: "url-1",
            type: "url",
            title: "Runbook",
            rawContent: "https://example.com",
            summary: "",
            addedAt: Date.now(),
          },
        ],
      },
    });

    const serialized = serializeWorkingStateToV1(config);
    expect(serialized.contextConfig.sources[0]?.rawContent).toBe("");
  });

  it("hydrates direct v2 payloads into working state", () => {
    const hydrated = hydrateConfigV1ToWorkingState({
      originalPrompt: "Draft release notes",
      role: "Product marketer",
      audience: "Engineering managers",
      tone: "Professional",
      format: ["Markdown"],
      lengthPreference: "brief",
      constraints: ["Avoid jargon"],
      examples: "",
      sources: [],
      projectNotes: "Keep concise.",
      advanced: {
        useDelimiters: false,
        databaseConnections: [],
        rag: {
          enabled: true,
          vectorStoreRef: "vs-1",
          namespace: "releases",
          topK: 7,
          minScore: 0.2,
          retrievalStrategy: "hybrid",
          documentRefs: ["doc-1"],
          chunkWindow: 4,
        },
      },
    });

    expect(hydrated.originalPrompt).toBe("Draft release notes");
    expect(hydrated.role).toBe("Product marketer");
    expect(hydrated.contextConfig.structured.audience).toBe("Engineering managers");
    expect(hydrated.contextConfig.useDelimiters).toBe(false);
    expect(hydrated.contextConfig.rag.vectorStoreRef).toBe("vs-1");
  });

  it("serializes working state to v2 with merged custom fields", () => {
    const config = buildConfig({
      originalPrompt: "Draft a launch brief",
      task: "Include pricing and timeline",
      role: "Teacher",
      customRole: "Product marketer",
      customFormat: "YAML",
      customConstraint: "No hype",
      constraints: ["Avoid jargon"],
      contextConfig: {
        ...defaultConfig.contextConfig,
        structured: {
          ...defaultConfig.contextConfig.structured,
          audience: "B2B founders",
        },
      },
    });

    const serialized = serializeWorkingStateToV2(config);

    expect(serialized.originalPrompt).toContain("Draft a launch brief");
    expect(serialized.originalPrompt).toContain("Include pricing and timeline");
    expect(serialized.role).toBe("Product marketer");
    expect(serialized.audience).toBe("B2B founders");
    expect(serialized.format).toContain("YAML");
    expect(serialized.constraints).toContain("No hype");
  });

  it("embeds v2 compatibility payload when serializing v1", () => {
    const config = buildConfig({
      originalPrompt: "Summarize this incident",
      role: "Data Analyst",
      contextConfig: {
        ...defaultConfig.contextConfig,
        structured: {
          ...defaultConfig.contextConfig.structured,
          audience: "SRE leadership",
        },
      },
    });

    const serialized = serializeWorkingStateToV1(config) as PromptConfig & Record<string, unknown>;
    const embedded = serialized[PROMPT_CONFIG_V2_COMPAT_KEY] as Record<string, unknown> | undefined;

    expect(serialized[PROMPT_CONFIG_SCHEMA_VERSION_KEY]).toBe(2);
    expect(embedded?.role).toBe("Data Analyst");
    expect(embedded?.audience).toBe("SRE leadership");
  });
});
