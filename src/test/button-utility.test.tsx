import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ButtonUtility } from "@/components/base/buttons/button-utility";

const TestIcon = ({ className }: { className?: string }) => <svg className={className} aria-hidden="true" />;

describe("ButtonUtility", () => {
  it("uses mobile-first touch target classes for xs and sm sizes", () => {
    const { rerender } = render(<ButtonUtility icon={TestIcon} size="xs" aria-label="More actions" />);

    expect(screen.getByRole("button", { name: "More actions" })).toHaveClass("h-11", "w-11", "sm:h-8", "sm:w-8");

    rerender(<ButtonUtility icon={TestIcon} size="sm" aria-label="Open details" />);

    expect(screen.getByRole("button", { name: "Open details" })).toHaveClass("h-11", "w-11", "sm:h-9", "sm:w-9");
  });

  it("does not invoke onClick for disabled link variants", () => {
    const onClick = vi.fn();

    render(<ButtonUtility href="#details" icon={TestIcon} aria-label="Details" isDisabled onClick={onClick} />);

    fireEvent.click(screen.getByRole("link", { name: "Details" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("invokes onClick for enabled link variants", () => {
    const onClick = vi.fn();

    render(<ButtonUtility href="#details" icon={TestIcon} aria-label="Details" onClick={onClick} />);

    fireEvent.click(screen.getByRole("link", { name: "Details" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses tooltip text as the fallback accessible name for icon-only buttons", () => {
    render(<ButtonUtility icon={TestIcon} tooltip="Decrease progress" />);

    expect(screen.getByRole("button", { name: "Decrease progress" })).toBeInTheDocument();
  });
});
