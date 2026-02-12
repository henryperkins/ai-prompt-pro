import { fireEvent, render, screen } from "@testing-library/react";
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

  it("shows 4 top-level items without a standalone Presets link", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const links = nav.querySelectorAll("a.mobile-route-link");
    const buttons = nav.querySelectorAll("button.mobile-route-link");
    expect(links.length + buttons.length).toBe(4);
  });

  it("shows Presets in the Builder popover when Builder is active", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Builder" }));

    const presetsLink = await screen.findByRole("link", { name: "Presets" });
    expect(presetsLink).toHaveAttribute("href", "/presets");
  });
});
