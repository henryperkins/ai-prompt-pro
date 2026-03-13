import { act, useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { buildPrompt, defaultConfig, scorePrompt } from "@/lib/prompt-builder";

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
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      Prompt input
      <input
        aria-label="Prompt input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
    builtPrompt,
    enhancedPrompt,
    reasoningSummary,
    webSearchSources,
    previewSource,
    hasEnhancedOnce,
    enhanceMetadata,
    enhancePhase,
    staleEnhancementNotice,
    archivedEnhanceMetadata,
    archivedReasoningSummary,
    archivedEnhanceWorkflow,
    archivedWebSearchSources,
    onEnhance,
    onSavePrompt,
    onApplyToBuilder,
  }: {
    builtPrompt: string;
    enhancedPrompt: string;
    reasoningSummary?: string;
    webSearchSources?: string[];
    previewSource?: string;
    hasEnhancedOnce?: boolean;
    enhanceMetadata?: unknown;
    enhancePhase?: string;
    staleEnhancementNotice?: string | null;
    archivedEnhanceMetadata?: unknown;
    archivedReasoningSummary?: string;
    archivedEnhanceWorkflow?: Array<{ stepId: string; label: string }>;
    archivedWebSearchSources?: string[];
    onEnhance: () => void;
    onSavePrompt: (input: { name: string }) => Promise<boolean>;
    onApplyToBuilder?: (updates: { role?: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={onEnhance}>
        Enhance
      </button>
      <button
        type="button"
        onClick={() => void onSavePrompt({ name: "Stale Save" })}
      >
        Save prompt
      </button>
      <button
        type="button"
        onClick={() => onApplyToBuilder?.({ role: "Senior launch strategist" })}
      >
        Apply role
      </button>
      <div data-testid="built-prompt-prop">{builtPrompt}</div>
      <div data-testid="enhanced-prompt-prop">{enhancedPrompt}</div>
      <div data-testid="reasoning-summary-prop">{reasoningSummary || ""}</div>
      <div data-testid="web-sources-prop">{(webSearchSources || []).join("|")}</div>
      <div data-testid="preview-source-prop">{previewSource || ""}</div>
      <div data-testid="has-current-enhanced-prop">{String(Boolean(hasEnhancedOnce))}</div>
      <div data-testid="has-metadata-prop">{String(Boolean(enhanceMetadata))}</div>
      <div data-testid="enhance-phase-prop">{enhancePhase || ""}</div>
      <div data-testid="stale-notice-prop">{staleEnhancementNotice || ""}</div>
      <div data-testid="archived-metadata-prop">{String(Boolean(archivedEnhanceMetadata))}</div>
      <div data-testid="archived-reasoning-prop">{archivedReasoningSummary || ""}</div>
      <div data-testid="archived-sources-prop">{(archivedWebSearchSources || []).join("|")}</div>
      <div data-testid="archived-workflow-prop">
        {(archivedEnhanceWorkflow || []).map((s) => s.label).join("|")}
      </div>
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

vi.mock("@/components/base/toast", () => ({
  ToastAction: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    const score = scorePrompt(config);

    return {
      config,
      updateConfig,
      builtPrompt: buildPrompt(config),
      score,
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

describe("Index enhancement staleness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.savePrompt.mockResolvedValue({
      outcome: "created",
      warnings: [],
      record: {
        metadata: {
          name: "Stale Save",
          revision: 1,
        },
      },
    });
    mocks.streamEnhance.mockImplementation(
      ({
        onDelta,
        onEvent,
        onDone,
      }: {
        onDelta: (text: string) => void;
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onDelta(
          "Enhanced launch prompt.\n---\nSources:\n- [Docs](https://example.com/docs)",
        );
        onEvent?.({
          eventType: "enhance/metadata",
          responseType: "enhance.metadata",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_metadata_1",
          itemType: "message",
          payload: {
            event: "enhance/metadata",
            type: "enhance.metadata",
            payload: {
              enhanced_prompt: "Enhanced launch prompt.",
              enhancements_made: ["Added structure"],
            },
          },
        });
        onEvent?.({
          eventType: "enhance/workflow",
          responseType: "enhance.workflow",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_workflow_1",
          itemType: "message",
          payload: {
            event: "enhance/workflow",
            type: "enhance.workflow",
            payload: {
              step_id: "draft",
              order: 10,
              label: "Analyze request",
              status: "completed",
              detail: "Draft analysis complete.",
            },
          },
        });
        onEvent?.({
          eventType: "item.delta",
          responseType: "response.output_item.delta",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_1",
          itemType: "reasoning",
          payload: {
            item: {
              id: "item_reasoning_1",
              type: "reasoning",
              text: "Final summary.",
            },
          },
        });
        onDone?.();
      },
    );
  });

  it("falls back to the live builder draft and hides stale enhancement artifacts after edits", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
        "enhanced",
      );
    });
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "true",
    );
    expect(screen.getByTestId("enhanced-prompt-prop")).toHaveTextContent(
      "Enhanced launch prompt.",
    );
    expect(screen.getByTestId("has-metadata-prop")).toHaveTextContent("true");
    expect(screen.getByTestId("web-sources-prop")).toHaveTextContent(
      "[Docs](https://example.com/docs)",
    );
    expect(screen.getByTestId("reasoning-summary-prop")).toHaveTextContent(
      "Final summary.",
    );

    fireEvent.change(screen.getByLabelText("Prompt input"), {
      target: { value: "Updated launch prompt" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
        "prompt_text",
      );
    });
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "false",
    );
    expect(screen.getByTestId("enhanced-prompt-prop")).toHaveTextContent("");
    expect(screen.getByTestId("has-metadata-prop")).toHaveTextContent("false");
    expect(screen.getByTestId("web-sources-prop")).toHaveTextContent("");
    expect(screen.getByTestId("reasoning-summary-prop")).toHaveTextContent("");
    expect(screen.getByTestId("stale-notice-prop")).toHaveTextContent(
      "Builder changed since the last enhancement.",
    );
    expect(screen.getByTestId("built-prompt-prop")).toHaveTextContent(
      "Updated launch prompt",
    );
  });

  it("treats structured builder applies as stale-state edits and saves the draft instead of stale AI output", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
        "enhanced",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply role" }));

    await waitFor(() => {
      expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
        "builder_fields",
      );
    });
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "false",
    );
    expect(screen.getByTestId("built-prompt-prop")).toHaveTextContent(
      "Senior launch strategist",
    );

    mocks.trackBuilderEvent.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() => {
      expect(mocks.savePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Stale Save",
        }),
        {
          enhancedPromptOverride: "",
        },
      );
    });
    expect(mocks.trackBuilderEvent).not.toHaveBeenCalledWith(
      "builder_enhance_accepted",
      expect.anything(),
    );
  });

  it("keeps enhanced output semantics after the done→idle timer fires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    // The mock fires synchronously; flush React state updates.
    await act(async () => {});

    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
      "enhanced",
    );
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "true",
    );

    // Advance past the settling→done timer (260ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("enhance-phase-prop")).toHaveTextContent(
      "done",
    );
    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
      "enhanced",
    );
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "true",
    );

    // Advance past the done→idle timer (1800ms total from settle)
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    // After idle, the visible output must still be treated as current enhanced output
    expect(screen.getByTestId("enhance-phase-prop")).toHaveTextContent(
      "idle",
    );
    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
      "enhanced",
    );
    expect(screen.getByTestId("has-current-enhanced-prop")).toHaveTextContent(
      "true",
    );
    expect(screen.getByTestId("enhanced-prompt-prop")).toHaveTextContent(
      "Enhanced launch prompt.",
    );
    expect(screen.getByTestId("has-metadata-prop")).toHaveTextContent("true");
    expect(screen.getByTestId("stale-notice-prop")).toHaveTextContent("");

    vi.useRealTimers();
  });

  it("passes archived artifacts when builder diverges after enhancement", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("preview-source-prop")).toHaveTextContent(
        "enhanced",
      );
    });
    expect(screen.getByTestId("has-metadata-prop")).toHaveTextContent("true");
    expect(screen.getByTestId("reasoning-summary-prop")).toHaveTextContent(
      "Final summary.",
    );

    // Edit the builder to trigger stale state
    fireEvent.change(screen.getByLabelText("Prompt input"), {
      target: { value: "Updated launch prompt" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("stale-notice-prop")).toHaveTextContent(
        "Builder changed since the last enhancement.",
      );
    });

    // Primary props are cleared (current behavior preserved)
    expect(screen.getByTestId("has-metadata-prop")).toHaveTextContent("false");
    expect(screen.getByTestId("reasoning-summary-prop")).toHaveTextContent("");
    expect(screen.getByTestId("web-sources-prop")).toHaveTextContent("");
    expect(screen.getByTestId("enhanced-prompt-prop")).toHaveTextContent("");

    // Archived props carry the last settled enhancement artifacts
    expect(screen.getByTestId("archived-metadata-prop")).toHaveTextContent(
      "true",
    );
    expect(screen.getByTestId("archived-reasoning-prop")).toHaveTextContent(
      "Final summary.",
    );
    expect(screen.getByTestId("archived-sources-prop")).toHaveTextContent(
      "[Docs](https://example.com/docs)",
    );
    expect(screen.getByTestId("archived-workflow-prop")).toHaveTextContent(
      "Analyze request",
    );
  });
});
