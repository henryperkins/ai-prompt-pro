import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ButtonUtility } from "@/components/base/buttons/button-utility";

const TestIcon = ({ className }: { className?: string }) => <svg className={className} aria-hidden="true" />;

describe("ButtonUtility", () => {
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
});
