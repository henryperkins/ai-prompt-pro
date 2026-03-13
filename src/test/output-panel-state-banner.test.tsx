import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutputPanelStateBanner } from "@/components/OutputPanelStateBanner";

describe("OutputPanelStateBanner", () => {
  it("renders title, description, source label, and nextAction", () => {
    render(
      <OutputPanelStateBanner
        title="Draft prompt"
        description="The visible text reflects your current builder inputs."
        previewSourceLabel="Draft prompt"
        nextAction="Copy the draft prompt as-is, or use Enhance prompt to compare an AI rewrite."
        tone="info"
        stateKey="draft"
      />,
    );

    expect(screen.getByText("Draft prompt")).toBeInTheDocument();
    expect(
      screen.getByText("The visible text reflects your current builder inputs."),
    ).toBeInTheDocument();
    expect(screen.getByText("Source: Draft prompt")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Copy the draft prompt as-is, or use Enhance prompt to compare an AI rewrite.",
      ),
    ).toBeInTheDocument();
  });

  it("sets data-state attribute to the stateKey", () => {
    render(
      <OutputPanelStateBanner
        title="Builder changed after enhancement"
        description="Re-run Enhance."
        previewSourceLabel="Draft prompt"
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
        previewSourceLabel="Draft prompt"
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
        title="Enhanced prompt ready"
        description="The run is complete."
        previewSourceLabel="Enhanced prompt"
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
        title="Draft prompt"
        description="Current inputs."
        previewSourceLabel="Draft prompt"
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
        previewSourceLabel="Enhanced prompt"
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
        title="Draft prompt"
        description="Current inputs."
        previewSourceLabel="Draft prompt"
        statusLabel={null}
        stateKey="draft"
      />,
    );

    expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
  });

  it("can hide the preview source chip in compact pre-run states", () => {
    render(
      <OutputPanelStateBanner
        title="Draft prompt"
        description="Current inputs."
        previewSourceLabel="Draft prompt"
        showPreviewSourceLabel={false}
        stateKey="draft"
      />,
    );

    expect(screen.queryByText("Source: Draft prompt")).not.toBeInTheDocument();
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
