import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  inferBuilderFields: vi.fn(),
  streamEnhance: vi.fn(),
  saveVersion: vi.fn(),
  savePrompt: vi.fn(),
  saveAndSharePrompt: vi.fn(),
  trackBuilderEvent: vi.fn(),
}));

type EnhanceStreamEvent = {
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
  payload: unknown;
};

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/ai-client", () => ({
  inferBuilderFields: (...args: unknown[]) => mocks.inferBuilderFields(...args),
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => null,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: ({
    onClear,
    onResetAll,
    intentOverride,
    onIntentOverrideChange,
  }: {
    onClear: () => void;
    onResetAll: () => void;
    intentOverride: string | null;
    onIntentOverrideChange: (intent: string | null) => void;
  }) => (
    <div>
      <div data-testid="intent-override">{intentOverride ?? "null"}</div>
      <button type="button" onClick={() => onIntentOverrideChange("rewrite")}>
        Set override rewrite
      </button>
      <button type="button" onClick={() => onIntentOverrideChange("analysis")}>
        Set override analysis
      </button>
      <button type="button" onClick={() => onIntentOverrideChange(null)}>
        Use auto-detect
      </button>
      <button type="button" onClick={onClear}>
        Clear prompt
      </button>
      <button type="button" onClick={onResetAll}>
        Reset all
      </button>
    </div>
  ),
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => null,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => null,
}));

vi.mock("@/components/BuilderTabs", () => ({
  BuilderTabs: () => null,
}));

vi.mock("@/components/ContextPanel", () => ({
  ContextPanel: () => null,
}));

vi.mock("@/components/ToneControls", () => ({
  ToneControls: () => null,
}));

vi.mock("@/components/QualityScore", () => ({
  QualityScore: () => null,
}));

vi.mock("@/components/CodexSessionDrawer", () => ({
  CodexSessionDrawer: () => null,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onEnhance,
    activeVariant,
  }: {
    onEnhance: () => void;
    activeVariant?: string;
  }) => (
    <div>
      <button type="button" onClick={onEnhance}>
        Enhance
      </button>
      <div data-testid="active-variant">{activeVariant ?? "original"}</div>
    </div>
  ),
}));

