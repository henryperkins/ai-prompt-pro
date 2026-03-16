import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "@/components/base/label";

describe("Label", () => {
  it("preserves the primitive responsive typography contract", () => {
    render(<Label htmlFor="prompt-input">Prompt title</Label>);

    const label = screen.getByText("Prompt title");

    expect(label).toHaveClass("inline-flex", "text-sm", "sm:text-base", "font-medium");
    expect(label).not.toHaveClass("leading-none");
  });

  it("renders required markers without changing the base typography classes", () => {
    render(<Label htmlFor="target-model" isRequired>Target model</Label>);

    const label = screen.getByText("Target model");
    const marker = screen.getByText("*");

    expect(label).toHaveClass("text-sm", "sm:text-base");
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });
});
