import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

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

function buildTemplateRow(config: PromptConfig, overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "tpl_1",
    name: "Preset",
    description: "",
    tags: [],
    config,
    fingerprint: "fingerprint",
    revision: 1,
    created_at: "2026-02-09T00:00:00.000Z",
    updated_at: "2026-02-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("normalizes template payloads before cloud insert and preserves warnings", async () => {
    const { saveTemplate } = await import("@/lib/persistence");
    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      insert: (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: "tpl_1",
                name: payload.name,
                description: payload.description,
                tags: payload.tags,
                config: payload.config,
                fingerprint: payload.fingerprint,
                revision: 1,
                created_at: "2026-02-09T00:00:00.000Z",
                updated_at: "2026-02-09T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        };
      },
    });

    const result = await saveTemplate("user_1", {
      name: "Risky",
      config: buildConfig({
        task: "Investigate incident",
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "url-1",
              type: "url",
              title: "Runbook",
              rawContent: "https://example.com/runbook",
              summary: "",
              addedAt: Date.now(),
            },
          ],
          databaseConnections: [
            {
              id: "db-1",
              label: "Primary",
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
          },
        },
      }),
    });

    const source = (insertedPayload?.config as PromptConfig).contextConfig.sources[0];
    expect(source.rawContent).toBe("");
    expect(typeof insertedPayload?.fingerprint).toBe("string");
    expect(result.outcome).toBe("created");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns false on delete when no row is removed", async () => {
    const { deleteTemplate } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    await expect(deleteTemplate("user_1", "missing")).resolves.toBe(false);
  });

  it("throws typed unauthorized errors for load failures", async () => {
    const { loadTemplateById } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                code: "42501",
                message: 'new row violates row-level security policy for table "templates"',
                details: "",
                hint: "",
              },
            }),
          }),
        }),
      }),
    });

    await expect(loadTemplateById("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      code: "unauthorized",
    });
  });

  it("escapes wildcard characters and uses revision locking when updating templates", async () => {
    const { saveTemplate } = await import("@/lib/persistence");
    const existingConfig = buildConfig({ task: "Current task" });
    const nextConfig = buildConfig({ task: "Updated task" });
    const existingRow = buildTemplateRow(existingConfig, {
      id: "tpl_existing",
      name: "100%_Coverage",
      description: "keep me",
      fingerprint: "old-fingerprint",
      revision: 4,
    });
    const updatedRow = buildTemplateRow(nextConfig, {
      id: "tpl_existing",
      name: "100%_Coverage",
      description: "",
      fingerprint: "new-fingerprint",
      revision: 5,
      updated_at: "2026-02-10T00:00:00.000Z",
    });

    let lookupPattern = "";
    let revisionFilter: number | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          ilike: (_column: string, pattern: string) => {
            lookupPattern = pattern;
            return {
              order: () => ({
                limit: async () => ({ data: [existingRow], error: null }),
              }),
            };
          },
        }),
      }),
    });

    const updateChain = {
      eq: vi.fn((column: string, value: unknown) => {
        if (column === "revision") revisionFilter = Number(value);
        return updateChain;
      }),
      select: vi.fn(() => ({
        maybeSingle: async () => ({ data: updatedRow, error: null }),
      })),
    };

    fromMock.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      },
    });

    const result = await saveTemplate("user_1", {
      name: "100%_Coverage",
      description: "",
      config: nextConfig,
    });

    expect(lookupPattern).toBe("100\\%\\_Coverage");
    expect(revisionFilter).toBe(4);
    expect(updatePayload?.description).toBe("");
    expect(result.outcome).toBe("updated");
  });
});