vi.mock("@/components/base/primitives/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    open ? <div>{children}</div> : null
  ),
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/base/badges/badges", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/base/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => {
    const [config, setConfig] = useState({
      ...defaultConfig,
      originalPrompt: "Draft prompt for override test",
    });
    const [enhancedPrompt, setEnhancedPrompt] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const updateConfig = useCallback((updates: Partial<typeof defaultConfig>) => {
      setConfig((previous) => ({ ...previous, ...updates }));
    }, []);
    const stableFns = useMemo(
      () => ({
        resetConfig: vi.fn(),
        clearOriginalPrompt: vi.fn(),
        saveVersion: (...args: unknown[]) => mocks.saveVersion(...args),
        savePrompt: (...args: unknown[]) => mocks.savePrompt(...args),
        saveAndSharePrompt: (...args: unknown[]) => mocks.saveAndSharePrompt(...args),
        loadTemplate: vi.fn(),
        startRemix: vi.fn(),
        clearRemix: vi.fn(),
        updateContextSources: vi.fn(),
        updateDatabaseConnections: vi.fn(),
        updateRagParameters: vi.fn(),
        updateContextStructured: vi.fn(),
        updateContextInterview: vi.fn(),
        updateProjectNotes: vi.fn(),
        toggleDelimiters: vi.fn(),
      }),
      [],
    );

    return {
      config,
      updateConfig,
      builtPrompt: "Built prompt",
      score: { total: 70, tips: ["tip"] },
      enhancedPrompt,
      setEnhancedPrompt,
      isEnhancing,
      setIsEnhancing,
      isSignedIn: false,
      remixContext: null,
      versions: [],
      templateSummaries: [],
      ...stableFns,
    };
  },
}));

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("High-1: Clear sticky intentOverride and enhancement override state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: null,
          responseType: null,
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_1",
          itemType: "message",
          payload: {
            event: "enhance/metadata",
            payload: {
              enhanced_prompt: "Enhanced prompt text",
              alternative_versions: {
                shorter: "Shorter variant",
              },
            },
          },
        });
        onDone?.();
      },
    );
  });

  it("clears intentOverride after handleClearPrompt", async () => {
    await renderIndex();

    // Set an intent override
    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("rewrite");
    });

    // Clear prompt — should clear override
    fireEvent.click(screen.getByRole("button", { name: "Clear prompt" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("null");
    });
  });

  it("clears intentOverride after handleResetAll", async () => {
    await renderIndex();

    // Set an intent override
    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("rewrite");
    });

    // Reset all — should clear override
    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("null");
    });
  });

  it("resets activeEnhancementVariant to original after clear", async () => {
    await renderIndex();

    // Trigger enhance to populate metadata
    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toHaveTextContent("original");
    });

    // Clear prompt — variant should remain at original (not stuck on stale value)
    fireEvent.click(screen.getByRole("button", { name: "Clear prompt" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toHaveTextContent("original");
    });
  });

  it("clears intentOverride after enhance then clear to ensure no stale rehydration", async () => {
    await renderIndex();

    // Set override and enhance
    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("rewrite");
    });

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toBeTruthy();
    });

    // Now clear — override and variant must be reset
    fireEvent.click(screen.getByRole("button", { name: "Clear prompt" }));
    await waitFor(() => {
      expect(screen.getByTestId("intent-override")).toHaveTextContent("null");
    });
  });

  it("tracks effective intent transitions including explicit override back to auto", async () => {
    await renderIndex();
    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_intent_overridden",
      expect.objectContaining({
        fromIntent: "auto",
        toIntent: "rewrite",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set override analysis" }));
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_intent_overridden",
      expect.objectContaining({
        fromIntent: "rewrite",
        toIntent: "analysis",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Use auto-detect" }));
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_intent_overridden",
      expect.objectContaining({
        fromIntent: "analysis",
        toIntent: "auto",
      }),
    );
  });

  it("ignores no-op intent transitions", async () => {
    await renderIndex();
    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Use auto-detect" }));
    expect(mocks.trackBuilderEvent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    expect(mocks.trackBuilderEvent).toHaveBeenCalledTimes(1);

    mocks.trackBuilderEvent.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Set override rewrite" }));
    expect(mocks.trackBuilderEvent).not.toHaveBeenCalled();
  });

  it("resets enhancement preferences and learned profile from the UI", async () => {
    localStorage.setItem(
      "promptforge-user-prefs",
      JSON.stringify({
        theme: "midnight",
        webSearchEnabled: true,
        showAdvancedControls: true,
        recentlyUsedPresetIds: [],
        favoritePresetIds: [],
        enhancementDepth: "advanced",
        rewriteStrictness: "aggressive",
        ambiguityMode: "ask_me",
      }),
    );
    localStorage.setItem(
      "promptforge-enhancement-profile",
      JSON.stringify({
        depthCounts: { advanced: 2 },
        strictnessCounts: { aggressive: 2 },
        ambiguityModeCounts: { ask_me: 2 },
        variantCounts: { shorter: 1 },
        intentOverrideCounts: { rewrite: 1 },
        assumptionEditCounts: { constraints: 1 },
        formatCounts: { Markdown: 1 },
        structuredApplyCounts: { all: 1 },
        acceptCount: 1,
        rerunCount: 1,
        totalEnhancements: 3,
      }),
    );

    await renderIndex();

    fireEvent.click(
      screen.getByRole("button", { name: "Reset enhancement preferences" }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Enhancement preferences reset",
        }),
      );
    });

    expect(localStorage.getItem("promptforge-enhancement-profile")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("promptforge-user-prefs") ?? "{}"),
    ).toEqual(
      expect.objectContaining({
        theme: "midnight",
        enhancementDepth: "guided",
        rewriteStrictness: "balanced",
        ambiguityMode: "infer_conservatively",
      }),
    );
  });
});
