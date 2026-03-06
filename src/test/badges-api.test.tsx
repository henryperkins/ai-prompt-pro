import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";

describe("Badge API normalization", () => {
  it("applies tone-based styling with canonical props", () => {
    render(<Badge tone="success">Healthy</Badge>);

    const badge = screen.getByText("Healthy");
    expect(badge).toHaveClass("text-primary");
    expect(badge).toHaveClass("ring-primary/30");
  });

  it("applies variant-based structure with canonical props", () => {
    render(
      <Badge variant="subtle" tone="default" size="sm">
        Subtle
      </Badge>,
    );

    const badge = screen.getByText("Subtle");
    expect(badge).toHaveClass("rounded-md");
    expect(badge).toHaveClass("px-1.5");
  });

  it("keeps legacy type/color props working for compatibility", () => {
    render(
      <Badge type="pill-color" color="brand">
        Legacy
      </Badge>,
    );

    const badge = screen.getByText("Legacy");
    expect(badge).toHaveClass("text-primary");
    expect(badge).toHaveClass("ring-primary/30");
  });

  it("prefers canonical tone over legacy color when both are set", () => {
    render(
      <Badge tone="error" color="success">
        Priority
      </Badge>,
    );

    const badge = screen.getByText("Priority");
    expect(badge).toHaveClass("text-destructive");
    expect(badge).toHaveClass("ring-destructive/30");
  });

  it("maps tone for BadgeWithDot and renders semantic addon color", () => {
    const { container } = render(<BadgeWithDot tone="info">Info</BadgeWithDot>);

    const badge = screen.getByText("Info");
    const dot = container.querySelector("svg");

    expect(badge).toHaveClass("text-primary");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("text-primary/80");
  });
});
