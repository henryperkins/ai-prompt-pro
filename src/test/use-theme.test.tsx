import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { resetPreferencesCache } from "@/lib/user-preferences";

function ThemeProbe() {
  const { theme, isMidnight, toggleTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="midnight-flag">{String(isMidnight)}</span>
      <button type="button" onClick={toggleTheme}>Toggle theme</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferencesCache();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark", "dark-mode");
  });

  it("uses the standard theme by default and toggles into midnight mode", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "default");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("default");
    expect(screen.getByTestId("midnight-flag")).toHaveTextContent("false");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("dark-mode");

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("midnight");
    expect(screen.getByTestId("midnight-flag")).toHaveTextContent("true");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveClass("dark-mode");
    expect(JSON.parse(localStorage.getItem("promptforge-user-prefs") ?? "{}").theme).toBe("midnight");
  });

  it("normalizes legacy dark preferences into midnight mode on mount", async () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "dark" }));

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("midnight");
    expect(screen.getByTestId("midnight-flag")).toHaveTextContent("true");
    expect(document.documentElement).toHaveClass("dark");
  });
});
