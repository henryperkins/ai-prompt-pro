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
  streamEnhance: vi.fn(),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  OutputPanel: () => <div>Output panel</div>,
}));

vi.mock("@/components/base/primitives/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

function buildPromptBuilderState() {
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
  });

  it("adds a mobile settings trigger and updates the visible summary from the settings sheet", async () => {
    await renderIndex();

    expect(
      screen.getByTestId("builder-mobile-settings-trigger"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("builder-mobile-enhancement-summary"),
    ).toHaveTextContent(
      "Structured rewrite · Balanced · Infer conservatively",
    );

    fireEvent.click(screen.getByTestId("builder-mobile-settings-trigger"));

    expect(
      screen.getByText("Enhancement settings"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expert prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Preserve wording" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask me" }));

    expect(
      screen.getByTestId("builder-mobile-enhancement-summary"),
    ).toHaveTextContent("Expert prompt · Preserve wording · Ask me");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(
      screen.queryByText("Enhancement settings"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("builder-mobile-enhancement-summary"),
    ).toHaveTextContent("Expert prompt · Preserve wording · Ask me");
  });
});
