import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuilderHeroInput } from "@/components/BuilderHeroInput";
import type { BuilderSuggestionChip } from "@/lib/builder-inference";

const longSuggestionChips: BuilderSuggestionChip[] = [
  {
    id: "append-evidence",
    label: "Add evidence requirements",
    description: "What should back the claims?",
    action: {
      type: "append_prompt",
      text: "\nEvidence: [cite sources, use data, include examples]",
    },
  },
  {
    id: "append-comparison-framework",
    label: "Add comparison framework",
    description:
      "Define the baseline, segments, or time periods to compare.",
    action: {
      type: "append_prompt",
      text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
    },
  },
];

describe("BuilderHeroInput", () => {
  it("renders long smart suggestions as wrap-safe action tiles", () => {
    render(
      <BuilderHeroInput
        value="Review the prompt builder interface and compare current and prior flows."
        onChange={() => undefined}
        onClear={() => undefined}
        phase3Enabled
        suggestionChips={longSuggestionChips}
      />,
    );

    const suggestion = screen.getByTestId(
      "builder-suggestion-chip-append-comparison-framework",
    );

    expect(suggestion.tagName).toBe("BUTTON");
    expect(suggestion.className).toContain("interactive-card");
    expect(suggestion.className).toContain("w-full");
    expect(suggestion.className).not.toContain("whitespace-nowrap");

    const label = screen.getByText("Add comparison framework");
    const description = screen.getByText(
      "Define the baseline, segments, or time periods to compare.",
    );

    expect(label.className).toContain("type-wrap-safe");
    expect(label.className).toContain("line-clamp-2");
    expect(description.className).toContain("type-wrap-safe");
    expect(description.className).toContain("line-clamp-2");
  });

  it("passes the full suggestion payload to the apply handler", () => {
    const onApplySuggestion = vi.fn();

    render(
      <BuilderHeroInput
        value="Compare two product workflows and summarize the tradeoffs."
        onChange={() => undefined}
        onClear={() => undefined}
        phase3Enabled
        suggestionChips={longSuggestionChips}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    fireEvent.click(
      screen.getByTestId("builder-suggestion-chip-append-evidence"),
    );

    expect(onApplySuggestion).toHaveBeenCalledWith(longSuggestionChips[0]);
  });

  it("tucks clear and reset actions behind a draft-actions disclosure", () => {
    const onClear = vi.fn();
    const onResetAll = vi.fn();

    render(
      <BuilderHeroInput
        value="Rewrite these product notes into a launch brief."
        onChange={() => undefined}
        onClear={onClear}
        onResetAll={onResetAll}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Clear prompt text" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset all builder fields" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Draft actions" }));

    expect(
      screen.getByTestId("builder-hero-recovery-actions"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear prompt text" }));
    expect(onClear).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Draft actions" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reset all builder fields" }),
    );
    expect(onResetAll).toHaveBeenCalledTimes(1);
  });

  it("omits the recovery disclosure when the draft is pristine", () => {
    render(
      <BuilderHeroInput
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Draft actions" }),
    ).not.toBeInTheDocument();
  });

  it("shows one non-blocking degraded suggestion status inside the smart suggestions panel", () => {
    render(
      <BuilderHeroInput
        value="Compare two onboarding flows and note where users get stuck."
        onChange={() => undefined}
        onClear={() => undefined}
        phase3Enabled
        suggestionChips={longSuggestionChips}
        hasInferenceError
        inferenceStatusMessage="Using local suggestions while AI suggestions reconnect. We'll retry automatically."
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Using local suggestions while AI suggestions reconnect. We'll retry automatically.",
    );
    expect(
      screen.getAllByText(
        "Using local suggestions while AI suggestions reconnect. We'll retry automatically.",
      ),
    ).toHaveLength(1);
    expect(
      screen.queryByText("AI suggestions are temporarily unavailable."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Add evidence requirements")).toBeInTheDocument();
  });
});
