import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/hooks/theme-provider";
import History from "@/pages/History";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  queueRestoredVersionPrompt: vi.fn(),
  versions: [
    {
      id: "v1",
      name: "Version 1",
      prompt: "Prompt body",
      timestamp: 1_720_000_000_000,
    },
  ],
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => ({
    versions: mocks.versions,
  }),
}));

vi.mock("@/components/Header", () => ({
  Header: () => null,
}));

vi.mock("@/lib/history-restore", () => ({
  queueRestoredVersionPrompt: (prompt: string) => mocks.queueRestoredVersionPrompt(prompt),
}));

describe("History restore behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.versions = [
      {
        id: "v1",
        name: "Version 1",
        prompt: "Prompt body",
        timestamp: 1_720_000_000_000,
      },
    ];
  });

  it("shows builder and presets recovery actions when versions exist", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Version History" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Builder" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open Presets" })).toHaveAttribute("href", "/presets");
  });

  it("shows an error and does not navigate when restore queueing fails", () => {
    mocks.queueRestoredVersionPrompt.mockReturnValue(false);

    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Restore failed",
        variant: "destructive",
      }),
    );
  });

  it("navigates to builder when restore queueing succeeds", () => {
    mocks.queueRestoredVersionPrompt.mockReturnValue(true);

    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Version ready",
      }),
    );
  });

  it("offers presets as a fallback when no saved versions exist", () => {
    mocks.versions = [];

    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText("No saved versions yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Builder" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open Presets" })).toHaveAttribute("href", "/presets");
  });
});
