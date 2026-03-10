import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { ToneControls } from "@/components/ToneControls";
import { defaultConfig } from "@/lib/prompt-builder";

describe("tone and complexity unset controls", () => {
  it("keeps deep BuilderAdjustDetails controls behind subgroup disclosure", () => {
    const onUpdate = vi.fn();

    render(
      <BuilderAdjustDetails
        config={{
          ...defaultConfig,
          tone: "Casual",
          complexity: "Advanced",
        }}
        isOpen
        onOpenChange={() => undefined}
        onUpdate={onUpdate}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Role and voice" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Output shape" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Let model decide complexity" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Let model decide tone" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Output shape" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Let model decide complexity" }),
    );

    expect(onUpdate).toHaveBeenNthCalledWith(1, { tone: "" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { complexity: "" });
  });

  it("lets users clear tone and complexity in legacy ToneControls", () => {
    const onUpdate = vi.fn();

    render(
      <ToneControls
        tone="Technical"
        complexity="Advanced"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Let model decide tone" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Let model decide complexity" }),
    );

    expect(onUpdate).toHaveBeenNthCalledWith(1, { tone: "" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { complexity: "" });
  });

  it("exposes pressed-state semantics in legacy ToneControls", () => {
    render(
      <ToneControls
        tone="Professional"
        complexity="Moderate"
        onUpdate={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Let model decide tone" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Professional" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Let model decide complexity" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Moderate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
