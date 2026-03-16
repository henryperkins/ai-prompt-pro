import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";

describe("ButtonGroup", () => {
  it("uses mobile-first touch target classes for each size", () => {
    const { rerender } = render(
      <ButtonGroup aria-label="Feed filter" size="sm" defaultValue="all">
        <ButtonGroupItem value="all" size="sm">All</ButtonGroupItem>
      </ButtonGroup>,
    );

    expect(screen.getByRole("radio", { name: "All" })).toHaveClass("min-h-11", "sm:min-h-8", "text-sm", "sm:text-xs");

    rerender(
      <ButtonGroup aria-label="Feed filter" size="md" defaultValue="all">
        <ButtonGroupItem value="all" size="md">All</ButtonGroupItem>
      </ButtonGroup>,
    );

    expect(screen.getByRole("radio", { name: "All" })).toHaveClass("min-h-11", "sm:min-h-9", "text-sm");

    rerender(
      <ButtonGroup aria-label="Feed filter" size="lg" defaultValue="all">
        <ButtonGroupItem value="all" size="lg">All</ButtonGroupItem>
      </ButtonGroup>,
    );

    expect(screen.getByRole("radio", { name: "All" })).toHaveClass("min-h-12", "sm:min-h-11", "text-sm");
  });

  it("keeps toggle semantics when the selected item changes", () => {
    render(
      <ButtonGroup aria-label="Progress step mode" defaultValue="icons">
        <ButtonGroupItem value="icons">Icons</ButtonGroupItem>
        <ButtonGroupItem value="numbers">Numbers</ButtonGroupItem>
      </ButtonGroup>,
    );

    const icons = screen.getByRole("radio", { name: "Icons" });
    const numbers = screen.getByRole("radio", { name: "Numbers" });

    expect(icons).toHaveAttribute("data-state", "on");
    expect(numbers).toHaveAttribute("data-state", "off");

    fireEvent.click(numbers);

    expect(icons).toHaveAttribute("data-state", "off");
    expect(numbers).toHaveAttribute("data-state", "on");
  });
});
