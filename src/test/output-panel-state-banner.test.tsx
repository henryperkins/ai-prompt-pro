import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutputPanelStateBanner } from "@/components/OutputPanelStateBanner";

describe("OutputPanelStateBanner", () => {
  it("renders title, description, source label, and nextAction", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="The visible text comes from the current builder inputs."
        previewSourceLabel="Built prompt"
        nextAction="Copy the draft as-is, or run Enhance to compare an AI rewrite."
        tone="info"
        stateKey="draft"
      />,
    );

    expect(screen.getByText("Draft preview")).toBeInTheDocument();
    expect(
      screen.getByText("The visible text comes from the current builder inputs."),
    ).toBeInTheDocument();
    expect(screen.getByText("Source: Built prompt")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Copy the draft as-is, or run Enhance to compare an AI rewrite.",
      ),
    ).toBeInTheDocument();
  });

  it("sets data-state attribute to the stateKey", () => {
    render(
      <OutputPanelStateBanner
        title="Builder changed after enhancement"
        description="Re-run Enhance."
        previewSourceLabel="Built prompt"
        tone="warning"
        stateKey="stale"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner).toHaveAttribute("data-state", "stale");
  });

  it("applies warning tone classes from ui-status", () => {
    render(
      <OutputPanelStateBanner
        title="Builder changed after enhancement"
        description="Re-run Enhance."
        previewSourceLabel="Built prompt"
        tone="warning"
        stateKey="stale"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-utility-warning-200");
    expect(banner.className).toContain("bg-utility-warning-50");
  });

  it("applies success tone classes for ready state", () => {
    render(
      <OutputPanelStateBanner
        title="Enhanced output ready"
        description="The run is complete."
        previewSourceLabel="Enhanced output"
        tone="success"
        stateKey="ready"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-utility-success-200");
    expect(banner.className).toContain("bg-utility-success-50");
  });

  it("applies info tone classes by default", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="Current inputs."
        previewSourceLabel="Built prompt"
        stateKey="draft"
      />,
    );

    const banner = screen.getByTestId("output-panel-state-banner");
    expect(banner.className).toContain("border-primary/30");
    expect(banner.className).toContain("bg-primary/10");
  });

  it("renders statusLabel chip when provided", () => {
    render(
      <OutputPanelStateBanner
        title="Enhancing"
        description="AI is rewriting."
        previewSourceLabel="Enhanced output"
        statusLabel="Streaming"
        tone="info"
        stateKey="enhancing"
      />,
    );

    expect(screen.getByText("Status: Streaming")).toBeInTheDocument();
  });

  it("omits statusLabel chip when null", () => {
    render(
      <OutputPanelStateBanner
        title="Draft preview"
        description="Current inputs."
        previewSourceLabel="Built prompt"
        statusLabel={null}
        stateKey="draft"
      />,
    );

    expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
  });

  it("omits nextAction paragraph when not provided", () => {
    render(
      <OutputPanelStateBanner
        title="No preview yet"
        description="Start writing."
        previewSourceLabel="No preview yet"
        stateKey="empty"
      />,
    );

    expect(screen.queryByText("Next:")).not.toBeInTheDocument();
  });
});
