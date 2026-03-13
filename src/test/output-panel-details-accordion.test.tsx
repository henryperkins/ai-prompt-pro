import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutputPanelDetailsAccordion } from "@/components/OutputPanelDetailsAccordion";

function renderAccordion(
  props: Partial<ComponentProps<typeof OutputPanelDetailsAccordion>> = {},
) {
  return render(
    <OutputPanelDetailsAccordion
      title="Details"
      testId="details-accordion"
      {...props}
    >
      <p>Accordion content</p>
    </OutputPanelDetailsAccordion>,
  );
}

describe("OutputPanelDetailsAccordion", () => {
  it("treats defaultOpen as an initial value only", () => {
    const { rerender } = renderAccordion();

    expect(screen.queryByText("Accordion content")).not.toBeInTheDocument();

    rerender(
      <OutputPanelDetailsAccordion
        title="Details"
        defaultOpen
        testId="details-accordion"
      >
        <p>Accordion content</p>
      </OutputPanelDetailsAccordion>,
    );

    expect(screen.queryByText("Accordion content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("details-accordion-trigger"));

    expect(screen.getByText("Accordion content")).toBeInTheDocument();
  });

  it("supports controlled open state", () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderAccordion({
      open: true,
      onOpenChange,
    });

    expect(screen.getByText("Accordion content")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("details-accordion-trigger"));

    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <OutputPanelDetailsAccordion
        title="Details"
        open={false}
        onOpenChange={onOpenChange}
        testId="details-accordion"
      >
        <p>Accordion content</p>
      </OutputPanelDetailsAccordion>,
    );

    expect(screen.queryByText("Accordion content")).not.toBeInTheDocument();
  });
});
