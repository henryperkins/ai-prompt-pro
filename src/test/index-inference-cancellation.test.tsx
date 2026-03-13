import { useCallback, useMemo, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  inferBuilderFields: vi.fn(),
  streamEnhance: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/ai-client", () => ({
  inferBuilderFields: (...args: unknown[]) => mocks.inferBuilderFields(...args),
  isAIClientError: (error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { name?: string }).name === "AIClientError"),
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: ({
    value,
    onChange,
    suggestionChips = [],
    inferenceStatusMessage,
  }: {
    value: string;
    onChange: (value: string) => void;
    suggestionChips?: Array<{ id: string; label: string }>;
    inferenceStatusMessage?: string | null;
  }) => (
    <div>
      <label htmlFor="builder-hero-input">Redesign Hero Input</label>
      <textarea
        id="builder-hero-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {inferenceStatusMessage ? <p role="status">{inferenceStatusMessage}</p> : null}
      <div>
        {suggestionChips.map((chip) => (
          <span key={chip.id}>{chip.label}</span>
        ))}
      </div>
    </div>
  ),
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => <div>Adjust Details</div>,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => <div>Sources Advanced</div>,
}));






vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: () => <div>Output panel</div>,
}));


vi.mock("@/components/base/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
    const [config, setConfig] = useState(defaultConfig);
    const updateConfig = useCallback((updates: Partial<typeof defaultConfig>) => {
      setConfig((previous) => ({ ...previous, ...updates }));
    }, []);
    const stableFns = useMemo(
      () => ({
        resetConfig: vi.fn(),
        setEnhancedPrompt: vi.fn(),
        setIsEnhancing: vi.fn(),
        saveVersion: vi.fn(),
        savePrompt: vi.fn(),
        saveAndSharePrompt: vi.fn(),
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
    const clearOriginalPrompt = useCallback(() => {
      updateConfig({ originalPrompt: "" });
    }, [updateConfig]);

    return {
      config,
      updateConfig,
      clearOriginalPrompt,
      builtPrompt: "Built prompt",
      score: { total: 70, tips: ["tip"] },
      enhancedPrompt: "",
      isEnhancing: false,
      isSignedIn: false,
      remixContext: null,
      ...stableFns,
    };
  },
}));

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index suggestion inference cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores stale remote suggestions after prompt is cleared", async () => {
    let resolveInference: ((value: unknown) => void) | null = null;

    mocks.inferBuilderFields.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInference = resolve;
        }),
    );

    await renderIndex();

    const promptInput = screen.getByLabelText("Redesign Hero Input");
    fireEvent.change(promptInput, {
      target: { value: "Draft a detailed update in bullet points for executive stakeholders." },
    });

    await waitFor(() => {
      expect(mocks.inferBuilderFields).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(promptInput, {
      target: { value: "" },
    });

    await act(async () => {
      resolveInference?.({
        inferredUpdates: { tone: "Technical" },
        inferredFields: ["tone"],
        suggestionChips: [
          {
            id: "stale-chip",
            label: "Stale suggestion",
            description: "Should not render after clear.",
            action: {
              type: "append_prompt",
              text: "Include constraints.",
            },
          },
        ],
      });
      await Promise.resolve();
    });

    expect(screen.queryByText("Stale suggestion")).not.toBeInTheDocument();
  }, 15_000);

  it("falls back to local suggestions and backs off retries after inference failures", async () => {
    vi.useFakeTimers();

    mocks.inferBuilderFields
      .mockRejectedValueOnce(new Error("service unavailable"))
      .mockResolvedValueOnce({
        inferredUpdates: {},
        inferredFields: [],
        suggestionChips: [
          {
            id: "remote-chip",
            label: "Remote suggestion",
            description: "Recovered after retry.",
            action: {
              type: "append_prompt",
              text: "Add acceptance criteria.",
            },
          },
        ],
      });

    await renderIndex();

    const initialPrompt =
      "Draft a detailed update in bullet points for executive stakeholders.";
    const updatedPrompt = `${initialPrompt} Include risks and next steps.`;
    const promptInput = screen.getByLabelText("Redesign Hero Input");

    fireEvent.change(promptInput, {
      target: { value: initialPrompt },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mocks.inferBuilderFields).toHaveBeenCalledTimes(1);

    expect(
      screen.getByText(
        "Using local suggestions while AI suggestions reconnect. We'll retry automatically.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Using local suggestions while AI suggestions reconnect. We'll retry automatically.",
      ),
    ).toHaveLength(1);

    fireEvent.change(promptInput, {
      target: { value: updatedPrompt },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(mocks.inferBuilderFields).toHaveBeenCalledTimes(1);
    expect(promptInput).toHaveValue(updatedPrompt);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mocks.inferBuilderFields).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Remote suggestion")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Using local suggestions while AI suggestions reconnect. We'll retry automatically.",
      ),
    ).not.toBeInTheDocument();
  }, 15_000);
});
