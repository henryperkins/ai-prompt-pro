import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import {
  PROMPT_CONFIG_SCHEMA_VERSION_KEY,
  PROMPT_CONFIG_V2_COMPAT_KEY,
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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    status: init.status ?? 200,
  });
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
    community_post_id: null,
    upvote_count: 0,
    verified_count: 0,
    remix_count: 0,
    comment_count: 0,
    created_at: 1_739_059_200,
    updated_at: 1_739_059_200,
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("normalizes prompt payloads before cloud insert and preserves warnings", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    let insertedPayload: Record<string, unknown> | null = null;

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockImplementationOnce(async (_input, init) => {
        insertedPayload = JSON.parse(String((init as RequestInit).body));
        return jsonResponse({ id: "tpl_1", revision: 1 }, { status: 201 });
      })
      .mockImplementationOnce(async () => jsonResponse(buildSavedPromptRow(insertedPayload?.config as PromptConfig, {
        user_id: "user_1",
        title: insertedPayload?.title,
        description: insertedPayload?.description,
        category: insertedPayload?.category,
        tags: insertedPayload?.tags,
        built_prompt: insertedPayload?.built_prompt,
        enhanced_prompt: insertedPayload?.enhanced_prompt,
        fingerprint: "server-fingerprint",
        revision: 1,
        is_shared: insertedPayload?.is_shared,
        target_model: insertedPayload?.target_model,
        use_case: insertedPayload?.use_case,
        remixed_from: insertedPayload?.remixed_from,
        remix_note: insertedPayload?.remix_note,
        remix_diff: insertedPayload?.remix_diff,
      })));

    const result = await savePrompt("user_1", {
      name: "Risky",
      config: buildConfig({
        task: "Investigate incident",
        tone: "Professional",
        complexity: "Moderate",
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
    const serializedConfig = insertedPayload?.config as PromptConfig & Record<string, unknown>;
    expect(source.rawContent).toBe("");
    expect(serializedConfig.tone).toBe("Professional");
    expect(serializedConfig.complexity).toBe("Moderate");
    expect(serializedConfig[PROMPT_CONFIG_SCHEMA_VERSION_KEY]).toBe(2);
    expect(serializedConfig[PROMPT_CONFIG_V2_COMPAT_KEY]).toBeTruthy();
    expect(result.outcome).toBe("created");
    expect(result.record.metadata.fingerprint).toBe("server-fingerprint");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("sanitizes unsupported Unicode sequences before prompt save", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    let insertedPayload: Record<string, unknown> | null = null;
    const malformed = "alpha\u0000beta\ud83dgamma\udc00";
    const sanitized = "alphabeta\ufffdgamma\ufffd";

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockImplementationOnce(async (_input, init) => {
        insertedPayload = JSON.parse(String((init as RequestInit).body));
        return jsonResponse({ id: "tpl_2", revision: 1 }, { status: 201 });
      })
      .mockImplementationOnce(async () => jsonResponse(buildSavedPromptRow(insertedPayload?.config as PromptConfig, {
        id: "tpl_2",
        title: insertedPayload?.title,
        description: insertedPayload?.description,
        tags: insertedPayload?.tags,
        built_prompt: insertedPayload?.built_prompt,
        enhanced_prompt: insertedPayload?.enhanced_prompt,
        config: insertedPayload?.config,
        remix_diff: insertedPayload?.remix_diff,
      })));

    const result = await savePrompt("user_1", {
      name: `Prompt ${malformed}`,
      description: malformed,
      tags: [`Tag ${malformed}`],
      config: buildConfig({
        task: malformed,
      }),
      builtPrompt: malformed,
      enhancedPrompt: malformed,
      remixDiff: {
        changes: [{ field: malformed, from: malformed, to: malformed }],
        added_tags: [malformed],
        removed_tags: [malformed],
        category_changed: false,
      },
    });

    const insertedConfig = insertedPayload?.config as PromptConfig;
    const insertedRemixDiff = insertedPayload?.remix_diff as {
      changes: Array<{ field: string; from: string; to: string }>;
      added_tags: string[];
      removed_tags: string[];
    };

    expect(insertedPayload?.description).toBe(sanitized);
    expect(insertedPayload?.built_prompt).toBe(sanitized);
    expect(insertedPayload?.enhanced_prompt).toBe(sanitized);
    expect(insertedPayload?.tags).toEqual([`tag ${sanitized}`]);
    expect(insertedConfig.task).toBe("");
    expect(insertedConfig.originalPrompt).toContain(sanitized);
    expect(insertedRemixDiff.changes[0]?.field).toBe(sanitized);
    expect(insertedRemixDiff.changes[0]?.from).toBe(sanitized);
    expect(insertedRemixDiff.changes[0]?.to).toBe(sanitized);
    expect(insertedRemixDiff.added_tags[0]).toBe(sanitized);
    expect(insertedRemixDiff.removed_tags[0]).toBe(sanitized);
    expect(result.outcome).toBe("created");
  });

  it("preserves draft source raw content during local draft save/load", async () => {
    const { saveDraft, loadDraft } = await import("@/lib/persistence");
    const config = buildConfig({
      contextConfig: {
        ...defaultConfig.contextConfig,
        sources: [
          {
            id: "url-1",
            type: "url",
            title: "Runbook",
            rawContent: "https://example.com/runbook",
            summary: "Summary",
            addedAt: Date.now(),
          },
        ],
      },
    });

    await saveDraft(null, config);
    const loaded = await loadDraft(null);
    expect(loaded?.contextConfig.sources[0]?.rawContent).toBe("https://example.com/runbook");
  });

  it("maps unauthorized prompt load failures to typed errors", async () => {
    const { loadPromptById } = await import("@/lib/persistence");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, { status: 401 }));

    await expect(loadPromptById("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      code: "unauthorized",
    });
  });

  it("updates an existing prompt by id with revision locking and surfaces conflicts", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    let updatePayload: Record<string, unknown> | null = null;

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(buildSavedPromptRow(buildConfig({ task: "Existing" }), {
        id: "tpl_1",
        revision: 4,
        title: "100%_Coverage",
      })))
      .mockImplementationOnce(async (_input, init) => {
        updatePayload = JSON.parse(String((init as RequestInit).body));
        return jsonResponse({ error: "Prompt was modified elsewhere. Please refresh and try again." }, { status: 409 });
      });

    await expect(savePrompt("user_1", {
      id: "tpl_1",
      expectedRevision: 4,
      name: "100%_Coverage",
      description: "",
      config: buildConfig({ task: "Updated" }),
    })).rejects.toMatchObject({
      name: "PersistenceError",
      code: "conflict",
    });

    expect(updatePayload?.expected_revision).toBe(4);
    expect(updatePayload?.title).toBe("100%_Coverage");
  });

  it("requires use case text before sharing a prompt", async () => {
    const { sharePrompt } = await import("@/lib/persistence");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(buildSavedPromptRow(buildConfig(), {
      id: "tpl_1",
      use_case: "",
    })));

    await expect(sharePrompt("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      message: "Use case is required before sharing.",
    });
  });

  it("normalizes use case text before sharing and maps the worker post id contract", async () => {
    const { sharePrompt } = await import("@/lib/persistence");
    let sharePayload: Record<string, unknown> | null = null;

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(buildSavedPromptRow(buildConfig(), {
        id: "tpl_1",
        use_case: "",
      })))
      .mockImplementationOnce(async (_input, init) => {
        sharePayload = JSON.parse(String((init as RequestInit).body));
        return jsonResponse({ shared: true, postId: "post_1" });
      });

    await expect(
      sharePrompt("user_1", "tpl_1", {
        useCase: "  Build onboarding emails  ",
      }),
    ).resolves.toEqual({ shared: true, postId: "post_1" });

    expect(sharePayload?.use_case).toBe("Build onboarding emails");
  });

  it("rejects sharing prompts that contain GitHub sources", async () => {
    const { sharePrompt } = await import("@/lib/persistence");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(buildSavedPromptRow(buildConfig({
      contextConfig: {
        ...defaultConfig.contextConfig,
        sources: [
          {
            id: "gh-1",
            type: "github",
            title: "owner/repo:README.md",
            rawContent: "",
            summary: "Repository readme",
            addedAt: Date.now(),
            reference: {
              kind: "github",
              refId: "github:1:sha:README.md",
              locator: "owner/repo@sha:README.md",
            },
          },
        ],
      },
    }), {
      id: "tpl_1",
      use_case: "Repository onboarding",
    })));

    await expect(sharePrompt("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      message: "Remove GitHub sources before sharing this prompt.",
    });
  });

  it("rejects save-and-share writes when the config contains GitHub sources", async () => {
    const { savePrompt } = await import("@/lib/persistence");

    await expect(savePrompt("user_1", {
      name: "Repo-aware prompt",
      isShared: true,
      config: buildConfig({
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "gh-1",
              type: "github",
              title: "owner/repo:src/app.ts",
              rawContent: "",
              summary: "Application entrypoint",
              addedAt: Date.now(),
              reference: {
                kind: "github",
                refId: "github:1:sha:src/app.ts",
                locator: "owner/repo@sha:src/app.ts",
              },
            },
          ],
        },
      }),
    })).rejects.toMatchObject({
      name: "PersistenceError",
      message: "Remove GitHub sources before sharing this prompt.",
    });
  });

  it("exposes containsGithubSources in prompt summaries", async () => {
    const { loadPrompts } = await import("@/lib/persistence");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([
      buildSavedPromptRow(buildConfig({
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "gh-1",
              type: "github",
              title: "owner/repo:README.md",
              rawContent: "",
              summary: "Repository overview",
              addedAt: Date.now(),
              reference: {
                kind: "github",
                refId: "github:1:sha:README.md",
                locator: "owner/repo@sha:README.md",
              },
            },
          ],
        },
      })),
    ]));

    await expect(loadPrompts("user_1")).resolves.toEqual([
      expect.objectContaining({
        containsGithubSources: true,
        sourceCount: 1,
      }),
    ]);
  });
});
