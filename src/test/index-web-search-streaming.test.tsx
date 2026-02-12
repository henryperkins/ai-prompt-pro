import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
  streamEnhance: vi.fn(),
  setEnhancedPrompt: vi.fn(),
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
  inferBuilderFields: vi.fn(),
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => null,
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

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: () => null,
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => null,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => null,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onEnhance,
    onWebSearchToggle,
    webSearchSources,
    reasoningSummary,
  }: {
    onEnhance: () => void;
    onWebSearchToggle?: (enabled: boolean) => void;
    webSearchSources?: string[];
    reasoningSummary?: string;
  }) => (
    <div>
      <button type="button" onClick={() => onWebSearchToggle?.(true)}>
        enable web search
      </button>
      <button type="button" onClick={onEnhance}>
        enhance
      </button>
      <div data-testid="web-sources">{(webSearchSources || []).join("|")}</div>
      <div data-testid="reasoning-summary">{reasoningSummary || ""}</div>
    </div>
  ),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildPromptBuilderState() {
  return {
    config: {
      ...defaultConfig,
      originalPrompt: "Draft launch prompt",
    },
    updateConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built launch prompt",
    score: { total: 70 },
    enhancedPrompt: "",
    setEnhancedPrompt: mocks.setEnhancedPrompt,
    isEnhancing: false,
    setIsEnhancing: vi.fn(),
    isSignedIn: false,
    saveVersion: vi.fn(),
    savePrompt: vi.fn(),
    saveAndSharePrompt: vi.fn(),
    remixContext: null,
    startRemix: vi.fn(),
    clearRemix: vi.fn(),
    updateContextSources: vi.fn(),
    updateDatabaseConnections: vi.fn(),
    updateRagParameters: vi.fn(),
    updateContextStructured: vi.fn(),
    updateContextInterview: vi.fn(),
    updateProjectNotes: vi.fn(),
    toggleDelimiters: vi.fn(),
  };
}

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index web search streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "false");
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes webSearchEnabled and splits sources from streamed output", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        threadOptions,
        onDelta,
      }: {
        threadOptions?: { webSearchEnabled?: boolean };
        onDelta: (text: string) => void;
      }) => {
        expect(threadOptions?.webSearchEnabled).toBe(true);
        onDelta(
          "Enhanced launch prompt.\n---\nSources:\n- [Release notes](https://example.com/release)\n- [Status page](https://status.example.com/)",
        );
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enable web search" }));
    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenCalledWith("Enhanced launch prompt.");
    });
    await waitFor(() => {
      expect(screen.getByTestId("web-sources").textContent).toBe(
        "[Release notes](https://example.com/release)|[Status page](https://status.example.com/)",
      );
    });
  });

  it("captures reasoning summary from stream events", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "item.updated",
          responseType: "response.output_item.updated",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_1", type: "reasoning", delta: "Draft summary. " } },
        });
        onEvent?.({
          eventType: "item.updated",
          responseType: "response.output_item.updated",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_1", type: "reasoning", delta: "More context." } },
        });
        onEvent?.({
          eventType: "item.completed",
          responseType: "response.output_item.done",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_1", type: "reasoning", text: "Final summary." } },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("reasoning-summary").textContent).toBe("Final summary.");
    });
  });

  it("streams reasoning summary from reasoning delta event envelopes", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "item/reasoning/delta",
          responseType: "response.reasoning_summary_text.delta",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_stream_1",
          itemType: "reasoning",
          payload: {
            delta: "Draft ",
            item: { id: "item_reasoning_stream_1", type: "reasoning" },
          },
        });
        onEvent?.({
          eventType: "item/reasoning/delta",
          responseType: "response.reasoning_summary_text.delta",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_stream_1",
          itemType: "reasoning",
          payload: {
            delta: "summary.",
            item: { id: "item_reasoning_stream_1", type: "reasoning" },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("reasoning-summary").textContent).toBe("Draft summary.");
    });
  });

  it("replaces reasoning summary when updated snapshots are rewritten", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "item.updated",
          responseType: "response.output_item.updated",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_replace_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_replace_1", type: "reasoning", text: "Draft summary." } },
        });
        onEvent?.({
          eventType: "item.updated",
          responseType: "response.output_item.updated",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_replace_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_replace_1", type: "reasoning", text: "Rewritten summary." } },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("reasoning-summary").textContent).toBe("Rewritten summary.");
    });
  });

  it("ignores summary events that are not reasoning events", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "summary.completed",
          responseType: "response.summary.done",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_summary_1",
          itemType: "summary",
          payload: { item: { id: "item_summary_1", type: "summary", text: "Ignore this summary." } },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("reasoning-summary").textContent).toBe("");
  });

  it("extracts reasoning summary text from content arrays", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "item.completed",
          responseType: "response.output_item.done",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_2",
          itemType: "reasoning_summary",
          payload: {
            item: {
              id: "item_reasoning_2",
              type: "reasoning_summary",
              content: [{ text: "First sentence. " }, { text: "Second sentence." }],
            },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("reasoning-summary").textContent).toBe("First sentence. Second sentence.");
    });
  });

  it("clears stale reasoning summary before a failed retry", async () => {
    let enhanceRun = 0;
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
        onError,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
        onError?: (error: string) => void;
      }) => {
        enhanceRun += 1;
        if (enhanceRun === 1) {
          onEvent?.({
            eventType: "item.completed",
            responseType: "response.output_item.done",
            threadId: "thread_1",
            turnId: "turn_1",
            itemId: "item_reasoning_3",
            itemType: "reasoning",
            payload: { item: { id: "item_reasoning_3", type: "reasoning", text: "Initial summary." } },
          });
          onDone?.();
          return;
        }

        onError?.("stream failed");
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));
    await waitFor(() => {
      expect(screen.getByTestId("reasoning-summary").textContent).toBe("Initial summary.");
    });

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("reasoning-summary").textContent).toBe("");
  });
});
