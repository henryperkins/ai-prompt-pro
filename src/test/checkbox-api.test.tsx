import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "@/components/base/checkbox";

describe("Checkbox API", () => {
  it("renders label and hint with selected state", () => {
    render(<Checkbox label="Enable notifications" hint="You can change this later." defaultSelected />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable notifications/ });

    expect(screen.getByText("You can change this later.")).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("toggles selection via user interaction", () => {
    render(<Checkbox label="Keep draft private" />);

    const checkbox = screen.getByRole("checkbox", { name: "Keep draft private" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it("applies disabled semantics", () => {
    render(<Checkbox label="Read-only permission" isDisabled defaultSelected />);

    const checkbox = screen.getByRole("checkbox", { name: /Read-only permission/ });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });
});
