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

  it("shows 6 top-level items including personal feed and presets links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const links = nav.querySelectorAll("a.mobile-route-link");
    expect(links.length).toBe(6);

    const presetsLink = screen.getByRole("link", { name: "Presets" });
    expect(presetsLink).toHaveAttribute("href", "/presets");

    const feedLink = screen.getByRole("link", { name: "Feed" });
    expect(feedLink).toHaveAttribute("href", "/feed");
    expect(feedLink.className).toContain("max-[360px]:hidden");
  });
});
