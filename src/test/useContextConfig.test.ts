import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

describe("useContextConfig", () => {
  it("updates context sources and marks dirty", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    act(() => {
      result.current.updateContextSources([{ type: "file", name: "test.ts", content: "code" }]);
    });

    expect(setConfig).toHaveBeenCalledTimes(1);
    expect(markDraftDirty).toHaveBeenCalledTimes(1);

    // Verify the updater produces the correct config shape
    const updater = setConfig.mock.calls[0][0] as (prev: PromptConfig) => PromptConfig;
    const updated = updater(defaultConfig);
    expect(updated.contextConfig.sources).toEqual([{ type: "file", name: "test.ts", content: "code" }]);
  });

  it("merges rag parameters into existing config", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    act(() => {
      result.current.updateRagParameters({ topK: 10 });
    });

    const updater = setConfig.mock.calls[0][0] as (prev: PromptConfig) => PromptConfig;
    const updated = updater(defaultConfig);
    expect(updated.contextConfig.rag.topK).toBe(10);
    expect(markDraftDirty).toHaveBeenCalledTimes(1);
  });

  it("toggles delimiters", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    act(() => {
      result.current.toggleDelimiters(true);
    });

    const updater = setConfig.mock.calls[0][0] as (prev: PromptConfig) => PromptConfig;
    const updated = updater(defaultConfig);
    expect(updated.contextConfig.useDelimiters).toBe(true);
    expect(markDraftDirty).toHaveBeenCalledTimes(1);
  });

  it("updates structured context fields", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    act(() => {
      result.current.updateContextStructured({ audienceLevel: "expert" });
    });

    const updater = setConfig.mock.calls[0][0] as (prev: PromptConfig) => PromptConfig;
    const updated = updater(defaultConfig);
    expect(updated.contextConfig.structured.audienceLevel).toBe("expert");
  });

  it("updates project notes", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    act(() => {
      result.current.updateProjectNotes("New project notes");
    });

    const updater = setConfig.mock.calls[0][0] as (prev: PromptConfig) => PromptConfig;
    const updated = updater(defaultConfig);
    expect(updated.contextConfig.projectNotes).toBe("New project notes");
  });

  it("returns stable callback references across re-renders", async () => {
    const { useContextConfig } = await import("@/hooks/useContextConfig");
    const setConfig = vi.fn();
    const markDraftDirty = vi.fn();

    const { result, rerender } = renderHook(() => useContextConfig(setConfig, markDraftDirty));

    const first = { ...result.current };
    rerender();

    expect(result.current.updateContextSources).toBe(first.updateContextSources);
    expect(result.current.updateRagParameters).toBe(first.updateRagParameters);
    expect(result.current.toggleDelimiters).toBe(first.toggleDelimiters);
  });
});
