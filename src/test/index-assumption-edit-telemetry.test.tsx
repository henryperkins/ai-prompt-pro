import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  inferBuilderFields: vi.fn(),
  streamEnhance: vi.fn(),
  saveVersion: vi.fn(),
  savePrompt: vi.fn(),
  saveAndSharePrompt: vi.fn(),
  trackBuilderEvent: vi.fn(),
  isSignedIn: false,
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

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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





vi.mock("@/components/CodexSessionDrawer", () => ({
  CodexSessionDrawer: ({
    session,
  }: {
    session?: { contextSummary?: string };
  }) => <div data-testid="session-context">{session?.contextSummary ?? ""}</div>,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onEditableListSaved,
    onAppendToSessionContext,
  }: {
    onEditableListSaved?: (edit: {
      field: string;
      index: number;
      before: string;
      after: string;
      source: "structured_inspector";
    }) => void;
    onAppendToSessionContext?: (content: string) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="save-edited-assumption"
        onClick={() =>
          onEditableListSaved?.({
            field: "assumptions_made",
            index: 0,
            before: "Budget is approved",
            after: "Budget is approved by finance leadership",
            source: "structured_inspector",
          })
        }
      >
        Save edited assumption
      </button>
      <button
        type="button"
        data-testid="save-noop-assumption"
        onClick={() =>
          onEditableListSaved?.({
            field: "assumptions_made",
            index: 0,
            before: "Budget is approved",
            after: "Budget is approved",
            source: "structured_inspector",
          })
        }
      >
        Save unchanged assumption
      </button>
      {onAppendToSessionContext ? (
        <button
          type="button"
          data-testid="append-edited-assumption-to-session"
          onClick={() =>
            onAppendToSessionContext(
              "Assumptions made\n1. Budget is approved by finance leadership",
            )
          }
        >
          Add edited assumption to session context
        </button>
      ) : null}
    </div>
  ),
}));


vi.mock("@/components/base/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    open ? <div>{children}</div> : null
  ),
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: ReactNode;
  } & Record<string, unknown>) => (
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
    const [config, setConfig] = useState({
      ...defaultConfig,
      originalPrompt: "Draft assumption telemetry prompt",
    });
    const [enhancedPrompt, setEnhancedPrompt] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const updateConfig = useCallback((updates: Partial<typeof defaultConfig>) => {
      setConfig((previous) => ({ ...previous, ...updates }));
    }, []);
    const stableFns = useMemo(
      () => ({
        resetConfig: vi.fn(),
        clearOriginalPrompt: vi.fn(),
        saveVersion: (...args: unknown[]) => mocks.saveVersion(...args),
        savePrompt: (...args: unknown[]) => mocks.savePrompt(...args),
        saveAndSharePrompt: (...args: unknown[]) => mocks.saveAndSharePrompt(...args),
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
      builtPrompt: "Built prompt",
      score: { total: 70, tips: ["tip"] },
      enhancedPrompt,
      setEnhancedPrompt,
      isEnhancing,
      setIsEnhancing,
      isSignedIn: mocks.isSignedIn,
      remixContext: null,
      versions: [],
      templateSummaries: [],
      ...stableFns,
    };
  },
}));

async function renderIndex() {
  const { default: Index } = await import("@/pages/Index");
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index assumption edit telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.isSignedIn = false;
    localStorage.clear();
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("emits builder_enhance_assumption_edited and updates the profile on saved edits", async () => {
    await renderIndex();
    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByTestId("save-edited-assumption"));

    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_assumption_edited",
      expect.objectContaining({
        field: "assumptions_made",
        index: 0,
        beforeChars: "Budget is approved".length,
        afterChars: "Budget is approved by finance leadership".length,
        source: "structured_inspector",
      }),
    );

    const profile = JSON.parse(
      localStorage.getItem("promptforge-enhancement-profile") ?? "{}",
    );
    expect(profile.assumptionEditCounts.assumptions_made).toBe(1);
  });

  it("does not emit telemetry for unchanged saved edits", async () => {
    await renderIndex();
    mocks.trackBuilderEvent.mockClear();

    fireEvent.click(screen.getByTestId("save-noop-assumption"));

    expect(mocks.trackBuilderEvent).not.toHaveBeenCalled();
    expect(localStorage.getItem("promptforge-enhancement-profile")).toBeNull();
  });

  it("appends edited assumptions to the session context", async () => {
    mocks.isSignedIn = true;
    await renderIndex();

    fireEvent.click(screen.getByTestId("append-edited-assumption-to-session"));

    await waitFor(() => {
      expect(screen.getByTestId("session-context")).toHaveTextContent(
        /Assumptions made\s*1\. Budget is approved by finance leadership/,
      );
    });
  });
});
