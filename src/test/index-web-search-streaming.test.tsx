import { useCallback, useMemo, useState, type ReactNode } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";
import { renderWithAuthContext } from "@/test/render-with-auth-context";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  streamEnhance: vi.fn(),
  setEnhancedPrompt: vi.fn(),
  promptBuilderOverrides: {} as Record<string, unknown>,
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
  isAIClientError: () => false,
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/CodexSessionDrawer", () => ({
  CodexSessionDrawer: ({
    open,
    session,
    onUpdateSession,
    onUseCurrentPrompt,
  }: {
    open?: boolean;
    session?: {
      contextSummary?: string;
      latestEnhancedPrompt?: string;
    };
    onUpdateSession?: (updates: {
      contextSummary?: string;
      latestEnhancedPrompt?: string;
    }) => void;
    onUseCurrentPrompt?: () => void;
  }) => (
    <div>
      <div data-testid="codex-session-context-summary">
        {session?.contextSummary ?? ""}
      </div>
      {open ? (
        <div>
          <input
            aria-label="Outside context summary"
            value={session?.contextSummary ?? ""}
            onChange={(event) =>
              onUpdateSession?.({ contextSummary: event.target.value })
            }
          />
          <input
            aria-label="Carry-forward prompt"
            value={session?.latestEnhancedPrompt ?? ""}
            onChange={(event) =>
              onUpdateSession?.({ latestEnhancedPrompt: event.target.value })
            }
          />
          <button type="button" onClick={onUseCurrentPrompt}>
            Use current preview
          </button>
        </div>
      ) : null}
    </div>
  ),
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
    builtPrompt,
    enhancedPrompt,
    previewSource,
    onEnhance,
    onWebSearchToggle,
    onAppendToSessionContext,
    webSearchSources,
    webSearchActivity,
    reasoningSummary,
    enhanceWorkflow,
  }: {
    builtPrompt?: string;
    enhancedPrompt?: string;
    previewSource?: string;
    onEnhance: () => void;
    onWebSearchToggle?: (enabled: boolean) => void;
    onAppendToSessionContext?: (content: string) => void;
    webSearchSources?: string[];
    webSearchActivity?: {
      phase?: string;
      searchCount?: number;
      query?: string | null;
    };
    reasoningSummary?: string;
    enhanceWorkflow?: Array<{ label?: string; status?: string; detail?: string }>;
  }) => (
    <div>
      <button type="button" onClick={() => onWebSearchToggle?.(true)}>
        enable web search
      </button>
      {onAppendToSessionContext ? (
        <button
          type="button"
          onClick={() =>
            onAppendToSessionContext(
              "Clarification questions to answer before finalizing:\n1. What audience should this target?",
            )
          }
        >
          add to session context
        </button>
      ) : null}
      <button type="button" onClick={onEnhance}>
        enhance
      </button>
      <div data-testid="built-prompt">{builtPrompt || ""}</div>
      <div data-testid="enhanced-prompt">{enhancedPrompt || ""}</div>
      <div data-testid="preview-source">{previewSource || ""}</div>
      <div data-testid="web-sources">{(webSearchSources || []).join("|")}</div>
      <div data-testid="web-search-phase">{webSearchActivity?.phase || "idle"}</div>
      <div data-testid="web-search-count">{String(webSearchActivity?.searchCount || 0)}</div>
      <div data-testid="web-search-query">{webSearchActivity?.query || ""}</div>
      <div data-testid="reasoning-summary">{reasoningSummary || ""}</div>
      <div data-testid="workflow-steps">
        {(enhanceWorkflow || [])
          .map((step) => `${step.label || ""}:${step.status || ""}`)
          .join("|")}
      </div>
      <div data-testid="workflow-details">
        {(enhanceWorkflow || [])
          .map((step) => `${step.label || ""}:${step.detail || ""}`)
          .join("|")}
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

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => {
    const overrides = mocks.promptBuilderOverrides;
    const [config] = useState({
      ...defaultConfig,
      originalPrompt: "Draft launch prompt",
    });
    const [enhancedPrompt, setEnhancedPromptState] = useState(
      typeof overrides.enhancedPrompt === "string" ? overrides.enhancedPrompt : "",
    );
    const setEnhancedPrompt = useCallback((value: string) => {
      mocks.setEnhancedPrompt(value);
      setEnhancedPromptState(value);
    }, []);
    const stableFns = useMemo(
      () => ({
        updateConfig: vi.fn(),
        resetConfig: vi.fn(),
        clearOriginalPrompt: vi.fn(),
        saveVersion: vi.fn(),
        savePrompt: vi.fn(),
        saveAndSharePrompt: vi.fn(),
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
      builtPrompt: "Built launch prompt",
      score: { total: 70 },
      enhancedPrompt,
      setEnhancedPrompt,
      isEnhancing: false,
      setIsEnhancing: vi.fn(),
      isSignedIn: Boolean(overrides.isSignedIn),
      loadTemplate: vi.fn(),
      remixContext: null,
      ...stableFns,
    };
  },
}));

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  return renderWithAuthContext(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index web search streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.promptBuilderOverrides = {};
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

  it("resets web search activity after a successful enhance completes", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
        onDone,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        onEvent?.({
          eventType: "item.started",
          responseType: "response.output_item.added",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_ws_1",
          itemType: "web_search_call",
          payload: {
            item: {
              id: "item_ws_1",
              type: "web_search_call",
              arguments: '{"query":"latest React docs"}',
            },
          },
        });
        onEvent?.({
          eventType: "item.completed",
          responseType: "response.output_item.done",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_prompt_1",
          itemType: "agent_message",
          payload: {
            event: "item.completed",
            type: "item.completed",
            item: {
              id: "item_prompt_1",
              type: "agent_message",
              text: "Enhanced launch prompt.",
            },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("web-search-phase")).toHaveTextContent("idle");
    });
    expect(screen.getByTestId("web-search-count")).toHaveTextContent("0");
    expect(screen.getByTestId("web-search-query")).toHaveTextContent("");
  });

  it("replaces raw streamed JSON with enhance metadata enhanced_prompt", async () => {
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
          "{\"enhanced_prompt\":\"Canonical prompt output\"}",
        );
        onDelta("Canonical prompt output");
        onEvent?.({
          eventType: "enhance/metadata",
          responseType: null,
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: null,
          itemType: null,
          payload: {
            event: "enhance/metadata",
            type: "enhance.metadata",
            payload: {
              enhanced_prompt: "Canonical prompt output",
            },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenLastCalledWith("Canonical prompt output");
    });
  });

  it("captures explicit workflow steps from enhance.workflow events", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onEvent,
      }: {
        onEvent?: (event: EnhanceStreamEvent) => void;
      }) => {
        onEvent?.({
          eventType: "enhance/workflow",
          responseType: "enhance.workflow",
          threadId: null,
          turnId: "turn_1",
          itemId: null,
          itemType: null,
          payload: {
            event: "enhance/workflow",
            type: "enhance.workflow",
            payload: {
              step_id: "analyze_request",
              order: 10,
              label: "Analyze request",
              status: "completed",
              detail: "Detected analysis intent in structured rewrite mode.",
            },
          },
        });
        onEvent?.({
          eventType: "enhance/workflow",
          responseType: "enhance.workflow",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: null,
          itemType: null,
          payload: {
            event: "enhance/workflow",
            type: "enhance.workflow",
            payload: {
              step_id: "generate_prompt",
              order: 40,
              label: "Generate enhanced prompt",
              status: "running",
              detail: "Generating the enhanced prompt and supporting artifacts.",
            },
          },
        });
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(screen.getByTestId("workflow-steps")).toHaveTextContent(
        "Analyze request:completed|Generate enhanced prompt:running",
      );
    });
  });

  it("keeps the draft in preview while routing live assistant text into workflow", async () => {
    let streamHandlers:
      | {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }
      | undefined;

    mocks.streamEnhance.mockImplementation(
      (handlers: {
        onEvent?: (event: EnhanceStreamEvent) => void;
        onDone?: () => void;
      }) => {
        streamHandlers = handlers;
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(1);
    });

    act(() => {
      streamHandlers?.onEvent?.({
        eventType: "item.updated",
        responseType: "response.output_item.updated",
        threadId: "thread_1",
        turnId: "turn_1",
        itemId: "item_agent_live_1",
        itemType: "agent_message",
        payload: {
          item: {
            id: "item_agent_live_1",
            type: "agent_message",
            text: "I am drafting a stronger version of your prompt.",
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("preview-source")).toHaveTextContent(
        "prompt_text",
      );
    });
    expect(screen.getByTestId("built-prompt")).toHaveTextContent(
      "Built launch prompt",
    );
    expect(screen.getByTestId("enhanced-prompt")).toHaveTextContent("");
    expect(screen.getByTestId("workflow-details")).toHaveTextContent(
      "Generate enhanced prompt:I am drafting a stronger version of your prompt.",
    );

    act(() => {
      streamHandlers?.onEvent?.({
        eventType: "item.completed",
        responseType: "response.output_text.done",
        threadId: "thread_1",
        turnId: "turn_1",
        itemId: "item_agent_live_1",
        itemType: "agent_message",
        payload: {
          event: "item.completed",
          type: "response.output_text.done",
          item_id: "item_agent_live_1",
          item_type: "agent_message",
          item: {
            id: "item_agent_live_1",
            type: "agent_message",
            text: "Enhanced launch prompt.",
          },
        },
      });
      streamHandlers?.onEvent?.({
        eventType: "enhance/metadata",
        responseType: "enhance.metadata",
        threadId: "thread_1",
        turnId: "turn_1",
        itemId: null,
        itemType: null,
        payload: {
          event: "enhance/metadata",
          type: "enhance.metadata",
          payload: {
            enhanced_prompt: "Enhanced launch prompt.",
          },
        },
      });
      streamHandlers?.onDone?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId("preview-source")).toHaveTextContent(
        "enhanced",
      );
    });
    expect(screen.getByTestId("enhanced-prompt")).toHaveTextContent(
      "Enhanced launch prompt.",
    );
  });

  it("extracts enhanced_prompt from fenced streamed JSON without metadata", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onDelta,
        onDone,
      }: {
        onDelta: (text: string) => void;
        onDone?: () => void;
      }) => {
        onDelta(
          "```json\n{\"enhanced_prompt\":\"Canonical prompt output\\n---\\nSources:\\n- [Docs](https://example.com/docs)\"}\n```",
        );
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenLastCalledWith("Canonical prompt output");
    });
    await waitFor(() => {
      expect(screen.getByTestId("web-sources").textContent).toBe("[Docs](https://example.com/docs)");
    });
  });

  it("extracts enhanced_prompt from streamed JSON without metadata or sources", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onDelta,
        onDone,
      }: {
        onDelta: (text: string) => void;
        onDone?: () => void;
      }) => {
        onDelta(
          "{\"enhanced_prompt\":\"Canonical prompt output\"}",
        );
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenLastCalledWith("Canonical prompt output");
    });
  });

  it("reuses the active Codex session across enhancement turns", async () => {
    let callCount = 0;

    mocks.streamEnhance.mockImplementation(
      ({
        session,
        onSession,
        onDone,
      }: {
        session?: {
          threadId?: string | null;
          contextSummary?: string;
          latestEnhancedPrompt?: string;
          lastRunContextSummary?: string;
          lastRunEnhancedPrompt?: string;
        };
        onSession?: (session: {
          threadId: string | null;
          contextSummary: string;
          latestEnhancedPrompt: string;
          lastRunContextSummary?: string;
          lastRunEnhancedPrompt?: string;
        }) => void;
        onDone?: () => void;
      }) => {
        callCount += 1;

        if (callCount === 1) {
          expect(session?.threadId ?? null).toBeNull();
          onSession?.({
            threadId: "thread_1",
            contextSummary: "",
            latestEnhancedPrompt: "",
            lastRunContextSummary: "Carry forward the brand and audience context.",
            lastRunEnhancedPrompt: "First enhanced prompt.",
          });
          onDone?.();
          return;
        }

        expect(session?.threadId).toBe("thread_1");
        expect(session?.contextSummary ?? "").toBe("");
        expect(session?.latestEnhancedPrompt ?? "").toBe("");
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));
    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));
    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(2);
    });
  });

  it("requires sign-in before opening the Codex session drawer", async () => {
    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: /sign in to use/i }));

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sign in required",
        description: "Sign in to manage Codex session context.",
        variant: "destructive",
      }),
    );
    expect(screen.getByTestId("codex-session-context-summary")).toHaveTextContent(
      "",
    );
  });

  it("hides session-context mutation actions from signed-out review surfaces", async () => {
    await renderIndex();

    expect(
      screen.queryByRole("button", { name: "add to session context" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("codex-session-context-summary")).toHaveTextContent(
      "",
    );
  });

  it("surfaces a destructive toast when enhance completes without prompt output", async () => {
    mocks.streamEnhance.mockImplementation(
      ({
        onDone,
      }: {
        onDone?: () => void;
      }) => {
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Enhancement incomplete",
          description:
            "The enhancement finished without returning a prompt. Please try again.",
          variant: "destructive",
        }),
      );
    });
  });

  it("sends user-edited Codex session context from the drawer", async () => {
    mocks.promptBuilderOverrides = { isSignedIn: true };
    mocks.streamEnhance.mockImplementation(
      ({
        session,
      }: {
        session?: {
          contextSummary?: string;
          latestEnhancedPrompt?: string;
        };
      }) => {
        expect(session?.contextSummary).toBe("Bring in the sales brief and the partner launch notes.");
        expect(session?.latestEnhancedPrompt).toBe("Carry forward this refined partner launch prompt.");
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: /open drawer/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Outside context summary" }), {
      target: { value: "Bring in the sales brief and the partner launch notes." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Carry-forward prompt" }), {
      target: { value: "Carry forward this refined partner launch prompt." },
    });
    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps streamed prompt text when metadata arrives after clean deltas", async () => {
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
        onDelta("Streaming prompt output");
        onEvent?.({
          eventType: "enhance/metadata",
          responseType: null,
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: null,
          itemType: null,
          payload: {
            event: "enhance/metadata",
            type: "enhance.metadata",
            payload: {
              enhanced_prompt: "Canonical prompt output",
            },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenLastCalledWith("Streaming prompt output");
    });
  });

  it("replaces prior streamed text when a completed output item rewrites the result", async () => {
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
        onEvent?.({
          eventType: "item/agent_message/delta",
          responseType: "response.output_text.delta",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_agent_1",
          itemType: "agent_message",
          payload: {
            event: "item/agent_message/delta",
            type: "response.output_text.delta",
            item_id: "item_agent_1",
            item_type: "agent_message",
            delta: "foo",
            item: { id: "item_agent_1", type: "agent_message", text: "foo" },
          },
        });
        onDelta("foo");
        onEvent?.({
          eventType: "item/completed",
          responseType: "response.output_text.done",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_agent_1",
          itemType: "agent_message",
          payload: {
            event: "item/completed",
            type: "response.output_text.done",
            item_id: "item_agent_1",
            item_type: "agent_message",
            payload: { text: "bar" },
            item: { id: "item_agent_1", type: "agent_message", text: "bar" },
          },
        });
        onDone?.();
      },
    );

    await renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    await waitFor(() => {
      expect(mocks.setEnhancedPrompt).toHaveBeenLastCalledWith("bar");
    });
  });

  it("aborts an in-flight stream when the page unmounts", async () => {
    let receivedSignal: AbortSignal | undefined;
    mocks.streamEnhance.mockImplementation(({ signal }: { signal?: AbortSignal }) => {
      receivedSignal = signal;
    });

    const view = await renderIndex();
    fireEvent.click(screen.getByRole("button", { name: "enhance" }));

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);

    view.unmount();

    expect(receivedSignal?.aborted).toBe(true);
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

  it("appends reasoning summary from raw item.updated delta payloads", async () => {
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
          itemId: "item_reasoning_raw_delta_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_raw_delta_1", type: "reasoning", delta: "Draft " } },
        });
        onEvent?.({
          eventType: "item.updated",
          responseType: "response.output_item.updated",
          threadId: "thread_1",
          turnId: "turn_1",
          itemId: "item_reasoning_raw_delta_1",
          itemType: "reasoning",
          payload: { item: { id: "item_reasoning_raw_delta_1", type: "reasoning", delta: "summary." } },
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
        onError?: (error: { message: string; code?: string }) => void;
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

        onError?.({ message: "stream failed", code: "service_error" });
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
