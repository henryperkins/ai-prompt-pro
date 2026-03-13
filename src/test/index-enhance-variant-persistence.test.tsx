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
  isAIClientError: () => false,
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
  isEnhanceDebugEnabled: () => false,
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));


vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: () => null,
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => null,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => null,
}));





vi.mock("@/components/CodexSessionDrawer", () => ({
  CodexSessionDrawer: ({ currentPromptText }: { currentPromptText: string }) => (
    <div data-testid="current-prompt-text">{currentPromptText}</div>
  ),
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onEnhance,
    onSaveVersion,
    onSavePrompt,
    activeVariant = "original",
    onVariantChange,
    enhanceMetadata,
  }: {
    onEnhance: () => void;
    onSaveVersion: () => void;
    onSavePrompt: (input: { name: string }) => void;
    activeVariant?: "original" | "shorter" | "more_detailed";
    onVariantChange?: (variant: "original" | "shorter" | "more_detailed") => void;
    enhanceMetadata?: {
      alternativeVersions?: { shorter?: string };
    } | null;
  }) => (
    <div>
      <button type="button" onClick={onEnhance}>
        Enhance
      </button>
      <button type="button" onClick={onSaveVersion}>
        Save version
      </button>
      <button type="button" onClick={() => onSavePrompt({ name: "Variant save" })}>
        Save prompt
      </button>
      <div data-testid="active-variant">{activeVariant}</div>
      {enhanceMetadata?.alternativeVersions?.shorter ? (
        <button type="button" onClick={() => onVariantChange?.("shorter")}>
          Use shorter
        </button>
      ) : null}
    </div>
  ),
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
      originalPrompt: "Draft launch prompt",
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
      builtPrompt: "Built launch prompt",
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

describe("Index enhancement variant persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.savePrompt.mockResolvedValue({
      outcome: "created",
      warnings: [],
      record: {
        metadata: {
          name: "Variant save",
          revision: 1,
        },
      },
    });
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
              enhanced_prompt: "Enhanced original prompt",
              alternative_versions: {
                shorter: "Short variant prompt",
              },
            },
          },
        });
        onDone?.();
      },
    );
  });

  it("routes selected variants into save and session reuse flows", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use shorter" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("current-prompt-text")).toHaveTextContent("Enhanced original prompt");
    });

    fireEvent.click(screen.getByRole("button", { name: "Use shorter" }));

    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toHaveTextContent("shorter");
    });
    await waitFor(() => {
      expect(screen.getByTestId("current-prompt-text")).toHaveTextContent("Short variant prompt");
    });

    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    expect(mocks.saveVersion).toHaveBeenCalledWith(undefined, "Short variant prompt");

    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() => {
      expect(mocks.savePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Variant save",
        }),
        {
          enhancedPromptOverride: "Short variant prompt",
        },
      );
    });
  });

  it("emits acceptance immediately with the selected variant payload", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use shorter" })).toBeInTheDocument();
    });

    // Switch to shorter variant
    fireEvent.click(screen.getByRole("button", { name: "Use shorter" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toHaveTextContent("shorter");
    });

    // Mark the output as used via save
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));
    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_accepted",
        expect.objectContaining({
          source: "save",
          promptChars: "Short variant prompt".length,
          variant: "shorter",
        }),
      );
    });
  });

  it("emits rerun without duplicating acceptance after a saved variant", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use shorter" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Use shorter" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-variant")).toHaveTextContent("shorter");
    });

    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));
    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_accepted",
        expect.objectContaining({
          source: "save",
          promptChars: "Short variant prompt".length,
        }),
      );
    });

    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_rerun",
        expect.objectContaining({
          previousPromptChars: "Short variant prompt".length,
          variant: "shorter",
        }),
      );
    });

    expect(mocks.trackBuilderEvent).not.toHaveBeenCalledWith(
      "builder_enhance_accepted",
      expect.anything(),
    );
  });

  it("uses original enhanced prompt length for acceptance and rerun telemetry when variant is original", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use shorter" })).toBeInTheDocument();
    });

    // Mark output as used without switching variant
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));
    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_accepted",
        expect.objectContaining({
          source: "save",
          promptChars: "Enhanced original prompt".length,
          variant: "original",
        }),
      );
    });

    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_rerun",
        expect.objectContaining({
          previousPromptChars: "Enhanced original prompt".length,
          variant: "original",
        }),
      );
    });
  });

  it("emits rerun only when the previous output was never accepted", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use shorter" })).toBeInTheDocument();
    });

    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
        "builder_enhance_rerun",
        expect.objectContaining({
          previousPromptChars: "Enhanced original prompt".length,
          variant: "original",
        }),
      );
    });

    expect(mocks.trackBuilderEvent).not.toHaveBeenCalledWith(
      "builder_enhance_accepted",
      expect.anything(),
    );
    expect(mocks.trackBuilderEvent).not.toHaveBeenCalledWith(
      "builder_enhance_rerun",
      expect.objectContaining({
        previousPromptChars: "Short variant prompt".length,
      }),
    );
  });
});
