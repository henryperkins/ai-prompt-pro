import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig, buildPrompt } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  inferBuilderFields: vi.fn(),
  streamEnhance: vi.fn(),
  saveVersion: vi.fn(),
  savePrompt: vi.fn(),
  saveAndSharePrompt: vi.fn(),
  latestConfig: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/ai-client", () => ({
  inferBuilderFields: (...args: unknown[]) => mocks.inferBuilderFields(...args),
  streamEnhance: (...args: unknown[]) => mocks.streamEnhance(...args),
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
    onApplyToBuilder,
    onApplyEditableListToPrompt,
  }: {
    onApplyToBuilder?: (updates: {
      role?: string;
      context?: string;
      format?: string;
      constraints?: string;
    }) => void;
    onApplyEditableListToPrompt?: (
      field: string,
      items: string[],
    ) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="apply-format"
        onClick={() =>
          onApplyToBuilder?.({
            format: "Present as numbered steps with code blocks",
          })
        }
      >
        Apply format
      </button>
      <button
        type="button"
        data-testid="apply-constraints"
        onClick={() =>
          onApplyToBuilder?.({
            constraints: "Must be under 200 words, no jargon",
          })
        }
      >
        Apply constraints
      </button>
      <button
        type="button"
        data-testid="apply-role"
        onClick={() =>
          onApplyToBuilder?.({
            role: "Senior DevOps Engineer",
          })
        }
      >
        Apply role
      </button>
      <button
        type="button"
        data-testid="apply-all"
        onClick={() =>
          onApplyToBuilder?.({
            role: "ML Engineer",
            format: "Markdown report with tables",
            constraints: "Use only peer-reviewed sources",
          })
        }
      >
        Apply all
      </button>
      <button
        type="button"
        data-testid="apply-open-questions-to-prompt"
        onClick={() =>
          onApplyEditableListToPrompt?.("plan_open_questions", [
            "Which legal reviewer owns final sign-off?",
          ])
        }
      >
        Apply open questions to prompt
      </button>
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

/**
 * The mock usePromptBuilder tracks config mutations and exposes
 * the latest config via mocks.latestConfig so we can verify
 * that array fields are cleared when custom values are applied.
 */
vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => {
    const [config, setConfig] = useState({
      ...defaultConfig,
      originalPrompt: "Write a CI/CD pipeline guide",
      role: "Software Developer",
      format: ["Bullet points", "Markdown"],
      constraints: ["Include citations", "Avoid jargon"],
    });
    const [enhancedPrompt, setEnhancedPrompt] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const updateConfig = useCallback(
      (updates: Partial<typeof defaultConfig>) => {
        setConfig((previous) => {
          const next = { ...previous, ...updates };
          mocks.latestConfig = next;
          return next;
        });
      },
      [],
    );

    // Expose initial config
    mocks.latestConfig = config;

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
      builtPrompt: buildPrompt(config),
      score: { total: 70, tips: ["tip"] },
      enhancedPrompt,
      setEnhancedPrompt,
      isEnhancing,
      setIsEnhancing,
      isSignedIn: false,
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

describe("High-2: Apply to builder replaces format/constraint/role semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.latestConfig = null;
  });

  it("clears format array when applying custom format from inspector", async () => {
    await renderIndex();

    // Verify initial config has format array values
    expect(mocks.latestConfig).toBeTruthy();
    expect((mocks.latestConfig as Record<string, unknown>).format).toEqual([
      "Bullet points",
      "Markdown",
    ]);

    // Apply custom format from inspector
    fireEvent.click(screen.getByTestId("apply-format"));

    await waitFor(() => {
      const cfg = mocks.latestConfig as Record<string, unknown>;
      expect(cfg.format).toEqual([]);
      expect(cfg.customFormat).toBe(
        "Present as numbered steps with code blocks",
      );
    });
  });

  it("clears constraints array when applying custom constraints from inspector", async () => {
    await renderIndex();

    expect((mocks.latestConfig as Record<string, unknown>).constraints).toEqual([
      "Include citations",
      "Avoid jargon",
    ]);

    fireEvent.click(screen.getByTestId("apply-constraints"));

    await waitFor(() => {
      const cfg = mocks.latestConfig as Record<string, unknown>;
      expect(cfg.constraints).toEqual([]);
      expect(cfg.customConstraint).toBe("Must be under 200 words, no jargon");
    });
  });

  it("clears role when applying custom role from inspector", async () => {
    await renderIndex();

    expect((mocks.latestConfig as Record<string, unknown>).role).toBe(
      "Software Developer",
    );

    fireEvent.click(screen.getByTestId("apply-role"));

    await waitFor(() => {
      const cfg = mocks.latestConfig as Record<string, unknown>;
      expect(cfg.role).toBe("");
      expect(cfg.customRole).toBe("Senior DevOps Engineer");
    });
  });

  it("clears all parallel fields when applying full inspector update", async () => {
    await renderIndex();

    fireEvent.click(screen.getByTestId("apply-all"));

    await waitFor(() => {
      const cfg = mocks.latestConfig as Record<string, unknown>;
      // Role replaced
      expect(cfg.role).toBe("");
      expect(cfg.customRole).toBe("ML Engineer");
      // Format replaced
      expect(cfg.format).toEqual([]);
      expect(cfg.customFormat).toBe("Markdown report with tables");
      // Constraints replaced
      expect(cfg.constraints).toEqual([]);
      expect(cfg.customConstraint).toBe("Use only peer-reviewed sources");
    });
  });

  it("does not affect context field (additive only, no parallel array)", async () => {
    await renderIndex();

    const initialContext = (mocks.latestConfig as Record<string, unknown>).context;

    // Format-only apply should not touch context
    fireEvent.click(screen.getByTestId("apply-format"));

    await waitFor(() => {
      expect((mocks.latestConfig as Record<string, unknown>).context).toBe(
        initialContext,
      );
    });
  });

  it("appends edited open questions to the prompt instead of mutating builder fields", async () => {
    await renderIndex();

    fireEvent.click(screen.getByTestId("apply-open-questions-to-prompt"));

    await waitFor(() => {
      const cfg = mocks.latestConfig as Record<string, unknown>;
      expect(cfg.originalPrompt).toBe(
        "Write a CI/CD pipeline guide\n\nClarification questions to answer before finalizing:\n1. Which legal reviewer owns final sign-off?",
      );
      expect(cfg.role).toBe("Software Developer");
      expect(cfg.customRole).toBe("");
    });
  });
});
