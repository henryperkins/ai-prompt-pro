import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const LOCAL_VERSIONS_KEY = "promptforge-local-versions";
const CLOUD_VERSIONS_KEY = "promptforge-cloud-versions:user_a";
const TOKEN_A = "token_a";
const TOKEN_B = "token_b";

const mocks = vi.hoisted(() => ({
  authUser: { current: { id: "user_a" } as { id: string } | null },
  authSession: { current: { accessToken: "token_a" } as { accessToken: string } | null },
  toast: vi.fn(),
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
  clearLocalDraft: vi.fn(),
  loadPrompts: vi.fn(),
  savePrompt: vi.fn(),
  sharePrompt: vi.fn(),
  unsharePrompt: vi.fn(),
  loadPromptById: vi.fn(),
  deletePrompt: vi.fn(),
  loadVersions: vi.fn(),
  saveVersion: vi.fn(),
  getPersistenceErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.authUser.current, session: mocks.authSession.current }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/persistence", () => ({
  loadDraft: (...args: unknown[]) => mocks.loadDraft(...args),
  saveDraft: (...args: unknown[]) => mocks.saveDraft(...args),
  clearLocalDraft: (...args: unknown[]) => mocks.clearLocalDraft(...args),
  loadPrompts: (...args: unknown[]) => mocks.loadPrompts(...args),
  savePrompt: (...args: unknown[]) => mocks.savePrompt(...args),
  sharePrompt: (...args: unknown[]) => mocks.sharePrompt(...args),
  unsharePrompt: (...args: unknown[]) => mocks.unsharePrompt(...args),
  loadPromptById: (...args: unknown[]) => mocks.loadPromptById(...args),
  deletePrompt: (...args: unknown[]) => mocks.deletePrompt(...args),
  loadVersions: (...args: unknown[]) => mocks.loadVersions(...args),
  saveVersion: (...args: unknown[]) => mocks.saveVersion(...args),
  getPersistenceErrorMessage: (...args: unknown[]) => mocks.getPersistenceErrorMessage(...args),
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

describe("usePromptBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mocks.authUser.current = { id: "user_a" };
    mocks.authSession.current = { accessToken: TOKEN_A };
    mocks.loadDraft.mockResolvedValue(buildConfig({ role: "User A role" }));
    mocks.loadPrompts.mockResolvedValue([]);
    mocks.loadVersions.mockResolvedValue([]);
    mocks.saveDraft.mockResolvedValue(undefined);
    mocks.savePrompt.mockResolvedValue(null);
    mocks.sharePrompt.mockResolvedValue(false);
    mocks.unsharePrompt.mockResolvedValue(false);
    mocks.loadPromptById.mockResolvedValue(null);
    mocks.deletePrompt.mockResolvedValue(false);
    mocks.saveVersion.mockResolvedValue(null);
  });

  it("clears prior in-memory state immediately when auth user changes", async () => {
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(result.current.config.role).toBe("User A role");
    });

    act(() => {
      result.current.setEnhancedPrompt("Sensitive output from user A");
    });
    expect(result.current.enhancedPrompt).toBe("Sensitive output from user A");

    mocks.authUser.current = { id: "user_b" };
    mocks.authSession.current = { accessToken: TOKEN_B };
    mocks.loadDraft.mockRejectedValueOnce(new Error("Failed to load draft"));
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([]);

    rerender();

    expect(result.current.config).toEqual(defaultConfig);
    expect(result.current.enhancedPrompt).toBe("");

    await waitFor(() => {
      expect(mocks.loadDraft).toHaveBeenCalledWith(TOKEN_B);
    });

    expect(result.current.config).toEqual(defaultConfig);
    expect(result.current.enhancedPrompt).toBe("");
  });

  it("persists guest versions locally and migrates them on sign-in", async () => {
    mocks.authUser.current = null;
    mocks.authSession.current = null;
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    act(() => {
      result.current.setEnhancedPrompt("Guest version content");
    });

    await waitFor(() => {
      expect(result.current.enhancedPrompt).toBe("Guest version content");
    });

    act(() => {
      result.current.saveVersion("Guest Version 1");
    });

    await waitFor(() => {
      expect(result.current.versions).toHaveLength(1);
    });

    const storedBeforeLogin = localStorage.getItem(LOCAL_VERSIONS_KEY);
    expect(storedBeforeLogin).not.toBeNull();
    expect(JSON.parse(storedBeforeLogin || "[]")).toHaveLength(1);

    mocks.authUser.current = { id: "user_b" };
    mocks.authSession.current = { accessToken: TOKEN_B };
    mocks.loadDraft.mockResolvedValueOnce(buildConfig({ role: "Cloud role" }));
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([
      {
        id: "cloud-1",
        name: "Cloud Version",
        prompt: "Cloud history",
        timestamp: Date.now(),
      },
    ]);

    rerender();

    await waitFor(() => {
      expect(mocks.saveVersion).toHaveBeenCalledWith(TOKEN_B, "Guest Version 1", "Guest version content");
    });

    expect(localStorage.getItem(LOCAL_VERSIONS_KEY)).toBeNull();
    await waitFor(() => {
      expect(result.current.versions[0]?.id).toBe("cloud-1");
    });
  });

  it("writes guest version to local storage immediately when saving", async () => {
    mocks.authUser.current = null;
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    act(() => {
      result.current.setEnhancedPrompt("Instant guest version");
    });

    act(() => {
      result.current.saveVersion("Instant Save");
    });

    const stored = localStorage.getItem(LOCAL_VERSIONS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored || "[]");
    expect(parsed[0]?.name).toBe("Instant Save");
    expect(parsed[0]?.prompt).toBe("Instant guest version");
  });

  it("clears cached cloud versions when cloud history is empty", async () => {
    sessionStorage.setItem(
      CLOUD_VERSIONS_KEY,
      JSON.stringify([
        {
          id: "cached-1",
          name: "Cached Version",
          prompt: "Cached history",
          timestamp: Date.now(),
        },
      ]),
    );

    mocks.loadVersions.mockResolvedValueOnce([]);

    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(sessionStorage.getItem(CLOUD_VERSIONS_KEY)).toBeNull();
    });

    expect(result.current.versions).toHaveLength(0);
  });

  it("caches signed-in saves in session storage while cloud save is pending", async () => {
    const deferred = createDeferred<{
      id: string;
      name: string;
      prompt: string;
      timestamp: number;
    } | null>();
    mocks.saveVersion.mockReturnValueOnce(deferred.promise);

    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(mocks.loadVersions).toHaveBeenCalledWith(TOKEN_A);
    });

    act(() => {
      result.current.setEnhancedPrompt("Cloud pending prompt");
    });

    act(() => {
      result.current.saveVersion("Cloud Pending");
    });

    const cached = JSON.parse(sessionStorage.getItem(CLOUD_VERSIONS_KEY) || "[]");
    expect(cached[0]?.name).toBe("Cloud Pending");
    expect(result.current.versions[0]?.name).toBe("Cloud Pending");

    deferred.resolve({
      id: "cloud-version-1",
      name: "Cloud Pending",
      prompt: "Cloud pending prompt",
      timestamp: Date.now(),
    });

    await waitFor(() => {
      expect(result.current.versions[0]?.id).toBe("cloud-version-1");
    });
  });

  it("removes optimistic cloud versions when save fails", async () => {
    sessionStorage.setItem(
      CLOUD_VERSIONS_KEY,
      JSON.stringify([
        {
          id: "cached-1",
          name: "Cached Version",
          prompt: "Cached history",
          timestamp: Date.now(),
        },
      ]),
    );

    const deferred = createDeferred<{
      id: string;
      name: string;
      prompt: string;
      timestamp: number;
    } | null>();
    const loadVersionsDeferred = createDeferred<
      {
        id: string;
        name: string;
        prompt: string;
        timestamp: number;
      }[]
    >();
    mocks.loadVersions.mockReturnValueOnce(loadVersionsDeferred.promise);
    mocks.saveVersion.mockReturnValueOnce(deferred.promise);

    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(mocks.loadVersions).toHaveBeenCalledWith(TOKEN_A);
    });

    act(() => {
      result.current.setEnhancedPrompt("Cloud pending prompt");
    });

    act(() => {
      result.current.saveVersion("Cloud Fail");
    });

    const cachedDuringSave = JSON.parse(sessionStorage.getItem(CLOUD_VERSIONS_KEY) || "[]");
    expect(cachedDuringSave[0]?.name).toBe("Cloud Fail");
    expect(result.current.versions[0]?.name).toBe("Cloud Fail");

    deferred.reject(new Error("Nope"));

    await waitFor(() => {
      expect(result.current.versions[0]?.id).toBe("cached-1");
    });

    const cachedAfterFailure = JSON.parse(sessionStorage.getItem(CLOUD_VERSIONS_KEY) || "[]");
    expect(cachedAfterFailure).toHaveLength(1);
    expect(cachedAfterFailure[0]?.id).toBe("cached-1");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to save version",
      }),
    );
  });

  it("uses a provided prompt override when saving a version", async () => {
    mocks.saveVersion.mockResolvedValueOnce({
      id: "cloud-variant",
      name: "Variant Version",
      prompt: "Short variant prompt",
      timestamp: Date.now(),
    });
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(mocks.loadVersions).toHaveBeenCalledWith(TOKEN_A);
    });

    act(() => {
      result.current.setEnhancedPrompt("Original enhanced prompt");
    });

    act(() => {
      result.current.saveVersion("Variant Version", "Short variant prompt");
    });

    expect(result.current.versions[0]?.prompt).toBe("Short variant prompt");
    await waitFor(() => {
      expect(mocks.saveVersion).toHaveBeenCalledWith(
        TOKEN_A,
        "Variant Version",
        "Short variant prompt",
      );
    });
    await waitFor(() => {
      expect(result.current.versions[0]?.id).toBe("cloud-variant");
    });
  });

  it("warns when cloud draft is skipped because user edited during hydration", async () => {
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(result.current.config.role).toBe("User A role");
    });

    const deferredDraft = createDeferred<PromptConfig | null>();
    mocks.authUser.current = { id: "user_b" };
    mocks.authSession.current = { accessToken: TOKEN_B };
    mocks.loadDraft.mockReturnValueOnce(deferredDraft.promise);
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([]);

    rerender();

    act(() => {
      result.current.updateConfig({ role: "Local edit before hydrate" });
    });

    deferredDraft.resolve(buildConfig({ role: "Cloud role should not replace edit" }));

    await waitFor(() => {
      expect(result.current.config.role).toBe("Local edit before hydrate");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cloud draft was not applied",
      }),
    );
  });

  it("preserves preset config when auth hydrates after loadTemplate", async () => {
    // Start as guest so the first auth effect is a no-op (null === null).
    mocks.authUser.current = null;
    mocks.authSession.current = null;
    mocks.loadDraft.mockResolvedValue(buildConfig({ role: "Cloud role" }));

    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    // Simulate preset loaded while still a guest.
    act(() => {
      result.current.loadTemplate({
        starterPrompt: "Preset starter prompt",
        role: "Preset Role",
        task: "Preset Task",
        context: "Preset context",
        format: ["Markdown"],
        lengthPreference: "detailed",
        tone: "Professional",
        complexity: "Moderate",
        constraints: [],
        examples: "",
      });
    });

    expect(result.current.config.role).toBe("Preset Role");
    expect(result.current.config.task).toBe("Preset Task");
    expect(result.current.config.originalPrompt).toBe("Preset starter prompt");

    // Auth resolves — userId changes from null → "user_a".
    mocks.authUser.current = { id: "user_a" };
    mocks.authSession.current = { accessToken: TOKEN_A };
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([]);
    rerender();

    // Wait for cloud hydration to complete.
    await waitFor(() => {
      expect(mocks.loadDraft).toHaveBeenCalledWith(TOKEN_A);
    });

    // Preset config must survive auth hydration.
    expect(result.current.config.role).toBe("Preset Role");
    expect(result.current.config.task).toBe("Preset Task");
    expect(result.current.config.originalPrompt).toBe("Preset starter prompt");
    expect(result.current.config.tone).toBe("Professional");
    expect(result.current.config.complexity).toBe("Moderate");
  });

  it("rejects save-and-share for signed-out users before any save attempt", async () => {
    mocks.authUser.current = null;
    mocks.authSession.current = null;
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await expect(
      result.current.saveAndSharePrompt({
        title: "Share me",
        useCase: "A valid use case",
      }),
    ).rejects.toThrow("Sign in to share prompts.");

    expect(mocks.savePrompt).not.toHaveBeenCalled();
    expect(mocks.sharePrompt).not.toHaveBeenCalled();
  });

  it("passes a prompt override through save and share actions", async () => {
    mocks.savePrompt.mockResolvedValue({
      outcome: "created",
      warnings: [],
      record: {
        metadata: {
          id: "prompt_1",
          name: "Variant prompt",
          revision: 1,
        },
      },
    });
    mocks.sharePrompt.mockResolvedValue({
      shared: true,
      postId: "post_1",
    });

    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await act(async () => {
      await result.current.savePrompt(
        { title: "Variant prompt" },
        { enhancedPromptOverride: "Short variant prompt" },
      );
    });

      expect(mocks.savePrompt).toHaveBeenNthCalledWith(
      1,
      TOKEN_A,
      expect.objectContaining({
        enhancedPrompt: "Short variant prompt",
      }),
    );

    await act(async () => {
      await result.current.saveAndSharePrompt(
        {
          title: "Variant prompt",
          useCase: "Persist the selected variant",
        },
        { enhancedPromptOverride: "Short variant prompt" },
      );
    });

    expect(mocks.savePrompt).toHaveBeenNthCalledWith(
      2,
      TOKEN_A,
      expect.objectContaining({
        enhancedPrompt: "Short variant prompt",
      }),
    );
    expect(mocks.sharePrompt).toHaveBeenCalledWith(
      TOKEN_A,
      "prompt_1",
      expect.objectContaining({
        title: "Variant prompt",
        useCase: "Persist the selected variant",
      }),
    );
  });
});
