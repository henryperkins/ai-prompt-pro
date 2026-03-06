import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebSearchActivityIndicator } from "@/components/WebSearchActivityIndicator";

describe("WebSearchActivityIndicator", () => {
  it("shows completed activity on initial mount and fades out", () => {
    vi.useFakeTimers();

    render(
      <WebSearchActivityIndicator
        phase="completed"
        query="best prompt templates"
        searchCount={2}
      />,
    );

    expect(screen.getByTestId("web-search-activity")).toBeInTheDocument();
    expect(screen.getByText("Searched")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId("web-search-activity")).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.queryByTestId("web-search-activity")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
