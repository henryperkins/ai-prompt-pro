import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/hooks/theme-provider";
import NotFound from "@/pages/NotFound";

vi.mock("@/components/Header", () => ({
  Header: () => null,
}));

describe("NotFound", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("keeps one primary recovery path and one quieter alternate path", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/missing-route"]}>
          <NotFound />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText(/The route "\/missing-route" does not exist or has moved\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Builder" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open Community" })).toHaveAttribute("href", "/community");
  });
});
