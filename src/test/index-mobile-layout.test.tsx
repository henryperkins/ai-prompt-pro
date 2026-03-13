import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  useIsMobile: () => true,
}));

vi.mock("@/lib/ai-client", () => ({
  inferBuilderFields: vi.fn(),
  isAIClientError: () => false,
  streamEnhance: vi.fn(),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));






vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    announceStatus = true,
  }: {
    announceStatus?: boolean;
  }) => (
    <div>
      <div data-testid="output-panel-announce-status-prop">
        {String(announceStatus)}
      </div>
      {announceStatus ? <p role="status">Mock output panel status</p> : null}
      <div>Output panel</div>
    </div>
  ),
}));


vi.mock("@/components/base/drawer", () => ({
  Drawer: ({
    children,
    open,
  }: {
    children: ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
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
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildPromptBuilderState(overrides: Record<string, unknown> = {}) {
  return {
    config: defaultConfig,
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built prompt",
    score: { total: 70 },
    enhancedPrompt: "",
    setEnhancedPrompt: vi.fn(),
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
    ...overrides,
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

describe("Index mobile layout spacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("keeps bottom-nav offset only for sub-sm breakpoints", async () => {
    await renderIndex();

    const stickyBar = screen.getByTestId("builder-mobile-sticky-bar");

    expect(stickyBar.className).toContain("bottom-[calc(4.375rem+env(safe-area-inset-bottom)+1px)]");
    expect(stickyBar.className).toContain("sm:bottom-0");

    const spacer = Array.from(document.querySelectorAll("div")).find(
      (node) => node.className.includes("h-32") && node.className.includes("sm:h-28"),
    );
    expect(spacer).toBeTruthy();
  }, 10_000);

  it("adds a mobile settings trigger and opens the settings sheet", async () => {
    await renderIndex();

    expect(
      screen.getByTestId("builder-mobile-settings-trigger"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("builder-mobile-settings-trigger"));

    expect(
      screen.getByText("Enhancement settings"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expert prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Preserve wording" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask me" }));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(
      screen.queryByText("Enhancement settings"),
    ).not.toBeInTheDocument();
  });

  it("announces the shared mobile review state and suppresses drawer status duplication", async () => {
    await renderIndex();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Draft prompt. This preview reflects the current builder draft.",
    );

    fireEvent.click(screen.getByTestId("builder-mobile-preview-trigger"));

    expect(screen.getByTestId("output-panel-announce-status-prop")).toHaveTextContent("false");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("lets signed-in mobile users reach the Codex session drawer from settings", async () => {
    mocks.usePromptBuilder.mockReturnValue(
      buildPromptBuilderState({ isSignedIn: true }),
    );

    await renderIndex();

    fireEvent.click(screen.getByTestId("builder-mobile-settings-trigger"));

    expect(
      screen.getByTestId("builder-mobile-codex-session-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("builder-mobile-codex-session-summary"),
    ).toHaveTextContent("Open the drawer to add supplemental context");

    fireEvent.click(screen.getByRole("button", { name: "Open session" }));

    expect(
      screen.queryByText("Enhancement settings"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Outside context summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Carry-forward prompt")).toBeInTheDocument();
  });
});
