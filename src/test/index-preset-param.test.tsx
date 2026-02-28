import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";
import { resetPreferencesCache } from "@/lib/user-preferences";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackBuilderEvent: vi.fn(),
  usePromptBuilder: vi.fn(),
  loadTemplate: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
}));

vi.mock("@/lib/ai-client", () => ({
  streamEnhance: vi.fn(),
  inferBuilderFields: vi.fn(),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => null,
}));

vi.mock("@/components/BuilderHeroInput", () => ({
  BuilderHeroInput: () => null,
}));

vi.mock("@/components/BuilderAdjustDetails", () => ({
  BuilderAdjustDetails: () => null,
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => null,
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
  OutputPanel: () => null,
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
    loadTemplate: mocks.loadTemplate,
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

function LocationSearch() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

async function renderIndexAt(url: string) {
  const { default: Index } = await import("@/pages/Index");
  render(
    <MemoryRouter initialEntries={[url]}>
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
    </MemoryRouter>,
  );
}

describe("Index preset query param", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetPreferencesCache();
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("loads a valid preset and clears ?preset from the URL", async () => {
    await renderIndexAt("/?preset=blog-post");

    await waitFor(() => {
      expect(mocks.loadTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "blog-post",
          starterPrompt: expect.any(String),
        }),
      );
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Preset loaded",
      }),
    );
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "preset_applied",
      expect.objectContaining({
        presetId: "blog-post",
        presetCategory: "docs",
        hasStarterPrompt: true,
      }),
    );
    const storedPreferences = JSON.parse(localStorage.getItem("promptforge-user-prefs") ?? "{}");
    expect(storedPreferences.recentlyUsedPresetIds).toEqual(["blog-post"]);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("shows an error for unknown preset ids and clears ?preset", async () => {
    await renderIndexAt("/?preset=missing-preset");

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Preset not found",
        }),
      );
    });

    expect(mocks.loadTemplate).not.toHaveBeenCalled();
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith("preset_not_found", {
      presetId: "missing-preset",
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });
});
