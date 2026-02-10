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

function buildSavedPromptRow(config: PromptConfig, overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "tpl_1",
    user_id: "user_1",
    title: "Preset",
    description: "",
    category: "general",
    tags: [],
    built_prompt: "",
    enhanced_prompt: "",
    config,
    fingerprint: "fingerprint",
    revision: 1,
    is_shared: false,
    target_model: "",
    use_case: "",
    remixed_from: null,
    remix_note: "",
    remix_diff: null,
    created_at: "2026-02-09T00:00:00.000Z",
    updated_at: "2026-02-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("normalizes prompt payloads before cloud insert and preserves warnings", async () => {
    const { savePrompt } = await import("@/lib/persistence");
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
                user_id: payload.user_id,
                title: payload.title,
                description: payload.description,
                category: payload.category,
                tags: payload.tags,
                built_prompt: payload.built_prompt,
                enhanced_prompt: payload.enhanced_prompt,
                config: payload.config,
                fingerprint: payload.fingerprint,
                revision: 1,
                is_shared: payload.is_shared,
                target_model: payload.target_model,
                use_case: payload.use_case,
                remixed_from: payload.remixed_from,
                remix_note: payload.remix_note,
                remix_diff: payload.remix_diff,
                created_at: "2026-02-09T00:00:00.000Z",
                updated_at: "2026-02-09T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        };
      },
    });

    const result = await savePrompt("user_1", {
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
    const { deletePrompt } = await import("@/lib/persistence");

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

    await expect(deletePrompt("user_1", "missing")).resolves.toBe(false);
  });

  it("loads prompt summaries without selecting full prompt text blobs", async () => {
    const { loadPrompts } = await import("@/lib/persistence");
    const listRow = buildSavedPromptRow(buildConfig({ task: "Summarize logs" }));
    const { built_prompt, enhanced_prompt, remix_note, remix_diff, ...summaryRow } = listRow;
    void built_prompt;
    void enhanced_prompt;
    void remix_note;
    void remix_diff;

    let selectedColumns = "";

    fromMock.mockReturnValueOnce({
      select: (columns: string) => {
        selectedColumns = columns;
        return {
          eq: () => ({
            order: async () => ({ data: [summaryRow], error: null }),
          }),
        };
      },
    });

    fromMock.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    });

    const summaries = await loadPrompts("user_1");
    expect(selectedColumns).not.toContain("built_prompt");
    expect(selectedColumns).not.toContain("enhanced_prompt");
    expect(summaries[0]?.builtPrompt).toBe("");
    expect(summaries[0]?.enhancedPrompt).toBe("");
  });

  it("throws typed unauthorized errors for load failures", async () => {
    const { loadPromptById } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                code: "42501",
                message: 'new row violates row-level security policy for table "saved_prompts"',
                details: "",
                hint: "",
              },
            }),
          }),
        }),
      }),
    });

    await expect(loadPromptById("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      code: "unauthorized",
    });
  });

  it("escapes wildcard characters and uses revision locking when updating prompts", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    const existingConfig = buildConfig({ task: "Current task" });
    const nextConfig = buildConfig({ task: "Updated task" });
    const existingRow = buildSavedPromptRow(existingConfig, {
      id: "tpl_existing",
      title: "100%_Coverage",
      description: "keep me",
      fingerprint: "old-fingerprint",
      revision: 4,
    });
    const updatedRow = buildSavedPromptRow(nextConfig, {
      id: "tpl_existing",
      title: "100%_Coverage",
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

    const result = await savePrompt("user_1", {
      name: "100%_Coverage",
      description: "",
      config: nextConfig,
    });

    expect(lookupPattern).toBe("100\\%\\_Coverage");
    expect(revisionFilter).toBe(4);
    expect(updatePayload?.description).toBe("");
    expect(result.outcome).toBe("updated");
  });

  it("requires use case text before sharing a prompt", async () => {
    const { sharePrompt } = await import("@/lib/persistence");
    const updateSpy = vi.fn();

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "tpl_1", use_case: "" }, error: null }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      update: updateSpy,
    });

    await expect(sharePrompt("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      message: "Use case is required before sharing.",
    });

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("normalizes use case text before sharing", async () => {
    const { sharePrompt } = await import("@/lib/persistence");
    let updatePayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "tpl_1", use_case: "" }, error: null }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: "tpl_1" }, error: null }),
              }),
            }),
          }),
        };
      },
    });

    await expect(
      sharePrompt("user_1", "tpl_1", {
        useCase: "  Build onboarding emails  ",
      }),
    ).resolves.toBe(true);

    expect(updatePayload?.use_case).toBe("Build onboarding emails");
    expect(updatePayload?.is_shared).toBe(true);
  });
});
