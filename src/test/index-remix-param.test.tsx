import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
  savePrompt: vi.fn(),
  saveAndSharePrompt: vi.fn(),
  clearRemix: vi.fn(),
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

vi.mock("@/components/Header", () => ({
  Header: () => null,
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
    onSavePrompt,
    onSaveAndSharePrompt,
  }: {
    onSavePrompt: (input: { name: string }) => void;
    onSaveAndSharePrompt: (input: { name: string; useCase: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSavePrompt({ name: "Saved Prompt" })}>
        save prompt
      </button>
      <button
        type="button"
        onClick={() =>
          onSaveAndSharePrompt({
            name: "Shared Prompt",
            useCase: "Demonstrate clear remix behavior",
          })
        }
      >
        save and share prompt
      </button>
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

function buildSaveResult(name: string) {
  return {
    outcome: "created",
    warnings: [],
    record: {
      metadata: {
        name,
        revision: 1,
      },
    },
  };
}

function buildPromptBuilderState() {
  return {
    config: defaultConfig,
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built prompt",
    score: { total: 75 },
    enhancedPrompt: "",
    setEnhancedPrompt: vi.fn(),
    isEnhancing: false,
    setIsEnhancing: vi.fn(),
    isSignedIn: true,
    versions: [],
    saveVersion: vi.fn(),
    loadTemplate: vi.fn(),
    savePrompt: mocks.savePrompt,
    saveAndSharePrompt: mocks.saveAndSharePrompt,
    shareSavedPrompt: vi.fn(),
    unshareSavedPrompt: vi.fn(),
    saveAsTemplate: vi.fn(),
    loadSavedTemplate: vi.fn(),
    deleteSavedTemplate: vi.fn(),
    templateSummaries: [],
    remixContext: {
      postId: "post_1",
      parentTitle: "Parent Prompt",
      parentAuthor: "Parent Author",
    },
    startRemix: vi.fn(),
    clearRemix: mocks.clearRemix,
    updateContextSources: vi.fn(),
    updateDatabaseConnections: vi.fn(),
    updateRagParameters: vi.fn(),
    updateContextStructured: vi.fn(),
    updateContextInterview: vi.fn(),
    updateProjectNotes: vi.fn(),
    toggleDelimiters: vi.fn(),
  };
}

function LocationSearch() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

async function renderIndexAtRemixUrl() {
  const { default: Index } = await import("@/pages/Index");
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/?remix=post_1"]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Index />
                <LocationSearch />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Index remix query param clearing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.savePrompt.mockResolvedValue(buildSaveResult("Saved Prompt"));
    mocks.saveAndSharePrompt.mockResolvedValue(buildSaveResult("Shared Prompt"));
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("removes ?remix after save", async () => {
    await renderIndexAtRemixUrl();
    expect(screen.getByTestId("location-search").textContent).toBe("?remix=post_1");

    fireEvent.click(screen.getByRole("button", { name: "save prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(mocks.clearRemix).toHaveBeenCalledTimes(1);
  });

  it("removes ?remix after save and share", async () => {
    await renderIndexAtRemixUrl();
    expect(screen.getByTestId("location-search").textContent).toBe("?remix=post_1");

    fireEvent.click(screen.getByRole("button", { name: "save and share prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(mocks.clearRemix).toHaveBeenCalledTimes(1);
  });
});
