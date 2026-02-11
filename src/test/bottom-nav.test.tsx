import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BottomNav } from "@/components/BottomNav";

describe("BottomNav", () => {
  it("includes History in mobile navigation", () => {
    render(
      <MemoryRouter initialEntries={["/history"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    const historyLink = screen.getByRole("link", { name: "History" });
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(historyLink).toHaveAttribute("aria-current", "page");
  });
});
