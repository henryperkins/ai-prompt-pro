import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";
import { renderWithAuthContext } from "@/test/render-with-auth-context";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  useAgentServiceCapabilities: vi.fn(),
  usePromptBuilder: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useAgentServiceCapabilities", () => ({
  useAgentServiceCapabilities: () => mocks.useAgentServiceCapabilities(),
}));

vi.mock("@/lib/ai-client", () => ({
  inferBuilderFields: vi.fn(),
  isAIClientError: () => false,
  streamEnhance: vi.fn(),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));


vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: () => <div>Redesign Hero Input</div>,
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => <div>Redesign Prompt Details</div>,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => <div>Redesign Context And Sources</div>,
}));





vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({ webSearchEnabled }: { webSearchEnabled?: boolean }) => (
    <div data-testid="output-web-search-state">{String(Boolean(webSearchEnabled))}</div>
  ),
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
  renderWithAuthContext(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index redesign phase 1 gating", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.useAgentServiceCapabilities.mockReturnValue({
      resolved: true,
      githubContextConfigured: false,
      githubContextAvailable: false,
    });
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("mounts without an auth provider even when GitHub context is available but the picker is closed", async () => {
    const { default: Index } = await import("@/pages/Index");
    mocks.useAgentServiceCapabilities.mockReturnValue({
      resolved: true,
      githubContextConfigured: true,
      githubContextAvailable: true,
    });

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    await expect(screen.findByText("Redesign Hero Input")).resolves.toBeVisible();
  });

  it("renders redesign zones and omits legacy tabs path", async () => {
    await renderIndex();

    expect(screen.getByText("Redesign Hero Input")).toBeInTheDocument();
    expect(screen.getByText("Start in 3 steps")).toBeInTheDocument();
    expect(screen.queryByText("Redesign Prompt Details")).not.toBeInTheDocument();
    expect(screen.queryByText("Redesign Context And Sources")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced controls" }));
    expect(screen.getByText("Redesign Prompt Details")).toBeInTheDocument();
    expect(screen.getByText("Redesign Context And Sources")).toBeInTheDocument();
    expect(screen.queryByText("Start in 3 steps")).not.toBeInTheDocument();

    expect(screen.queryByText("Legacy PromptInput")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy BuilderTabs")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy ContextPanel")).not.toBeInTheDocument();
  });

  it("shows right-rail helper modules and history link on desktop", async () => {
    await renderIndex();

    expect(screen.getByText("Builder readiness")).toBeInTheDocument();
    expect(screen.getByText("Session, tips & history")).toBeInTheDocument();
    expect(screen.queryByText("Next best action")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Preview is ready to copy or save\./),
    ).not.toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Version History" })).toHaveAttribute("href", "/history");
  });

  it("keeps enhancement-only controls out of the left-column authoring zones", async () => {
    await renderIndex();

    expect(screen.getByTestId("output-web-search-state")).toHaveTextContent("false");

    const revealAdvancedButton = screen.queryByRole("button", { name: "Show advanced controls" });
    if (revealAdvancedButton) {
      fireEvent.click(revealAdvancedButton);
    }

    expect(screen.getByText("Redesign Context And Sources")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle web lookup" })).not.toBeInTheDocument();
    expect(screen.getByTestId("output-web-search-state")).toHaveTextContent("false");
  });
});
