import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/ai-client", () => ({
  streamEnhance: vi.fn(),
  inferBuilderFields: vi.fn(),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: ({ onResetAll }: { onResetAll?: () => void }) => (
    <div>
      <div>Redesign Hero Input</div>
      <div data-testid="has-reset-all-prop">{String(Boolean(onResetAll))}</div>
      <button type="button" onClick={() => onResetAll?.()}>
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






vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    previewSource,
    hasEnhancedOnce,
    enhanceControlsMode,
  }: {
    previewSource?: string;
    hasEnhancedOnce?: boolean;
    enhanceControlsMode?: string;
  }) => (
    <div>
      <div data-testid="preview-source-prop">{previewSource || "none"}</div>
      <div data-testid="has-enhanced-once-prop">{String(Boolean(hasEnhancedOnce))}</div>
      <div data-testid="enhance-controls-mode-prop">{enhanceControlsMode || "full"}</div>
    </div>
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

vi.mock("@/components/base/primitives/toast", () => ({
  ToastAction: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/base/primitives/switch", () => ({
  Switch: () => null,
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildPromptBuilderState(
  overrides?: {
    originalPrompt?: string;
    role?: string;
    builtPrompt?: string;
  },
) {
  const originalPrompt = overrides?.originalPrompt ?? "";
  const role = overrides?.role ?? "Software Developer";
  const builtPrompt = overrides?.builtPrompt ?? "**Role:** Act as a Software Developer.";

  return {
    config: {
      ...defaultConfig,
      originalPrompt,
      role,
    },
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt,
    score: { total: 70, tips: ["tip"] },
    enhancedPrompt: "",
    setEnhancedPrompt: vi.fn(),
    isEnhancing: false,
    setIsEnhancing: vi.fn(),
    isSignedIn: false,
    versions: [],
    saveVersion: vi.fn(),
    savePrompt: vi.fn(),
    saveAndSharePrompt: vi.fn(),
    loadTemplate: vi.fn(),
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

describe("Index UX friction improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("labels the draft score as builder-derived before enhancement", async () => {
    await renderIndex();

    expect(screen.getByText("Builder readiness")).toBeInTheDocument();
    expect(
      screen.getByText("Readiness signal for the current draft before enhancement."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("has-reset-all-prop")).toHaveTextContent("true");
  }, 10_000);

  it("computes preview source from builder fields once the builder already has detail input", async () => {
    await renderIndex();

    expect(screen.queryByText("Start in 3 steps")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent("builder_fields");
    expect(screen.getByTestId("has-enhanced-once-prop")).toHaveTextContent("false");
    expect(screen.getByTestId("enhance-controls-mode-prop")).toHaveTextContent("compact");
  });

  it("prefers builder_fields preview source when prompt text and builder details both contribute", async () => {
    mocks.usePromptBuilder.mockReturnValue(
      buildPromptBuilderState({
        originalPrompt: "Summarize this launch plan.",
        role: "Software Developer",
        builtPrompt: "**Role:** Act as a Software Developer.\n\n**Task:** Summarize this launch plan.",
      }),
    );

    await renderIndex();

    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent("builder_fields");
    expect(screen.getByTestId("has-enhanced-once-prop")).toHaveTextContent("false");
    expect(screen.getByTestId("enhance-controls-mode-prop")).toHaveTextContent("compact");
  });

  it("retires the onboarding card after the user starts writing", async () => {
    mocks.usePromptBuilder.mockReturnValue(
      buildPromptBuilderState({
        originalPrompt: "Turn these notes into a concise launch summary.",
        role: "",
        builtPrompt: "**Task:** Turn these notes into a concise launch summary.",
      }),
    );

    await renderIndex();

    expect(screen.queryByText("Start in 3 steps")).not.toBeInTheDocument();
  });

  it("hides the global reset affordance before the builder diverges from defaults", async () => {
    mocks.usePromptBuilder.mockReturnValue(
      buildPromptBuilderState({
        originalPrompt: "",
        role: "",
        builtPrompt: "",
      }),
    );

    await renderIndex();

    expect(screen.getByTestId("has-reset-all-prop")).toHaveTextContent("false");
  });
});
