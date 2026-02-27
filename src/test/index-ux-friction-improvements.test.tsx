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

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    previewSource,
    hasEnhancedOnce,
  }: {
    previewSource?: string;
    hasEnhancedOnce?: boolean;
  }) => (
    <div>
      <div data-testid="preview-source-prop">{previewSource || "none"}</div>
      <div data-testid="has-enhanced-once-prop">{String(Boolean(hasEnhancedOnce))}</div>
    </div>
  ),
}));

vi.mock("@/components/base/primitives/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/primitives/drawer", () => ({
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

vi.mock("@/components/base/primitives/card", () => ({
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
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "true");
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("uses desktop step wording and computes preview source from builder fields", async () => {
    await renderIndex();

    expect(screen.getByText(/Click\s+/)).toBeInTheDocument();
    expect(screen.getByTestId("preview-source-prop")).toHaveTextContent("builder_fields");
    expect(screen.getByTestId("has-enhanced-once-prop")).toHaveTextContent("false");
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
  });
});
