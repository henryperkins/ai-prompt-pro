import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";
import type { EnhanceMetadata } from "@/lib/enhance-metadata";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: vi.fn(),
}));

const BASE_METADATA: EnhanceMetadata = {
  enhancedPrompt: "Enhanced version of the prompt",
  enhancementsMade: [
    "Added structured role definition",
    "Expanded context with domain specifics",
    "Added output format constraints",
  ],
  suggestions: [
    "Consider adding example outputs",
    "Specify target audience more precisely",
  ],
  missingParts: ["examples"],
  qualityScore: {
    clarity: 8,
    specificity: 7,
    completeness: 6,
    actionability: 8,
    overall: 7.3,
  },
  detectedContext: {
    intent: ["analytical"],
    domain: ["business"],
    complexity: 3,
    mode: "guided",
    input_language: "en",
  },
  alternativeVersions: {
    shorter: "Short version of the prompt",
    more_detailed: "Very detailed and comprehensive version of the prompt",
  },
};

function renderPanel(
  overrides?: Partial<Parameters<typeof OutputPanel>[0]>,
) {
  return render(
    <OutputPanel
      builtPrompt="Draft prompt"
      enhancedPrompt="Enhanced version of the prompt"
      isEnhancing={false}
      onEnhance={() => undefined}
      onSaveVersion={() => undefined}
      onSavePrompt={async () => true}
      onSaveAndSharePrompt={async () => true}
      canSavePrompt
      canSharePrompt
      enhancePhase="done"
      onAppendClarificationBlockToPrompt={() => undefined}
      onAppendToSessionContext={() => undefined}
      {...overrides}
    />,
  );
}

