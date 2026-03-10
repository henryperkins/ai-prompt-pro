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
  }: {
    value: string;
    onChange: (value: string) => void;
    suggestionChips?: Array<{ id: string; label: string }>;
  }) => (
    <div>
      <label htmlFor="builder-hero-input">Redesign Hero Input</label>
      <textarea
        id="builder-hero-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => <div>Legacy PromptInput</div>,
}));

vi.mock("@/components/BuilderTabs", () => ({
  BuilderTabs: () => <div>Legacy BuilderTabs</div>,
}));

vi.mock("@/components/ContextPanel", () => ({
  ContextPanel: () => <div>Legacy ContextPanel</div>,
}));

vi.mock("@/components/ToneControls", () => ({
  ToneControls: () => <div>Legacy ToneControls</div>,
}));

vi.mock("@/components/QualityScore", () => ({
  QualityScore: () => <div>Legacy QualityScore</div>,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: () => <div>Output panel</div>,
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
});
