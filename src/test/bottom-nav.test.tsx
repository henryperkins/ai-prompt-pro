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

  it("shows 5 top-level items with presets and community links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const links = nav.querySelectorAll("a.mobile-route-link");
    expect(links.length).toBe(5);

    const presetsLink = screen.getByRole("link", { name: "Presets" });
    expect(presetsLink).toHaveAttribute("href", "/presets");

    const communityLink = screen.getByRole("link", { name: "Community" });
    expect(communityLink).toHaveAttribute("href", "/community");
  });
});
