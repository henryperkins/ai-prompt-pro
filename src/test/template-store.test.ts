import { beforeEach, describe, expect, it } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import {
  clearAllTemplatesForTest,
  loadTemplateById,
  listTemplateSummaries,
  saveTemplateSnapshot,
} from "@/lib/template-store";

const TEMPLATE_STORAGE_KEY = "promptforge-template-snapshots";

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

describe("template-store", () => {
  beforeEach(() => {
    clearAllTemplatesForTest();
  });

  it("saves idempotently by name + fingerprint and revisions updates", () => {
    const config = buildConfig({
      task: "Build a deployment checklist",
      contextConfig: {
        ...defaultConfig.contextConfig,
        sources: [
          {
            id: "src-1",
            type: "url",
            title: "Runbook",
            rawContent: "https://example.com/runbook",
            summary: "Deployment runbook",
            addedAt: Date.now(),
            reference: {
              kind: "url",
              refId: "url:runbook",
              locator: "https://example.com/runbook",
            },
          },
        ],
      },
    });

    const created = saveTemplateSnapshot({ name: "Ops Template", config });
    const unchanged = saveTemplateSnapshot({ name: "Ops Template", config });
    const updated = saveTemplateSnapshot({
      name: "Ops Template",
      config: buildConfig({ ...config, task: "Build a safer deployment checklist" }),
    });

    expect(created.outcome).toBe("created");
    expect(unchanged.outcome).toBe("unchanged");
    expect(unchanged.record.metadata.revision).toBe(1);
    expect(updated.outcome).toBe("updated");
    expect(updated.record.metadata.revision).toBe(2);
  });

  it("stores external sources as references and strips raw payloads", () => {
    const result = saveTemplateSnapshot({
      name: "External Sources",
      config: buildConfig({
        task: "Summarize these sources",
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "url-1",
              type: "url",
              title: "Product docs",
              rawContent: "Long fetched article body",
              summary: "External URL summary",
              addedAt: Date.now(),
              reference: {
                kind: "url",
                refId: "url:product-docs",
                locator: "https://example.com/docs",
              },
            },
            {
              id: "file-1",
              type: "file",
              title: "roadmap.pdf",
              rawContent: "Very long extracted PDF text",
              summary: "Roadmap excerpt",
              addedAt: Date.now(),
              reference: {
                kind: "file",
                refId: "file:roadmap.pdf",
                locator: "roadmap.pdf",
              },
            },
            {
              id: "text-1",
              type: "text",
              title: "Inline notes",
              rawContent: "Keep this text payload",
              summary: "Inline notes",
              addedAt: Date.now(),
            },
          ],
        },
      }),
    });

    const loaded = loadTemplateById(result.record.metadata.id);
    expect(loaded).not.toBeNull();
    const [urlSource, fileSource, textSource] = loaded!.record.state.promptConfig.contextConfig.sources;
    expect(urlSource.rawContent).toBe("");
    expect(fileSource.rawContent).toBe("");
    expect(textSource.rawContent).toContain("Keep this text payload");
    expect(loaded!.record.state.externalReferences.length).toBeGreaterThanOrEqual(2);
  });

  it("returns warnings for risky integrations and invalid rag config", () => {
    const result = saveTemplateSnapshot({
      name: "Risky Integration",
      config: buildConfig({
        task: "Diagnose production issue",
        contextConfig: {
          ...defaultConfig.contextConfig,
          databaseConnections: [
            {
              id: "db-1",
              label: "Primary DB",
              provider: "postgres",
              connectionRef: "",
              database: "app",
              schema: "public",
              tables: ["events"],
              readOnly: false,
            },
          ],
          rag: {
            ...defaultConfig.contextConfig.rag,
            enabled: true,
            vectorStoreRef: "",
            topK: 0,
            minScore: 1.5,
          },
        },
      }),
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toContain("readOnly");
    expect(result.warnings.join(" ")).toContain("vectorStoreRef");
  });

  it("migrates legacy template payloads from array format", () => {
    localStorage.setItem(
      TEMPLATE_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-1",
          name: "Legacy",
          description: "old format",
          role: "Senior Developer",
          task: "Review architecture",
          context: "Legacy context",
          format: ["Markdown"],
          lengthPreference: "standard",
          tone: "Technical",
          complexity: "Advanced",
          constraints: ["Think step-by-step"],
          examples: "",
        },
      ])
    );

    const summaries = listTemplateSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe("Legacy");
    const loaded = loadTemplateById(summaries[0].id);
    expect(loaded).not.toBeNull();
    expect(loaded!.record.metadata.schemaVersion).toBe(2);
  });
});
