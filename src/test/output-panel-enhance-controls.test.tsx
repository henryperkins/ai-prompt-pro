import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";
import { getEnhancementSettingsSummary } from "@/lib/enhancement-settings";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: vi.fn(),
}));

function renderPanel(overrides?: Partial<Parameters<typeof OutputPanel>[0]>) {
  const onEnhancementDepthChange = vi.fn();
  const onRewriteStrictnessChange = vi.fn();
  const onAmbiguityModeChange = vi.fn();

  render(
    <OutputPanel
      builtPrompt="Draft prompt"
      enhancedPrompt=""
      isEnhancing={false}
      onEnhance={() => undefined}
      onSaveVersion={() => undefined}
      onSavePrompt={async () => true}
      onSaveAndSharePrompt={async () => true}
      canSavePrompt
      canSharePrompt
      enhancementDepth="guided"
      rewriteStrictness="balanced"
      ambiguityMode="infer_conservatively"
      onEnhancementDepthChange={onEnhancementDepthChange}
      onRewriteStrictnessChange={onRewriteStrictnessChange}
      onAmbiguityModeChange={onAmbiguityModeChange}
      {...overrides}
    />,
  );

  return {
    onEnhancementDepthChange,
    onRewriteStrictnessChange,
    onAmbiguityModeChange,
  };
}

describe("OutputPanel enhance controls", () => {
  it("renders depth and strictness controls when handlers are provided", () => {
    renderPanel();

    expect(screen.getByText("Depth:")).toBeInTheDocument();
    expect(screen.getByText("Light polish")).toBeInTheDocument();
    expect(screen.getByText("Structured rewrite")).toBeInTheDocument();
    expect(screen.getByText("Expert prompt")).toBeInTheDocument();

    expect(screen.getByText("Strictness:")).toBeInTheDocument();
    expect(screen.getByText("Preserve wording")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Optimize aggressively")).toBeInTheDocument();

    expect(screen.getByText("Ambiguity:")).toBeInTheDocument();
    expect(screen.getByText("Ask me")).toBeInTheDocument();
    expect(screen.getByText("Use placeholders")).toBeInTheDocument();
    expect(screen.getByText("Infer conservatively")).toBeInTheDocument();
  });

  it("does not render controls when handlers are not provided", () => {
    render(
      <OutputPanel
        builtPrompt="Draft prompt"
        enhancedPrompt=""
        isEnhancing={false}
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={async () => true}
        onSaveAndSharePrompt={async () => true}
        canSavePrompt
        canSharePrompt
      />,
    );

    expect(screen.queryByText("Depth:")).not.toBeInTheDocument();
    expect(screen.queryByText("Strictness:")).not.toBeInTheDocument();
  });

  it("calls onEnhancementDepthChange when depth option is clicked", async () => {
    const { onEnhancementDepthChange } = renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByText("Expert prompt"));
    });

    expect(onEnhancementDepthChange).toHaveBeenCalledWith("advanced");
  });

  it("calls onRewriteStrictnessChange when strictness option is clicked", async () => {
    const { onRewriteStrictnessChange } = renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByText("Preserve wording"));
    });

    expect(onRewriteStrictnessChange).toHaveBeenCalledWith("preserve");
  });

  it("calls onAmbiguityModeChange when ambiguity option is clicked", async () => {
    const { onAmbiguityModeChange } = renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByText("Ask me"));
    });

    expect(onAmbiguityModeChange).toHaveBeenCalledWith("ask_me");
  });

  it("disables controls while enhancing", () => {
    renderPanel({ isEnhancing: true });

    const buttons = screen.getAllByRole("button").filter(
      (btn) =>
        btn.textContent === "Light polish" ||
        btn.textContent === "Expert prompt" ||
        btn.textContent === "Preserve wording" ||
        btn.textContent === "Optimize aggressively" ||
        btn.textContent === "Ask me" ||
        btn.textContent === "Use placeholders",
    );

    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("formats shared settings summaries for mobile surfaces", () => {
    expect(
      getEnhancementSettingsSummary({
        enhancementDepth: "guided",
        rewriteStrictness: "balanced",
        ambiguityMode: "infer_conservatively",
      }),
    ).toBe("Structured rewrite · Balanced · Infer conservatively");
  });

  it("shows a settings summary and edit trigger when the control block is hidden", () => {
    const onEditEnhancementSettings = vi.fn();

    render(
      <OutputPanel
        builtPrompt="Draft prompt"
        enhancedPrompt="Enhanced prompt"
        isEnhancing={false}
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={async () => true}
        onSaveAndSharePrompt={async () => true}
        canSavePrompt
        canSharePrompt
        hideEnhanceButton
        enhancementSettingsSummary="Expert prompt · Preserve wording · Ask me"
        onEditEnhancementSettings={onEditEnhancementSettings}
      />,
    );

    expect(screen.getByText("Enhancement settings")).toBeInTheDocument();
    expect(
      screen.getByText("Expert prompt · Preserve wording · Ask me"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit settings" }));

    expect(onEditEnhancementSettings).toHaveBeenCalledTimes(1);
  });

  it("compresses pre-run controls into a summary until settings are expanded", () => {
    renderPanel({
      enhanceControlsMode: "compact",
      webSearchEnabled: true,
      onWebSearchToggle: vi.fn(),
    });

    expect(
      screen.getByTestId("output-panel-enhancement-settings-summary"),
    ).toHaveTextContent(
      "Structured rewrite · Balanced · Infer conservatively",
    );
    expect(
      screen.getByTestId("output-panel-enhancement-settings-summary"),
    ).toHaveTextContent("Web lookup on");
    expect(screen.queryByText("Depth:")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit settings" })).toBeInTheDocument();
  });

  it("reveals the full settings editor when compact controls are expanded", async () => {
    renderPanel({
      enhanceControlsMode: "compact",
      onWebSearchToggle: vi.fn(),
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Edit settings" }),
      );
    });

    expect(screen.getByRole("group", { name: "Depth" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Strictness" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ambiguity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide settings" })).toBeInTheDocument();
  });

  it("keeps reset enhancement preferences inside the enhancement settings surface", () => {
    const onResetPreferences = vi.fn();

    renderPanel({
      enhanceControlsMode: "compact",
      canResetEnhancementPreferences: true,
      onResetEnhancementPreferences: onResetPreferences,
      preferredAcceptedFormat: "Markdown",
    });

    expect(
      screen.getByTestId("enhancement-preferences-reset-row"),
    ).toHaveTextContent("Most accepted structure: Markdown");

    fireEvent.click(
      screen.getByRole("button", { name: "Reset enhancement preferences" }),
    );

    expect(onResetPreferences).toHaveBeenCalledTimes(1);
  });
});
