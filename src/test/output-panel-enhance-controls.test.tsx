import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: vi.fn(),
}));

function renderPanel(overrides?: Partial<Parameters<typeof OutputPanel>[0]>) {
  const onEnhancementDepthChange = vi.fn();
  const onRewriteStrictnessChange = vi.fn();

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
      onEnhancementDepthChange={onEnhancementDepthChange}
      onRewriteStrictnessChange={onRewriteStrictnessChange}
      {...overrides}
    />,
  );

  return { onEnhancementDepthChange, onRewriteStrictnessChange };
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

  it("disables controls while enhancing", () => {
    renderPanel({ isEnhancing: true });

    const buttons = screen.getAllByRole("button").filter(
      (btn) =>
        btn.textContent === "Light polish" ||
        btn.textContent === "Expert prompt" ||
        btn.textContent === "Preserve wording" ||
        btn.textContent === "Optimize aggressively",
    );

    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });
});
