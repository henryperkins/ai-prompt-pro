import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackBuilderEvent: vi.fn(),
  getTelemetryLog: vi.fn(() => []),
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (...args: unknown[]) =>
    mocks.copyTextToClipboard(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
  getTelemetryLog: () => mocks.getTelemetryLog(),
}));

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
}

function renderPanel(overrides?: Partial<Parameters<typeof OutputPanel>[0]>) {
  const onSavePrompt = vi.fn().mockResolvedValue(true);
  const onSaveAndSharePrompt = vi.fn().mockResolvedValue(true);

  render(
    <OutputPanel
      builtPrompt="Draft launch plan"
      enhancedPrompt=""
      isEnhancing={false}
      onEnhance={() => undefined}
      onSaveVersion={() => undefined}
      onSavePrompt={onSavePrompt}
      onSaveAndSharePrompt={onSaveAndSharePrompt}
      canSavePrompt
      canSharePrompt
      {...overrides}
    />,
  );

  return { onSavePrompt, onSaveAndSharePrompt };
}

async function clickElement(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function changeInput(element: Element, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

async function openMenu(buttonName: "Save" | "More") {
  const trigger = screen.getByRole("button", { name: buttonName });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
}

async function openDetailsAccordion(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`${testId}-trigger`));
  });
}

afterEach(() => {
  setWindowWidth(1024);
});

