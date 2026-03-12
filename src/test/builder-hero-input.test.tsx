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
});
