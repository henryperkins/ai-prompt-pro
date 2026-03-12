import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBarCircle, ProgressBarHalfCircle } from "@/components/base/progress-indicators/progress-circles";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";

describe("progress indicators", () => {
  it("requires an explicit accessible name for linear progress bars", () => {
    render(<ProgressBar value={58} ariaLabel="Overall upload progress" labelPosition="right" />);

    expect(screen.getByRole("progressbar", { name: "Overall upload progress" })).toBeInTheDocument();
  });

  it("uses the visible label as the accessible name for circular progress bars", () => {
    render(<ProgressBarCircle value={58} size="xs" label="Upload" />);

    expect(screen.getByRole("progressbar", { name: "Upload" })).toBeInTheDocument();
  });

  it("uses the visible label as the accessible name for half-circle progress bars", () => {
    render(<ProgressBarHalfCircle value={58} size="md" label="Deploy" />);

    expect(screen.getByRole("progressbar", { name: "Deploy" })).toBeInTheDocument();
  });
});
