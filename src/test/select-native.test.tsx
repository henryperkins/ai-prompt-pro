import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NativeSelect } from "@/components/base/select/select-native";

describe("NativeSelect", () => {
  it("does not duplicate IDs and preserves explicit aria-label naming", () => {
    render(
      <NativeSelect
        label="Country"
        aria-label="Country code"
        options={[
          { label: "United States", value: "US" },
          { label: "Canada", value: "CA" },
        ]}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Country code" });
    const label = screen.getByText("Country");

    expect(select).toHaveAttribute("id");
    expect(label).toHaveAttribute("for", select.getAttribute("id"));
    expect(document.querySelectorAll(`[id="${select.getAttribute("id")}"]`)).toHaveLength(1);
  });

  it("applies disabled option state from options config", () => {
    render(
      <NativeSelect
        aria-label="Country"
        options={[
          { label: "United States", value: "US" },
          { label: "Canada", value: "CA", disabled: true },
        ]}
      />,
    );

    const enabledOption = screen.getByRole("option", { name: "United States" });
    const disabledOption = screen.getByRole("option", { name: "Canada" });

    expect(enabledOption).not.toBeDisabled();
    expect(disabledOption).toBeDisabled();
  });
});
