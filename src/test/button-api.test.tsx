import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/base/buttons/button";

describe("Button API normalization", () => {
  it("maps canonical variant props to the expected visual treatment", () => {
    render(<Button variant="secondary">Secondary</Button>);

    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button).toHaveClass("border");
    expect(button).toHaveClass("bg-background");
  });

  it("supports canonical tone for destructive buttons", () => {
    render(<Button variant="primary" tone="destructive">Delete</Button>);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("bg-destructive");
    expect(button).toHaveClass("text-destructive-foreground");
  });

  it("keeps legacy color props working while migration completes", () => {
    render(<Button color="tertiary">Legacy</Button>);

    const button = screen.getByRole("button", { name: "Legacy" });
    expect(button).toHaveClass("text-muted-foreground");
  });

  it("shows loading state with the canonical prop", () => {
    render(<Button loading>Saving</Button>);

    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toHaveAttribute("data-loading", "true");
  });
});