describe("OutputPanel phase 2 save flow", () => {
  it("uses a single save dialog for private save", async () => {
    const { onSavePrompt, onSaveAndSharePrompt } = renderPanel();

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    await changeInput(screen.getByLabelText("Prompt title"), "Launch checklist");

    await clickElement(screen.getByRole("button", { name: "Save Prompt" }));

    expect(onSavePrompt).toHaveBeenCalledTimes(1);
    expect(onSavePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Launch checklist",
        category: "general",
      }),
    );
    expect(onSaveAndSharePrompt).not.toHaveBeenCalled();
  });

  it("routes to save-and-share when share toggle is enabled", async () => {
    const { onSavePrompt, onSaveAndSharePrompt } = renderPanel();

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    await changeInput(screen.getByLabelText("Prompt title"), "Launch checklist");

    await clickElement(screen.getByRole("switch", { name: "Share to community" }));

    await changeInput(screen.getByLabelText("Use case"), "Run launch prep every sprint");

    await clickElement(
      screen.getByLabelText("I confirm this prompt contains no secrets or private data."),
    );

    await clickElement(screen.getByRole("button", { name: "Save & Share" }));

    expect(onSaveAndSharePrompt).toHaveBeenCalledTimes(1);
    expect(onSaveAndSharePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Launch checklist",
        useCase: "Run launch prep every sprint",
      }),
    );
    expect(onSavePrompt).not.toHaveBeenCalled();
  });

  it("uses base font size for save-and-share controls to prevent mobile focus zoom", async () => {
    renderPanel();

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    expect(screen.getByLabelText("Prompt title")).toHaveClass("text-base");
    expect(screen.getByLabelText("Description")).toHaveClass("text-base");
    expect(screen.getByLabelText("Tags")).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: /category/i })).toHaveClass("text-base");

    await clickElement(screen.getByRole("switch", { name: "Share to community" }));

    expect(screen.getByLabelText("Use case")).toHaveClass("text-base");
    expect(screen.getByLabelText("Target model")).toHaveClass("text-base");
  });

  it("shows preview source and keeps utility actions available before first enhancement", () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "builder_fields",
    });

    expect(screen.getByText("Draft prompt")).toBeInTheDocument();
    expect(screen.queryByText("Source: Draft prompt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.queryByText("Save and developer tools unlock once preview content is available.")).not.toBeInTheDocument();
  });

  it("places compact enhancement controls before review actions in the pre-run desktop state", () => {
    renderPanel({
      enhanceControlsMode: "compact",
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "builder_fields",
      onWebSearchToggle: () => undefined,
    });

    const preview = screen.getByTestId("output-panel-preview-card");
    const controls = screen.getByTestId("output-panel-enhance-controls-compact");
    const actions = screen.getByTestId("output-panel-review-actions");

    expect(
      Boolean(preview.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      Boolean(controls.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(screen.queryByText("Depth:")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("output-panel-enhancement-settings-summary"),
    ).toHaveTextContent("Structured rewrite · Balanced · Infer conservatively");
  });

  it("renders the banner, preview, and review actions before supporting details", () => {
    renderPanel({
      enhanceWorkflow: [
        {
          stepId: "draft",
          order: 10,
          label: "Analyze request",
          status: "completed",
          detail: "Draft analysis complete.",
        },
      ],
      reasoningSummary: "## Plan\n\n- Summarized reasoning content.",
    });

    const banner = screen.getByTestId("output-panel-state-banner");
    const preview = screen.getByTestId("output-panel-preview-card");
    const actions = screen.getByTestId("output-panel-review-actions");
    const details = screen.getByTestId("output-panel-details-run-progress");

    expect(
      Boolean(banner.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      Boolean(preview.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      Boolean(actions.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(screen.queryByRole("heading", { name: "Plan" })).not.toBeInTheDocument();
  });

  it("keeps utility actions locked when preview is empty", () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      builtPrompt: "",
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "empty",
    });

    const saveBtn = screen.getByRole("button", { name: "Save" });
    const moreBtn = screen.getByRole("button", { name: "More" });
    expect(saveBtn).toBeDisabled();
    expect(moreBtn).toBeDisabled();
    expect(screen.getByText("Save and developer tools unlock once preview content is available.")).toBeInTheDocument();
  });

  it("shows utility actions after first enhancement", () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      enhancePhase: "done",
      previewSource: "enhanced",
    });

    expect(screen.getByText("Enhanced prompt ready")).toBeInTheDocument();
    expect(screen.getByText("Source: Enhanced prompt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy current output" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("shows a stale-enhancement notice while keeping preview actions draft-scoped", () => {
    renderPanel({
      builtPrompt: "Updated launch plan draft",
      enhancedPrompt: "",
      enhancePhase: "done",
      hasEnhancedOnce: false,
      previewSource: "builder_fields",
      staleEnhancementNotice:
        "Builder changed since the last enhancement. Preview now shows the current draft prompt. Re-run Enhance prompt to refresh the AI result.",
    });

    expect(screen.getByText("Builder changed after enhancement")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Builder changed since the last enhancement. Preview now shows the current draft prompt. Re-run Enhance prompt to refresh the AI result.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy draft" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Too much changed" }),
    ).not.toBeInTheDocument();
  });

  it("tracks pre-enhance copy intent", async () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "builder_fields",
    });

    await clickElement(screen.getByRole("button", { name: "Copy draft" }));

    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith("builder_copy_pre_enhance", {
      previewSource: "builder_fields",
    });
  });

  it("shows interactive web lookup toggle when handler is provided", () => {
    renderPanel({
      onWebSearchToggle: () => undefined,
      webSearchEnabled: true,
    });

    const toggle = screen.getByRole("switch", { name: "Enable web search during enhancement" });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(screen.getByText("Web lookup")).toBeInTheDocument();
  });

  it("shows read-only web lookup status when no handler is provided", () => {
    renderPanel({
      webSearchEnabled: true,
    });

    expect(screen.getByText("Web lookup: On")).toBeInTheDocument();
  });

  it("shows compare inline and groups dev tools in submenu", async () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
      enhancePhase: "done",
    });

    expect(screen.getByRole("button", { name: "Show changes" })).toBeInTheDocument();

    await openMenu("More");

    expect(screen.queryByText("Compare changes")).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Developer tools" })).toBeInTheDocument();
  });

  it("closes an open compare dialog when the review state becomes transient or stale", async () => {
    const baseProps: Parameters<typeof OutputPanel>[0] = {
      builtPrompt: "Draft launch plan",
      enhancedPrompt: "Improved launch plan",
      isEnhancing: false,
      onEnhance: () => undefined,
      onSaveVersion: () => undefined,
      onSavePrompt: async () => true,
      onSaveAndSharePrompt: async () => true,
      canSavePrompt: true,
      canSharePrompt: true,
      hasEnhancedOnce: true,
      enhancePhase: "done",
      previewSource: "enhanced",
    };

    const { rerender } = render(<OutputPanel {...baseProps} />);

    await clickElement(screen.getByRole("button", { name: "Show changes" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Before vs After")).toBeInTheDocument();

    rerender(
      <OutputPanel
        {...baseProps}
        isEnhancing
        enhancePhase="streaming"
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show changes" })).not.toBeInTheDocument();

    rerender(<OutputPanel {...baseProps} />);

    await clickElement(screen.getByRole("button", { name: "Show changes" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <OutputPanel
        {...baseProps}
        builtPrompt="Updated launch plan draft"
        enhancedPrompt=""
        hasEnhancedOnce={false}
        previewSource="builder_fields"
        staleEnhancementNotice="Builder changed since the last enhancement. Preview now shows the current draft prompt. Re-run Enhance prompt to refresh the AI result."
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show changes" })).not.toBeInTheDocument();
  });

  it("phase-gates compare and utility actions while enhancement is still in flight", () => {
    renderPanel({
      builtPrompt: "Draft launch plan",
      enhancedPrompt: "Streaming launch plan",
      hasEnhancedOnce: true,
      isEnhancing: true,
      enhancePhase: "streaming",
      previewSource: "enhanced",
    });

    expect(screen.getByText("Enhancing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy current output" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Too much changed" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });

  it("uses wrap-safe header layout classes for crowded desktop enhancement actions", () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      enhancePhase: "done",
    });

    const reviewActions = screen.getByTestId("output-panel-review-actions");
    const headerActionGroup = screen.getByRole("button", { name: "Copy current output" }).parentElement;

    expect(reviewActions.firstElementChild).toHaveClass(
      "flex",
      "min-w-0",
      "flex-wrap",
      "items-center",
      "justify-between",
    );
    expect(headerActionGroup).toHaveClass("min-w-0", "flex-wrap");
    expect(screen.getByRole("button", { name: "Show changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Too much changed" })).toBeInTheDocument();
  });

  it("shows telemetry exports in mobile developer tools and keeps them discoverable when empty", async () => {
    setWindowWidth(390);
    mocks.getTelemetryLog.mockReturnValue([]);

    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      enhancePhase: "done",
    });

    await openMenu("More");

    const copyLog = await screen.findByRole("menuitem", {
      name: "Copy telemetry log (JSON)",
    });
    const downloadLog = screen.getByRole("menuitem", {
      name: "Download telemetry log",
    });
    const copySummary = screen.getByRole("menuitem", {
      name: "Copy latest enhance session summary",
    });

    expect(copyLog).toBeInTheDocument();
    expect(downloadLog).toBeInTheDocument();
    expect(copySummary).toBeInTheDocument();
    expect(copyLog).toHaveAttribute("data-disabled");
    expect(downloadLog).toHaveAttribute("data-disabled");
    expect(copySummary).toHaveAttribute("data-disabled");
  });

  it("copies telemetry exports when enhancement telemetry exists", async () => {
    setWindowWidth(390);
    mocks.trackBuilderEvent.mockReset();
    mocks.copyTextToClipboard.mockClear();

    const telemetryLog = [
      {
        event: "builder_loaded",
        payload: { page: "home" },
        timestamp: 1000,
      },
      {
        event: "builder_enhance_clicked",
        payload: { promptChars: 128 },
        timestamp: 2000,
      },
      {
        event: "builder_enhance_completed",
        payload: { success: true, durationMs: 1400 },
        timestamp: 3200,
      },
    ];
    mocks.getTelemetryLog.mockReturnValue(telemetryLog);

    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      enhancePhase: "done",
    });

    await openMenu("More");

    const copyLog = await screen.findByRole("menuitem", {
      name: "Copy telemetry log (JSON)",
    });
    expect(copyLog).not.toHaveAttribute("data-disabled");
    await clickElement(copyLog);

    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith(
      JSON.stringify(telemetryLog, null, 2),
    );
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_dev_export_used",
      { action: "copy_telemetry_log" },
    );

    mocks.copyTextToClipboard.mockClear();

    await openMenu("More");
    await clickElement(
      await screen.findByRole("menuitem", {
        name: "Copy latest enhance session summary",
      }),
    );

    const copiedSummary = JSON.parse(
      String(mocks.copyTextToClipboard.mock.calls[0]?.[0] ?? "{}"),
    );
    expect(copiedSummary).toMatchObject({
      startedAt: 2000,
      latestEventAt: 3200,
      eventCount: 2,
      events: [
        "builder_enhance_clicked",
        "builder_enhance_completed",
      ],
      clicked: { promptChars: 128 },
      completed: { success: true, durationMs: 1400 },
    });
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_dev_export_used",
      { action: "copy_enhance_summary" },
    );
  });

  it("emits too-much-changed feedback from the compare controls", async () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      builtPrompt: "Original launch plan",
      enhancedPrompt: "Completely rewritten launch strategy with a different structure",
      hasEnhancedOnce: true,
      enhancePhase: "done",
    });

    await clickElement(
      screen.getByRole("button", { name: "Too much changed" }),
    );

    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_too_much_changed",
      expect.objectContaining({
        variant: "original",
        promptChars:
          "Completely rewritten launch strategy with a different structure"
            .length,
        editDistanceBaseline: "builder_preview",
      }),
    );
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith(
      "builder_enhance_too_much_changed",
      expect.objectContaining({
        editDistanceRatio: expect.any(Number),
      }),
    );
  });

  it("supports legacy separate save/share entries when phase 2 is disabled", async () => {
    const { onSavePrompt, onSaveAndSharePrompt } = renderPanel({
      phase2Enabled: false,
    });

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save & Share Prompt" }));

    expect(screen.queryByRole("switch", { name: "Share to community" })).not.toBeInTheDocument();

    await changeInput(screen.getByLabelText("Prompt title"), "Legacy share flow");
    await changeInput(screen.getByLabelText("Use case"), "Share in old rollout path");
    await clickElement(
      screen.getByLabelText("I confirm this prompt contains no secrets or private data."),
    );

    await clickElement(screen.getByRole("button", { name: "Save & Share" }));

    expect(onSaveAndSharePrompt).toHaveBeenCalledTimes(1);
    expect(onSavePrompt).not.toHaveBeenCalled();
  });

  it("only renders clickable web source links for safe http(s) URLs", () => {
    renderPanel({
      webSearchSources: [
        "[Release notes](example.com/changelog)",
        "[Unsafe](javascript:alert(1))",
        "[Unsafe proto](javascript://evil.com/path)",
        "[Data URL](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
      ],
    });

    fireEvent.click(screen.getByTestId("output-panel-details-sources-trigger"));

    const safe = screen.getByRole("link", { name: "Release notes" });
    expect(safe).toHaveAttribute("href", "https://example.com/changelog");

    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe proto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Data URL" })).not.toBeInTheDocument();
    expect(screen.getByText("[Unsafe](javascript:alert(1))")).toBeInTheDocument();
  });

  it("renders reasoning summary markdown once when provided", async () => {
    renderPanel({
      reasoningSummary: "## Plan\n\n- Summarized reasoning content.",
    });

    await openDetailsAccordion("output-panel-details-run-progress");

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("Summarized reasoning content.")).toBeInTheDocument();
    expect(screen.queryByText("## Plan")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reasoning summary")).toHaveLength(1);
  });

  it("keeps the streaming shell clipped while prompt content scrolls inside", () => {
    renderPanel({
      isEnhancing: true,
      enhancePhase: "streaming",
      enhancedPrompt: "Improved launch plan",
      previewSource: "enhanced",
    });

    const promptText = screen.getByText("Improved launch plan");
    const scrollContainer = promptText.parentElement;
    const previewCard = promptText.closest(".enhance-output-frame");

    expect(previewCard).toHaveClass(
      "enhance-output-frame",
      "enhance-output-streaming",
      "overflow-hidden",
    );
    expect(previewCard).not.toHaveClass("overflow-auto");
    expect(scrollContainer).toHaveClass("overflow-auto", "p-4");
  });

  it("fades reasoning summary out before removing it", async () => {
    vi.useFakeTimers();

    const baseProps: Parameters<typeof OutputPanel>[0] = {
      builtPrompt: "Draft launch plan",
      enhancedPrompt: "",
      isEnhancing: false,
      onEnhance: () => undefined,
      onSaveVersion: () => undefined,
      onSavePrompt: async () => true,
      onSaveAndSharePrompt: async () => true,
      canSavePrompt: true,
      canSharePrompt: true,
      reasoningSummary: "Fade this summary slowly.",
    };

    const { rerender } = render(<OutputPanel {...baseProps} />);

    await openDetailsAccordion("output-panel-details-run-progress");

    expect(screen.getByText("Fade this summary slowly.")).toBeInTheDocument();

    rerender(
      <OutputPanel
        {...baseProps}
        reasoningSummary=""
      />,
    );

    expect(screen.getByText("Fade this summary slowly.")).toBeInTheDocument();
    const summaryCard = screen.getByText("Reasoning summary").closest(".transition-opacity");
    expect(summaryCard).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText("Fade this summary slowly.")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("retains settled enhanced output semantics after phase returns to idle", () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      enhancePhase: "idle",
      previewSource: "enhanced",
      isEnhancing: false,
    });

    expect(screen.getByText("Enhanced prompt ready")).toBeInTheDocument();
    expect(screen.getByText("Source: Enhanced prompt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy current output" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Too much changed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "More" })).toBeEnabled();
  });

  it("shows archived detail sections in stale state when archived props are provided", () => {
    renderPanel({
      builtPrompt: "Updated draft",
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      enhancePhase: "idle",
      previewSource: "builder_fields",
      staleEnhancementNotice:
        "Builder changed since the last enhancement.",
      archivedEnhanceMetadata: {
        enhancedPrompt: "Old enhanced output",
        detectedContext: {
          intent: ["code generation"],
          domain: ["software"],
          complexity: 3,
        },
        enhancementsMade: ["Added structure"],
        qualityScore: { overall: 7.5 },
      },
      archivedReasoningSummary: "Archived reasoning.",
      archivedEnhanceWorkflow: [
        {
          stepId: "draft",
          order: 10,
          label: "Analyze request",
          status: "completed",
          detail: "Done.",
        },
      ],
      archivedWebSearchSources: ["[Docs](https://example.com/docs)"],
    } as Partial<Parameters<typeof OutputPanel>[0]>);

    expect(screen.getByText("Builder changed after enhancement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show changes" })).not.toBeInTheDocument();

    // Archived detail disclosures should be present
    expect(screen.getByTestId("output-panel-details-run-progress")).toBeInTheDocument();
    expect(screen.getByTestId("output-panel-details-enhancer-findings")).toBeInTheDocument();
    expect(screen.getByTestId("output-panel-details-sources")).toBeInTheDocument();

    // Verify stale-specific labels
    expect(screen.getByText("Last enhancement details")).toBeInTheDocument();
    expect(screen.getByText("Archived sources")).toBeInTheDocument();

    // Open the run-progress accordion and verify archived workflow step content
    fireEvent.click(screen.getByTestId("output-panel-details-run-progress-trigger"));
    expect(screen.getByText("Analyze request")).toBeInTheDocument();
    expect(screen.getByText("Archived reasoning summary")).toBeInTheDocument();
  });
});
