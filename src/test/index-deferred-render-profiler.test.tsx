import { Profiler, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
  adjustRenders: 0,
  sourcesRenders: 0,
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
  BuilderAdjustDetails: () => {
    let accumulator = 0;
    for (let i = 0; i < 900_000; i += 1) {
      accumulator += i % 7;
    }
    if (accumulator < 0) {
      return <div>Impossible path</div>;
    }
    mocks.adjustRenders += 1;
    return <div>Redesign Adjust Details</div>;
  },
}));

vi.mock("@/components/BuilderSourcesAdvanced", () => ({
  BuilderSourcesAdvanced: () => {
    let accumulator = 0;
    for (let i = 0; i < 900_000; i += 1) {
      accumulator += i % 11;
    }
    if (accumulator < 0) {
      return <div>Impossible path</div>;
    }
    mocks.sourcesRenders += 1;
    return <div>Redesign Sources Advanced</div>;
  },
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
  OutputPanel: () => <div>Output panel</div>,
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

function buildPromptBuilderState(enhancedPrompt = "") {
  return {
    config: defaultConfig,
    updateConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built prompt",
    score: { total: 70, tips: ["tip"] },
    enhancedPrompt,
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

async function measureBuilderMount(enhancedPrompt = "") {
  mocks.adjustRenders = 0;
  mocks.sourcesRenders = 0;
  mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState(enhancedPrompt));

  const profilerSamples: Array<{ phase: string; duration: number }> = [];
  const { default: Index } = await import("@/pages/Index");
  const rendered = render(
    <Profiler
      id="Index"
      onRender={(_id, phase, actualDuration) => {
        profilerSamples.push({ phase, duration: actualDuration });
      }}
    >
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    </Profiler>,
  );

  await screen.findByText("Redesign Hero Input");
  await waitFor(() => {
    expect(profilerSamples.some((sample) => sample.phase === "mount")).toBe(true);
  });

  const mountDuration = profilerSamples.find((sample) => sample.phase === "mount")?.duration ?? 0;
  return {
    mountDuration,
    adjustRenders: mocks.adjustRenders,
    sourcesRenders: mocks.sourcesRenders,
    unmount: rendered.unmount,
  };
}

describe("Index deferred rendering profiler coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
  });

  it("defers heavy advanced sections from initial mount and measures the difference", async () => {
    const deferredMount = await measureBuilderMount("");
    deferredMount.unmount();

    const eagerMount = await measureBuilderMount("Already enhanced");
    eagerMount.unmount();

    expect(deferredMount.adjustRenders).toBe(0);
    expect(deferredMount.sourcesRenders).toBe(0);
    expect(eagerMount.adjustRenders).toBeGreaterThan(0);
    expect(eagerMount.sourcesRenders).toBeGreaterThan(0);
    expect(deferredMount.mountDuration).toBeGreaterThan(0);
    expect(eagerMount.mountDuration).toBeGreaterThan(0);
    expect(eagerMount.adjustRenders + eagerMount.sourcesRenders).toBeGreaterThan(
      deferredMount.adjustRenders + deferredMount.sourcesRenders,
    );
  });
});
