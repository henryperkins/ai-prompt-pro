import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/base/avatar";

describe("Avatar API", () => {
  it("renders initials when no image source is provided", () => {
    render(<Avatar initials="PF" alt="PromptForge" />);

    expect(screen.getByText("PF")).toBeInTheDocument();
  });

  it("falls back to initials when image loading fails", () => {
    render(<Avatar src="broken-avatar.png" initials="AL" alt="Alice" />);

    const image = screen.getByRole("img", { name: "Alice" });
    fireEvent.error(image);

    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("renders compatibility status and verified badge states", () => {
    const { container, rerender } = render(<Avatar initials="ST" status="online" />);
    expect(container.querySelector("span.bg-fg-success-secondary")).not.toBeNull();

    rerender(<Avatar initials="VR" verified />);
    expect(container.querySelector("[data-verified]")).not.toBeNull();
  });
});
