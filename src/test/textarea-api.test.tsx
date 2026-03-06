import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextArea, Textarea } from "@/components/base/textarea";

describe("Textarea API", () => {
  it("renders canonical TextArea with label and hint", () => {
    render(
      <TextArea
        label="Context"
        aria-label="Context"
        hint="Include scope, audience, and completion constraints."
        placeholder="Provide prompt context"
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Include scope, audience, and completion constraints.")).toBeInTheDocument();
  });

  it("applies invalid state styling for canonical TextArea", () => {
    render(
      <TextArea
        label="Context"
        aria-label="Context"
        isInvalid
        hint="This field is required."
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("ring-error_subtle");
  });

  it("keeps legacy Textarea compatibility props functional", () => {
    render(
      <Textarea
        aria-label="Legacy context"
        isInvalid
        isDisabled
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Legacy context" });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass("ring-error_subtle");
  });
});
