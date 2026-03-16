import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";
import { renderWithAuthContext } from "@/test/render-with-auth-context";

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
  isAIClientError: () => false,
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: ({
    value,
    onChange,
    canResetInferred = false,
  }: {
    value: string;
    onChange: (value: string) => void;
    canResetInferred?: boolean;
  }) => (
    <div>
      <label htmlFor="builder-hero-input">Prompt</label>
      <textarea
        id="builder-hero-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div data-testid="builder-reset-inferred-flag">
        {String(canResetInferred)}
      </div>
    </div>
  ),
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => null,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => null,
}));






vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({ onEnhance }: { onEnhance: () => void }) => (
    <button type="button" onClick={onEnhance}>
      Enhance
    </button>
  ),
}));


vi.mock("@/components/base/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
    const [enhancedPrompt, setEnhancedPrompt] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const updateConfig = useCallback((updates: Partial<typeof defaultConfig>) => {
      setConfig((previous) => ({ ...previous, ...updates }));
    }, []);
    const clearOriginalPrompt = useCallback(() => {
      updateConfig({ originalPrompt: "" });
    }, [updateConfig]);
    const stableFns = useMemo(
      () => ({
        resetConfig: vi.fn(),
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

    return {
      config,
      updateConfig,
      clearOriginalPrompt,
      builtPrompt: config.originalPrompt.trim()
        ? `Built prompt: ${config.originalPrompt}`
        : "",
      score: { total: 70, tips: ["tip"] },
      enhancedPrompt,
      setEnhancedPrompt,
      isEnhancing,
      setIsEnhancing,
      isSignedIn: false,
      remixContext: null,
      ...stableFns,
    };
  },
}));

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  renderWithAuthContext(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index enhance transactionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not commit AI-owned builder fields when enhancement fails", async () => {
    mocks.inferBuilderFields.mockResolvedValue({
      inferredUpdates: { tone: "Technical" },
      inferredFields: ["tone"],
      suggestionChips: [],
    });
    mocks.streamEnhance.mockImplementation(
      ({ onError }: { onError: (error: { code: string; message: string }) => void }) => {
        onError({
          code: "service_unavailable",
          message: "Local enhancement service is unavailable.",
        });
      },
    );

    await renderIndex();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Draft update" },
    });

    expect(screen.getByTestId("builder-reset-inferred-flag")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.streamEnhance).toHaveBeenCalledTimes(1);
    });

    expect(mocks.inferBuilderFields).not.toHaveBeenCalled();
    expect(screen.getByTestId("builder-reset-inferred-flag")).toHaveTextContent("false");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Enhancement failed",
        description: "Local enhancement service is unavailable.",
        variant: "destructive",
      }),
    );
  });
});
