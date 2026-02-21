import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/base/primitives/accordion";

describe("AccordionTrigger", () => {
  it("includes explicit focus-visible ring classes", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="section">
          <AccordionTrigger>Prompt Goal</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: "Prompt Goal" });
    expect(trigger.className).toContain("focus-visible:ring-2");
    expect(trigger.className).toContain("focus-visible:ring-ring");
    expect(trigger.className).toContain("focus-visible:ring-offset-2");
    expect(trigger.className).toContain("focus-visible:ring-offset-background");
  });
});
