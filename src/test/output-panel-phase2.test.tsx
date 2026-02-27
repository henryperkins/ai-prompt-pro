import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackBuilderEvent: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
}));

function renderPanel(overrides?: Partial<Parameters<typeof OutputPanel>[0]>) {
  const onSavePrompt = vi.fn();
  const onSaveAndSharePrompt = vi.fn();

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

function openMenu(buttonName: "Save" | "More") {
  const trigger = screen.getByRole("button", { name: buttonName });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("OutputPanel phase 2 save flow", () => {
  it("uses a single save dialog for private save", async () => {
    const { onSavePrompt, onSaveAndSharePrompt } = renderPanel();

    openMenu("Save");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    fireEvent.change(screen.getByLabelText("Prompt title"), {
      target: { value: "Launch checklist" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Prompt" }));

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

    openMenu("Save");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    fireEvent.change(screen.getByLabelText("Prompt title"), {
      target: { value: "Launch checklist" },
    });

    fireEvent.click(screen.getByRole("switch", { name: "Share to community" }));

    fireEvent.change(screen.getByLabelText("Use case"), {
      target: { value: "Run launch prep every sprint" },
    });

    fireEvent.click(
      screen.getByLabelText("I confirm this prompt contains no secrets or private data."),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Share" }));

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

    openMenu("Save");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    expect(screen.getByLabelText("Prompt title")).toHaveClass("text-base");
    expect(screen.getByLabelText("Description")).toHaveClass("text-base");
    expect(screen.getByLabelText("Tags")).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: /category/i })).toHaveClass("text-base");

    fireEvent.click(screen.getByRole("switch", { name: "Share to community" }));

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

    expect(screen.getByText("Source: Builder details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.queryByText("Save and developer tools unlock once preview content is available.")).not.toBeInTheDocument();
  });

  it("keeps utility actions locked when preview is empty", () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      builtPrompt: "",
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "empty",
    });

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    expect(screen.getByText("Save and developer tools unlock once preview content is available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More (locked)" }));
    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith("builder_more_pre_enhance_attempt", {
      previewSource: "empty",
    });
  });

  it("shows utility actions after first enhancement", () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
      hasEnhancedOnce: true,
      previewSource: "enhanced",
    });

    expect(screen.getByText("Source: Enhanced output")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("tracks pre-enhance copy intent", () => {
    mocks.trackBuilderEvent.mockReset();
    renderPanel({
      enhancedPrompt: "",
      hasEnhancedOnce: false,
      previewSource: "builder_fields",
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy preview" }));

    expect(mocks.trackBuilderEvent).toHaveBeenCalledWith("builder_copy_pre_enhance", {
      previewSource: "builder_fields",
    });
  });

  it("shows read-only web lookup status indicator", () => {
    renderPanel({
      onWebSearchToggle: () => undefined,
      webSearchEnabled: true,
    });

    expect(screen.getByText("Web lookup: On")).toBeInTheDocument();
  });

  it("shows compare inline and groups dev tools in submenu", async () => {
    renderPanel({
      enhancedPrompt: "Improved launch plan",
    });

    expect(screen.getByRole("button", { name: "Show changes" })).toBeInTheDocument();

    openMenu("More");

    expect(screen.queryByText("Compare changes")).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Developer tools" })).toBeInTheDocument();
  });

  it("supports legacy separate save/share entries when phase 2 is disabled", async () => {
    const { onSavePrompt, onSaveAndSharePrompt } = renderPanel({
      phase2Enabled: false,
    });

    openMenu("Save");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save & Share Prompt" }));

    expect(screen.queryByRole("switch", { name: "Share to community" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt title"), {
      target: { value: "Legacy share flow" },
    });
    fireEvent.change(screen.getByLabelText("Use case"), {
      target: { value: "Share in old rollout path" },
    });
    fireEvent.click(
      screen.getByLabelText("I confirm this prompt contains no secrets or private data."),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Share" }));

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

    const safe = screen.getByRole("link", { name: "Release notes" });
    expect(safe).toHaveAttribute("href", "https://example.com/changelog");

    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe proto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Data URL" })).not.toBeInTheDocument();
    expect(screen.getByText("[Unsafe](javascript:alert(1))")).toBeInTheDocument();
  });

  it("renders reasoning summary markdown once when provided", () => {
    renderPanel({
      reasoningSummary: "## Plan\n\n- Summarized reasoning content.",
    });

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("Summarized reasoning content.")).toBeInTheDocument();
    expect(screen.queryByText("## Plan")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reasoning summary")).toHaveLength(1);
  });

  it("fades reasoning summary out before removing it", () => {
    vi.useFakeTimers();

    const baseProps: Parameters<typeof OutputPanel>[0] = {
      builtPrompt: "Draft launch plan",
      enhancedPrompt: "",
      isEnhancing: false,
      onEnhance: () => undefined,
      onSaveVersion: () => undefined,
      onSavePrompt: () => undefined,
      onSaveAndSharePrompt: () => undefined,
      canSavePrompt: true,
      canSharePrompt: true,
      reasoningSummary: "Fade this summary slowly.",
    };

    const { rerender } = render(<OutputPanel {...baseProps} />);

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
});