describe("OutputPanel enhancement metadata", () => {
  it("renders the AI quality score as a distinct post-enhance metric", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("Enhanced quality (AI)")).toBeInTheDocument();
    expect(screen.getByText("7.3/10")).toBeInTheDocument();
    expect(
      screen.getByText(
        "AI-reported estimate for the current enhanced output, separate from the builder score.",
      ),
    ).toBeInTheDocument();
  });

  it("renders enhancements_made when metadata is present", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("What changed:")).toBeInTheDocument();
    expect(
      screen.getByText("Added structured role definition"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Expanded context with domain specifics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Added output format constraints"),
    ).toBeInTheDocument();
  });

  it("renders suggestions when metadata is present", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("Try next:")).toBeInTheDocument();
    expect(
      screen.getByText("Consider adding example outputs"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Specify target audience more precisely"),
    ).toBeInTheDocument();
  });

  it("renders detected context chips", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("Detected:")).toBeInTheDocument();
    expect(screen.getByText("analytical")).toBeInTheDocument();
    expect(screen.getByText("business")).toBeInTheDocument();
    expect(screen.getByText("complexity 3/5")).toBeInTheDocument();
    expect(screen.getByText("mode: Structured rewrite")).toBeInTheDocument();
  });

  it("renders primaryIntent as the primary chip when present (Medium-2)", () => {
    const metadataWithPrimary: EnhanceMetadata = {
      ...BASE_METADATA,
      detectedContext: {
        intent: ["extraction"],
        domain: ["business"],
        complexity: 3,
        mode: "guided",
        input_language: "en",
        primaryIntent: "research",
      },
    };

    renderPanel({ enhanceMetadata: metadataWithPrimary });

    expect(screen.getByText("Detected:")).toBeInTheDocument();
    // Primary intent should be rendered as the main chip
    expect(screen.getByText("research")).toBeInTheDocument();
    // Secondary intent "extraction" should be rendered with muted style
    expect(screen.getByText("extraction")).toBeInTheDocument();

    // Verify styling: primary chip gets primary color classes
    const primaryChip = screen.getByText("research");
    expect(primaryChip.className).toContain("text-primary");

    // Secondary chip gets muted style
    const secondaryChip = screen.getByText("extraction");
    expect(secondaryChip.className).toContain("text-muted-foreground");
  });

  it("renders all intents as secondary when primaryIntent is absent (Medium-2 fallback)", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    // Without primaryIntent, "analytical" should still be rendered but as secondary
    const chip = screen.getByText("analytical");
    expect(chip.className).toContain("text-muted-foreground");
  });

  it("renders missing parts as watch-outs", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("Watch-outs:")).toBeInTheDocument();
    expect(screen.getByText("Missing: examples")).toBeInTheDocument();
  });

  it("renders alternative version buttons", () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    expect(screen.getByText("Versions:")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Original" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use shorter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use more detailed" }),
    ).toBeInTheDocument();
  });

  it("switches displayed prompt when alternative version is selected", async () => {
    renderPanel({ enhanceMetadata: BASE_METADATA });

    // Initially shows the enhanced prompt
    expect(
      screen.getByText("Enhanced version of the prompt"),
    ).toBeInTheDocument();

    // Click "Use shorter"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Use shorter" }));
    });

    expect(
      screen.getByText("Short version of the prompt"),
    ).toBeInTheDocument();

    // Click "Use more detailed"
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use more detailed" }),
      );
    });

    expect(
      screen.getByText(
        "Very detailed and comprehensive version of the prompt",
      ),
    ).toBeInTheDocument();

    // Click "Original" to go back
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Original" }));
    });

    expect(
      screen.getByText("Enhanced version of the prompt"),
    ).toBeInTheDocument();
  });

  it("does not render summary section when metadata is null", () => {
    renderPanel({ enhanceMetadata: null });

    expect(screen.queryByText("What changed:")).not.toBeInTheDocument();
    expect(screen.queryByText("Detected:")).not.toBeInTheDocument();
    expect(screen.queryByText("Try next:")).not.toBeInTheDocument();
    expect(screen.queryByText("Versions:")).not.toBeInTheDocument();
  });

  it("does not render summary section while enhancing", () => {
    renderPanel({
      enhanceMetadata: BASE_METADATA,
      isEnhancing: true,
      enhancePhase: "streaming",
    });

    expect(screen.queryByText("What changed:")).not.toBeInTheDocument();
  });

  it("gracefully handles metadata with missing optional fields", () => {
    const minimal: EnhanceMetadata = {
      enhancedPrompt: "Enhanced prompt",
      detectedContext: {
        intent: ["creative"],
        domain: [],
        complexity: 1,
        mode: "quick",
        input_language: "en",
      },
    };

    renderPanel({ enhanceMetadata: minimal });

    expect(screen.getByText("Detected:")).toBeInTheDocument();
    expect(screen.getByText("creative")).toBeInTheDocument();
    expect(screen.getByText("mode: Light polish")).toBeInTheDocument();
    expect(screen.queryByText("What changed:")).not.toBeInTheDocument();
    expect(screen.queryByText("Try next:")).not.toBeInTheDocument();
    expect(screen.queryByText("Versions:")).not.toBeInTheDocument();
  });

  it("renders a clarification card and keeps the summary row collapsed for ambiguity-heavy questions", () => {
    const clarificationMetadata: EnhanceMetadata = {
      ...BASE_METADATA,
      openQuestions: [
        "Who is the target audience?",
        "What outcome should this optimize for?",
      ],
      ambiguityLevel: "high",
    };

    renderPanel({ enhanceMetadata: clarificationMetadata });

    expect(screen.getByText("Clarification needed")).toBeInTheDocument();
    expect(
      screen.getAllByText("Who is the target audience?").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("2 clarification question(s) are shown above the prompt."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
  });

  it("appends clarification questions to the prompt when requested", async () => {
    const onAppendClarificationBlockToPrompt = vi.fn();
    const clarificationMetadata: EnhanceMetadata = {
      ...BASE_METADATA,
      openQuestions: ["Who is the target audience?"],
      ambiguityLevel: "high",
    };

    renderPanel({
      enhanceMetadata: clarificationMetadata,
      onAppendClarificationBlockToPrompt,
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Add questions to prompt" }),
      );
    });

    expect(onAppendClarificationBlockToPrompt).toHaveBeenCalledWith(
      expect.stringContaining(
        "Clarification questions to answer before finalizing:",
      ),
    );
    expect(onAppendClarificationBlockToPrompt).toHaveBeenCalledWith(
      expect.stringContaining("1. Who is the target audience?"),
    );
  });
});
