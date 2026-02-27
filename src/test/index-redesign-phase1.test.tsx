import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => <div>Legacy PromptInput</div>,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: () => <div>Redesign Hero Input</div>,
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => <div>Redesign Adjust Details</div>,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: ({ onToggleWebSearch }: { onToggleWebSearch?: (value: boolean) => void }) => (
    <div>
      <div>Redesign Sources Advanced</div>
      <button type="button" onClick={() => onToggleWebSearch?.(true)}>
        Toggle web lookup
      </button>
    </div>
  ),
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
  OutputPanel: ({ webSearchEnabled }: { webSearchEnabled?: boolean }) => (
    <div data-testid="output-web-search-state">{String(Boolean(webSearchEnabled))}</div>
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

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildPromptBuilderState() {
  return {
    config: defaultConfig,
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built prompt",
    score: { total: 70, tips: ["tip"] },
    enhancedPrompt: "",
    setEnhancedPrompt: vi.fn(),
    isEnhancing: false,
    setIsEnhancing: vi.fn(),
    isSignedIn: false,
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

describe("Index redesign phase 1 gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("renders redesign zones and omits legacy tabs path", async () => {
    await renderIndex();

    expect(screen.getByText("Redesign Hero Input")).toBeInTheDocument();
    expect(screen.queryByText("Redesign Adjust Details")).not.toBeInTheDocument();
    expect(screen.queryByText("Redesign Sources Advanced")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced controls" }));
    expect(screen.getByText("Redesign Adjust Details")).toBeInTheDocument();
    expect(screen.getByText("Redesign Sources Advanced")).toBeInTheDocument();

    expect(screen.queryByText("Legacy PromptInput")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy BuilderTabs")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy ContextPanel")).not.toBeInTheDocument();
  });

  it("shows right-rail helper modules and history link on desktop", async () => {
    await renderIndex();

    expect(screen.getByText("Next best action")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Version History" })).toHaveAttribute("href", "/history");
  });

  it("passes web lookup toggle through advanced sources zone", async () => {
    await renderIndex();

    expect(screen.getByTestId("output-web-search-state")).toHaveTextContent("false");

    const revealAdvancedButton = screen.queryByRole("button", { name: "Show advanced controls" });
    if (revealAdvancedButton) {
      fireEvent.click(revealAdvancedButton);
    }
    fireEvent.click(screen.getByRole("button", { name: "Toggle web lookup" }));

    await waitFor(() => {
      expect(screen.getByTestId("output-web-search-state")).toHaveTextContent("true");
    });
  });
});
