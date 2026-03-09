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
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "false");
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

  afterEach(() => {
    vi.unstubAllEnvs();
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
});
