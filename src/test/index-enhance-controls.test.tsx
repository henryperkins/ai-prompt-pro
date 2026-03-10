import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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


vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: ({
    value,
    onChange,
    detectedIntent,
    intentOverride,
    onIntentOverrideChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    detectedIntent: string | null;
    intentOverride: string | null;
    onIntentOverrideChange?: (intent: string | null) => void;
  }) => (
    <div>
      <div data-testid="prompt-value">{value}</div>
      <div data-testid="detected-intent">{detectedIntent ?? "null"}</div>
      <div data-testid="intent-override">{intentOverride ?? "null"}</div>
      <button type="button" onClick={() => onChange("Analyze these retention numbers by cohort")}>
        Set analysis prompt
      </button>
      <button
        type="button"
        onClick={() => onChange("Rewrite this sales email for enterprise buyers")}
      >
        Set rewrite prompt
      </button>
      <button type="button" onClick={() => onChange("Help")}>
        Set vague prompt
      </button>
      <button
        type="button"
        onClick={() => onIntentOverrideChange?.("rewrite")}
      >
        Override rewrite
      </button>
      <button
        type="button"
        onClick={() => onIntentOverrideChange?.(null)}
      >
        Use auto-detect
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





vi.mock("@/components/CodexSessionDrawer", () => ({
  CodexSessionDrawer: () => null,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onEnhance,
  }: {
    onEnhance: () => void;
  }) => (
    <div>
      <button type="button" onClick={onEnhance}>
        Enhance
      </button>
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
      originalPrompt: "Analyze these retention numbers by cohort",
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
      builtPrompt: config.originalPrompt || "Built prompt",
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

describe("Index enhancement controls", () => {
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
              detected_context: {
                primary_intent: "research",
                intent: ["research"],
                domain: ["business"],
                complexity: 3,
                mode: "guided",
                input_language: "en",
              },
            },
          },
        });
        onDone?.();
      },
    );
  });

  it("shows detected intent before the first enhancement and updates with live draft changes", async () => {
    await renderIndex();

    expect(screen.getByTestId("detected-intent")).toHaveTextContent("analysis");
    expect(mocks.streamEnhance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Set rewrite prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("detected-intent")).toHaveTextContent("rewrite");
    });
    expect(mocks.streamEnhance).not.toHaveBeenCalled();
  });

  it("sends an intent override chosen before the first enhancement run", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Override rewrite" }));
    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalled();
    });

    expect(mocks.streamEnhance.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        intentOverride: "rewrite",
      }),
    );
  });

  it("does not keep stale metadata-driven intent after the draft changes", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalled();
    });
    expect(screen.getByTestId("detected-intent")).toHaveTextContent("analysis");

    fireEvent.click(screen.getByRole("button", { name: "Set vague prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("detected-intent")).toHaveTextContent("null");
    });
  });
});
